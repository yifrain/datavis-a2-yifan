// Waiting until document has loaded
window.onload = () => {
  // 加载数据
  d3.csv("cars.csv").then(data => {
    data.forEach(d => {
      d.Horsepower = +d["Horsepower(HP)"];
      d.CityMPG = +d["City Miles Per Gallon"];
      d.RetailPrice = +d["Retail Price"];
      d.Type = d.Type;
      d.Weight = +d.Weight;
      d["Wheel Base"] = +d["Wheel Base"];
      d["Engine Size (l)"] = +d["Engine Size (l)"];
      d.AWD = +d.AWD;
      d.RWD = +d.RWD;
    });

    const mpgThreshold = 60;
    const typeDomain = Array.from(new Set(data.map(d => d.Type))).filter(Boolean);
    // 使用更协调的 Tableau 10 调色板（更柔和、减少割裂感）
    const palette = [
      "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
      "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"
    ];
    const colorScale = d3.scaleOrdinal()
      .domain(typeDomain)
      .range(palette.slice(0, typeDomain.length));

    // 指定高对比度覆盖色（提高可区分度）
    const typeColorOverrides = {};
    function typeColor(t) { return colorScale(t); }

    // 筛选状态（初始为全选）
    // 通过 Color 图例实现类型筛选（不需要独立筛选框）
    let filters = { types: new Set(typeDomain) };
    // 图例只构建一次，后续只更新状态，避免布局上/下移
    let legendBuilt = false;
    let colorLegendSvg = null;
    let sizeLegendSvg = null;
    // 密度模式开关（保留到全局以便刷新后保留）
    let densityMode = window.__DENSITY_MODE__ || false;
    // 尺寸缩放控制
    let sizeFactor = window.__SIZE_FACTOR__ || 1.0; // 持久在全局以便刷新后保留
    const baseSizeRange = [4, 12];
    let sizeLegendValuesGlobal = null;
    let capPriceGlobal = null;
    function updateLegendState() {
      if (!legendBuilt || !colorLegendSvg) return;
      colorLegendSvg.selectAll('g.legend-row').each(function(t){
        const row = d3.select(this);
        const on = filters.types.has(t);
        row.select('circle.legend-color-dot').attr('opacity', on ? 1 : 0.25);
        row.select('text.legend-text')
          .attr('fill', on ? '#333' : '#888')
          .attr('font-weight', on ? '600' : '400');
      });
    }
    function updateSizeLegend(sizeScale) {
      if (!legendBuilt || !sizeLegendSvg || !sizeLegendValuesGlobal) return;
      // 重新计算每一行的位置与圆半径，保持内部布局但不改变整体高度
      let yOffset = 24;
      sizeLegendSvg.selectAll('g.size-row').each(function(v){
        const r = sizeScale(v);
        const row = d3.select(this);
        row.attr('transform', `translate(0, ${yOffset})`);
        row.select('circle.size-icon')
          .attr('r', r)
          .attr('cx', r + 6)
          .attr('cy', r);
        row.select('text.size-text')
          .attr('x', r * 2 + 16)
          .attr('y', r + 4);
        yOffset += r * 2 + 12;
      });
    }

    function render() {
      const container = d3.select("#scatterplot");
      const legendContainer = d3.select("#legend-container");

      const containerWidth = container.node().getBoundingClientRect().width;
      const headerNode = d3.select('#page-header').node();
      const headerHeight = headerNode ? headerNode.getBoundingClientRect().height : 64;
      const width = Math.max(520, Math.floor(containerWidth));
      const height = Math.max(420, Math.floor(window.innerHeight - headerHeight - 48));

      const margin = { top: 40, right: 24, bottom: 60, left: 70 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // 清空旧的图（保留图例，避免布局跳动）
      container.selectAll("svg").remove();

      // 创建 SVG 容器
      const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

      const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
      // 高亮层：用于绘制悬浮/选中外圈（不影响原点）
      const haloLayer = chart.append("g").attr("class", "halo-layer").style("pointer-events", "none");
      // 计算与点颜色同色系的荧光色（提高饱和度与亮度）
      function computeNeon(hex) {
        const base = d3.color(hex);
        if (!base) return "#39ff14"; // 回退为绿色荧光
        const hsl = d3.hsl(base);
        hsl.s = 1; // 饱和度拉满
        hsl.l = Math.min(0.72, hsl.l + 0.22); // 提升亮度到更接近荧光
        return hsl.toString();
      }

      // 高亮滤镜（悬浮/选中发光效果）
      const defs = svg.append("defs");
      const glow = defs.append("filter")
        .attr("id", "point-glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      glow.append("feDropShadow")
        .attr("dx", 0)
        .attr("dy", 0)
        .attr("stdDeviation", 1.5)
        .attr("flood-color", "#000")
        .attr("flood-opacity", 0.35);

      // x/y 尺度（加域外边距，避免点贴边）
      const hpExtent = d3.extent(data, d => d.Horsepower);
      const hpPad = (hpExtent[1] - hpExtent[0]) * 0.07;
      const xScale = d3.scaleLinear()
        .domain([hpExtent[0] - hpPad, hpExtent[1] + hpPad]).nice()
        .range([0, innerWidth]);

      const cityValues = data.map(d => d.CityMPG).filter(v => Number.isFinite(v) && v <= mpgThreshold);
      const yRawExtent = d3.extent(cityValues);
      const yPad = (yRawExtent[1] - yRawExtent[0]) * 0.08;
      const yScale = d3.scaleLinear()
        .domain([yRawExtent[1] + yPad, yRawExtent[0] - yPad]).nice()
        .range([8, innerHeight - 12])
        .clamp(true);

      // 使用对数尺（不封顶），以完整价格范围保留真实信息，同时增强低价段对比
      const prices = data.map(d => d.RetailPrice).filter(Number.isFinite).sort(d3.ascending);
      const minPrice = prices[0] || 1;
      const maxPrice = prices[prices.length - 1] || minPrice;
      const sizeScale = d3.scaleLog()
        .domain([Math.max(1, minPrice), Math.max(2, maxPrice)])
        .range(baseSizeRange.map(v => v * sizeFactor));

      // 网格线与自适应刻度密度
      const xTickCount = Math.max(4, Math.floor(innerWidth / 90));
      chart.append("g")
        .attr("class", "grid grid-y")
        .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth).tickFormat(""))
        .attr("opacity", 0.06);

      chart.append("g")
        .attr("class", "grid grid-x")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(xTickCount).tickSize(-innerHeight).tickFormat(""))
        .attr("opacity", 0.04);

      // 坐标轴
      const xAxis = d3.axisBottom(xScale)
        .ticks(xTickCount)
        .tickFormat(d3.format("~s"))
        .tickSizeOuter(0)
        .tickPadding(6);
      const yAxis = d3.axisLeft(yScale).ticks(8);

      const xAxisG = chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

      const yAxisG = chart.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

      // 加粗坐标轴与刻度文本
      xAxisG.selectAll(".tick text").attr("font-size", 14).attr("fill", "#222").attr("font-weight", "700");
      yAxisG.selectAll(".tick text").attr("font-size", 14).attr("fill", "#222").attr("font-weight", "700");
      xAxisG.select(".domain").attr("stroke-width", 2.5).attr("stroke", "#333");
      yAxisG.select(".domain").attr("stroke-width", 2.5).attr("stroke", "#333");

      // 已移除箭头标记以避免斜偏，仅保留加粗坐标轴

      // 密度层（可选）：在点之下渲染柔和的 2D 密度带/轮廓
      chart.selectAll(".density-layer").remove();
      if (densityMode) {
        const density = d3.contourDensity()
          .x(d => xScale(d.Horsepower))
          .y(d => yScale((Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold) ? (mpgThreshold + 3) : d.CityMPG))
          .size([innerWidth, innerHeight])
          .bandwidth(Math.max(14, Math.min(28, innerWidth / 30)))
          .thresholds(12)(data.filter(d => filters.types.has(d.Type)));
        const maxDen = d3.max(density, d => d.value) || 1;
        const layer = chart.append("g")
          .attr("class", "density-layer")
          .style("pointer-events", "none");
        layer.selectAll("path")
          .data(density)
          .enter()
          .append("path")
          .attr("d", d3.geoPath())
          .attr("fill", "#4E79A7")
          .attr("stroke", "#4E79A7")
          .attr("stroke-width", 0.5)
          .attr("opacity", d => 0.045 + 0.18 * (d.value / maxDen));
      }

      // 轴标题
      svg.append("text")
        .attr("class", "x-label")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("Horsepower (HP)");

      svg.append("text")
        .attr("class", "y-label")
        .attr("transform", `translate(15, ${margin.top + innerHeight / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .text("City MPG (truncated at 60)");

      // 按 Color 图例的类型选择进行过滤（轴范围仍基于全数据，避免跳动）
      const filtered = data.filter(d => filters.types.has(d.Type));

      // 优雅疏散纵向重叠：对同一像素行的点进行“垂直错位(dodge)”
      function symmetricOffsets(n, step) {
        const arr = [];
        if (n <= 0) return arr;
        arr.push(0);
        let k = 1;
        while (arr.length < n) {
          arr.push(-k * step);
          if (arr.length < n) arr.push(k * step);
          k++;
        }
        return arr;
      }
      function computeVerticalDodge(items, yScale, step = 2.4) {
        const map = new Map();
        const bins = new Map();
        items.forEach(d => {
          const yVal = (Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold) ? (mpgThreshold + 3) : d.CityMPG;
          const yPx = yScale(yVal);
          const key = Math.round(yPx / 2); // 2px 分箱，聚合同一像素行附近
          if (!bins.has(key)) bins.set(key, []);
          bins.get(key).push(d);
        });
        bins.forEach(group => {
          const itemsSorted = group.slice().sort((a, b) => d3.ascending(a.Horsepower, b.Horsepower));
          const offsets = symmetricOffsets(itemsSorted.length, step);
          itemsSorted.forEach((d, i) => {
            const isOutlier = Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold;
            map.set(d, isOutlier ? 0 : offsets[i]);
          });
        });
        return map;
      }
      const yDodgeMap = computeVerticalDodge(filtered, yScale);

      // 散点（增加轻微抖动与白描边，提高区分度）
      const points = chart.selectAll("circle.data-point")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => xScale(d.Horsepower) + (Math.random() - 0.5) * 6)
        .attr("cy", d => {
          const yVal = d.CityMPG > mpgThreshold ? mpgThreshold + 3 : d.CityMPG;
          const base = yScale(yVal);
          const off = yDodgeMap.get(d) || 0;
          return base + off;
        })
        .attr("r", d => sizeScale(d.RetailPrice))
        .attr("fill", d => typeColor(d.Type))
        .attr("opacity", 0.85)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("cursor", "pointer");

      // 悬停与点击交互
      points.on("mouseover", function(d) {
          const sel = d3.select(this);
          const isOutlier = Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold;
          const rTarget = sizeScale(d.RetailPrice) * 1.2;
          sel.attr("opacity", 1)
            .attr("stroke", isOutlier ? "#e74c3c" : "#000")
            .attr("stroke-width", isOutlier ? 3 : 2)
            .raise()
            .transition().duration(200)
            .attr("r", rTarget);
          // 悬浮外圈高亮
          const cx = parseFloat(sel.attr("cx"));
          const cy = parseFloat(sel.attr("cy"));
          const neon = computeNeon(sel.attr("fill"));
          haloLayer.selectAll("circle.halo-hover").remove();
          haloLayer.append("circle")
            .attr("class", "halo-hover")
            .attr("cx", cx)
            .attr("cy", cy)
            // 与球体接壤：半径 = rTarget + (描边宽/2)
            .attr("r", rTarget + 3)
            .attr("fill", "none")
            .attr("stroke", neon)
            .attr("stroke-width", 6)
            .attr("opacity", 0.25)
            .raise();
        })
        .on("mouseout", function(d) {
          const sel = d3.select(this);
          const isOutlier = Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold;
          const keepSelected = sel.classed("selected");
          sel.attr("opacity", keepSelected ? 1 : (isOutlier ? 1 : 0.85))
            .attr("stroke", isOutlier ? "#e74c3c" : "#fff")
            .attr("stroke-width", isOutlier ? 2.5 : 1)
            .transition().duration(200)
            .attr("r", sizeScale(d.RetailPrice));
          if (!keepSelected) haloLayer.selectAll("circle.halo-hover").remove();
        })
        .on("click", function(d) {
          chart.selectAll("circle.data-point")
            .classed("selected", false)
            .attr("opacity", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? 1 : 0.85; })
            .attr("stroke", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? "#e74c3c" : "#fff"; })
            .attr("stroke-width", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? 2.5 : 1; });
          const sel = d3.select(this);
          const isOutlier = Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold;
          sel.classed("selected", true)
            .attr("opacity", 1)
            .attr("stroke", isOutlier ? "#e74c3c" : "#000")
            .attr("stroke-width", 3)
            .raise();
          // 选中外圈高亮（持久，荧光色，与球接壤直到下一次选中）
          haloLayer.selectAll("circle.halo-selected").remove();
          const cx2 = parseFloat(sel.attr("cx"));
          const cy2 = parseFloat(sel.attr("cy"));
          const r2 = parseFloat(sel.attr("r"));
          const neon = computeNeon(sel.attr("fill"));
          haloLayer.append("circle")
            .attr("class", "halo-selected")
            .attr("cx", cx2)
            .attr("cy", cy2)
            // 与球体接壤：半径 = r2 + (描边宽/2)
            .attr("r", r2 + 5)
            .attr("fill", "none")
            .attr("stroke", neon)
            .attr("stroke-width", 10)
            .attr("opacity", 0.28)
            .raise();
          const priceText = Number.isFinite(d.RetailPrice) ? d.RetailPrice.toLocaleString() : "N/A";
          const mpgText = Number.isFinite(d.CityMPG) ? d.CityMPG : "N/A";
          const hpText = Number.isFinite(d.Horsepower) ? d.Horsepower : "N/A";
          const engText = Number.isFinite(d["Engine Size (l)"]) ? d["Engine Size (l)"] : "N/A";
          const driveText = d.AWD === 1 ? "全时四驱(AWD)" : (d.RWD === 1 ? "后轮驱动(RWD)" : "前轮驱动(FWD)");
          detailPanel.html(`
            <h3 style="margin: 0; color: #333;">${d.Name || "未知车型"}</h3>
            <div style="margin-top: 10px; line-height: 1.6;">
              <p><strong>车型：</strong>${d.Type || "N/A"}</p>
              <p><strong>马力：</strong>${hpText} HP</p>
              <p><strong>城市油耗：</strong>${mpgText} MPG</p>
              <p><strong>零售价：</strong>$${priceText}</p>
              <p><strong>驱动类型：</strong>${driveText}</p>
              <p><strong>发动机排量：</strong>${engText} L</p>
            </div>
          `);
        });

      // 添加刷选交互（矩形）
      const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("start brush end", function() {
          const selection = d3.event.selection;
          // 清除之前的选中样式与外圈
          chart.selectAll("circle.data-point").classed("selected", false)
            .attr("opacity", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? 1 : 0.85; })
            .attr("stroke-width", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? 2.5 : 1; })
            .attr("stroke", function(p){ return (Number.isFinite(p.CityMPG) && p.CityMPG > mpgThreshold) ? "#e74c3c" : "#fff"; });
          haloLayer.selectAll(".halo-selected").remove();
          if (!selection) {
            detailPanel.selectAll(".selection-summary").remove();
            return;
          }
          const [[x0, y0], [x1, y1]] = selection;
          const selected = [];
          chart.selectAll("circle.data-point").each(function(d) {
            const sel = d3.select(this);
            const cx = +sel.attr("cx");
            const cy = +sel.attr("cy");
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
              sel.classed("selected", true)
                .attr("opacity", 1)
                .attr("stroke", "#000")
                .attr("stroke-width", 2);
              selected.push(d);
            }
          });
          // 在详情面板顶部显示选中数量
          detailPanel.selectAll(".selection-summary").remove();
          if (selected.length > 0) {
            detailPanel.insert("div", ":first-child")
              .attr("class", "selection-summary")
              .style("margin-bottom", "8px")
              .style("color", "#333")
              .html(`已刷选 ${selected.length} 个点`);
          }
        });
      // 将刷选层置于所有元素之下，避免遮挡点的点击与悬停
      chart.insert("g", ":first-child")
        .attr("class", "brush")
        .call(brush)
        .select(".overlay")
        .style("cursor", "default");

      // 异常值集合与标注
      const mpgOutliers = filtered.filter(d => Number.isFinite(d.CityMPG) && d.CityMPG > mpgThreshold);
      chart.selectAll("circle.data-point")
        .filter(d => mpgOutliers.indexOf(d) !== -1)
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", null)
        .attr("opacity", 1);


      // 异常油耗示意线（位于阈值位置，不与顶部重合）
      chart.append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yScale(mpgThreshold+3))
        .attr("y2", yScale(mpgThreshold+3))
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3")
        .attr("stroke-opacity", 0.85)
        .style("pointer-events", "none");

      chart.append("text")
        .attr("x", innerWidth - 4)
        .attr("y", yScale(mpgThreshold+3) - 8)
        .attr("text-anchor", "end")
        .attr("fill", "#e74c3c")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .text("⚠ 异常油耗: 1000 MPG");

      // 右侧外置图例：颜色（点击类型行进行筛选，多选；高度固定避免下移）
      if (!legendBuilt) {
        colorLegendSvg = legendContainer.append("svg")
          .attr("width", 220)
          .attr("height", 42 + typeDomain.length * 22);
        colorLegendSvg.append("text")
          .attr("class", "legend-title")
          .attr("x", 0)
          .attr("y", 20)
          .text("Color: Type");
        typeDomain.forEach((t, i) => {
          const row = colorLegendSvg.append("g")
            .attr("class", "legend-row")
            .datum(t)
            .attr("transform", `translate(0, ${36 + i * 22})`)
            .style("cursor", "pointer");
          row.append("circle")
            .attr("class", "legend-color-dot")
            .attr("r", 6)
            .attr("cx", 8)
            .attr("cy", 0)
            .attr("fill", typeColor(t))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("opacity", filters.types.has(t) ? 1 : 0.25);
          row.append("text")
            .attr("class", "legend-text")
            .attr("x", 22)
            .attr("y", 4)
            .attr("fill", filters.types.has(t) ? "#333" : "#888")
            .attr("font-weight", filters.types.has(t) ? "600" : "400")
            .text(t);
          row.on("click", function() {
            const type = d3.select(this).datum();
            if (filters.types.has(type)) {
              filters.types.delete(type);
            } else {
              filters.types.add(type);
            }
            render();
          });
        });
        // 密度模式开关（插入在颜色图例下方）
        const densityCtrl = d3.select('#legend-container').append('div')
          .attr('id', 'density-toggle')
          .style('margin', '6px 0 8px');
        const densityLabel = densityCtrl.append('label')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('gap', '8px')
          .style('font-weight', '600')
          .style('color', '#333');
        densityLabel.append('input')
          .attr('type', 'checkbox')
          .property('checked', densityMode)
          .on('change', function() {
            densityMode = !!this.checked;
            window.__DENSITY_MODE__ = densityMode;
            render();
          });
        densityLabel.append('span').text('Density mode');
      }

      // 右侧外置图例：大小
      const priceExtent = d3.extent(data, d => d.RetailPrice);
      const priceMedian = d3.median(data, d => d.RetailPrice);
      const sizeLegendValues = [priceExtent[0], priceMedian, priceExtent[1]].filter(Number.isFinite);
      let sizeLegendHeight = 24;
      sizeLegendValues.forEach(v => { sizeLegendHeight += sizeScale(v) * 2 + 12; });
      if (!legendBuilt) {
        // 尺寸控制滑杆（先插入，使其显示在 Size 图例上方）
        const sizeCtrl = d3.select('#legend-container').append('div')
          .attr('id', 'size-control')
          .style('margin', '0 0 6px');
        sizeCtrl.append('label')
          .style('display', 'block')
          .style('font-weight', '600')
          .style('color', '#333')
          .text('Size scale');
        sizeCtrl.append('input')
          .attr('type', 'range')
          .attr('min', 0.6)
          .attr('max', 1.8)
          .attr('step', 0.1)
          .property('value', sizeFactor)
          .on('input', function() {
            sizeFactor = parseFloat(this.value);
            window.__SIZE_FACTOR__ = sizeFactor;
            render();
          });

        // 再插入 Size 图例，使其位于滑杆下方
        sizeLegendSvg = legendContainer.append("svg")
          .attr("width", 220)
          .attr("height", Math.max(140, 160))
          .style("margin-bottom", "2px");
        sizeLegendSvg.append("text")
          .attr("class", "legend-title")
          .attr("x", 0)
          .attr("y", 16)
          .text("Size: Retail Price");
        // 直观示例：固定展示 10,000 与 30,000，并以最大真实价格为上限示例
        const priceMedian = d3.median(prices);
        const maxPriceLegend = d3.max(prices);
        sizeLegendValuesGlobal = [10000, 30000, maxPriceLegend].filter(Number.isFinite);
        let yOffset = 24;
        sizeLegendValuesGlobal.forEach(v => {
          const r = sizeScale(v);
          const g = sizeLegendSvg.append("g")
            .attr("class", "size-row")
            .datum(v)
            .attr("transform", `translate(0, ${yOffset})`);
          g.append("circle").attr("class", "size-icon").attr("r", r).attr("cx", r + 6).attr("cy", r).attr("fill", "#bbb").attr("opacity", 0.7).attr("stroke", "#888");
          g.append("text").attr("class", "size-text").attr("x", r * 2 + 16).attr("y", r + 4).attr("fill", "#333").text(`$${d3.format(",.0f")(v)}`);
          yOffset += r * 2 + 12;
        });
        legendBuilt = true;
      }

      // 更新图例的选中视觉状态（不改变布局）
      updateLegendState();
      updateSizeLegend(sizeScale);

      // 详情面板（侧栏中部）与浮动提示（只创建一次）
      let detailPanel = d3.select("#legend-container #detail-panel");
      if (detailPanel.empty()) {
        detailPanel = d3.select("#legend-container").append("div")
          .attr("id", "detail-panel");
        detailPanel.html(`
          <h3 style="margin:0;color:#333;">使用说明</h3>
          <div style="margin-top:8px;line-height:1.6;color:#555;">
            <p>散点图展示 <strong>马力</strong>(X) 与 <strong>城市油耗</strong>(Y，截断至60MPG) 的关系。</p>
            <p><strong>颜色</strong>代表车型类型，<strong>点大小</strong>代表零售价。</p>
            <p>将鼠标悬停查看提示，点击点在此面板显示详细信息。</p>
          </div>
        `);
      }

      // 已移除旧的复选筛选面板（类型/驱动）；筛选改由右侧 Color 图例承担

      let tooltip = d3.select(".tooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("pointer-events", "none")
          .style("background", "#fff")
          .style("border", "1px solid #ddd")
          .style("border-radius", "4px")
          .style("padding", "10px 12px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("opacity", 0);
      }

      points.on("mouseover.tooltip", function(d) {
          tooltip.style("opacity", 1)
            .html(`
              <div><strong>${d.Name || "未知车型"}</strong></div>
              <div>Type: ${d.Type || "N/A"}</div>
              <div>HP: ${Number.isFinite(d.Horsepower) ? d.Horsepower : "N/A"}</div>
              <div>City MPG: ${Number.isFinite(d.CityMPG) ? d.CityMPG : "N/A"}</div>
              <div>Price: $${Number.isFinite(d.RetailPrice) ? d3.format(",.0f")(d.RetailPrice) : "N/A"}</div>
            `);
        })
        .on("mousemove.tooltip", function() {
          tooltip.style("left", (d3.event.pageX + 12) + "px")
            .style("top", (d3.event.pageY - 24) + "px");
        })
        .on("mouseout.tooltip", function() {
          tooltip.style("opacity", 0);
        });
    }

    // 初次渲染与窗口自适应
    render();
    window.addEventListener('resize', render);
  }).catch(err => {
    console.error("Failed to load data:", err);
  });
}
