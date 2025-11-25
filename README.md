# DataVis Assignment 2 · Car Performance Scatterplot

## Participants
- Author: Yifan Li

## Project Overview
This project is a static web visualization demonstrating a scatterplot of car performance:
- X-axis: Horsepower (HP)
- Y-axis: City MPG (truncated to 60 MPG)
- Color: Car type
- Size: Retail price

The dataset `cars.csv` contains some known inconsistencies and outliers that are handled explicitly in the visualization.

## Project Structure
- `index.html`: Entry page and layout container (header, plot area, legend panel)
- `style.css`: Styles for header, layout, legends, detail panel, tooltip
- `main.js`: D3 logic for data parsing, scales, rendering, interactivity
- `d3.v5.min.js`: D3.js v5 runtime
- `cars.csv`: Sample dataset

Key file references:
- Layout container: `index.html:29–32`
- Visualization logic: `main.js:76–626`
- Styles for header/subtitle: `style.css:8–24`
- Sidebar and tooltip styles: `style.css:53–68`

## Core Features
- Color legend with type filtering by clicking rows (`main.js:450–491`)
- Size legend with a scale slider to adjust symbol sizes (`main.js:520–540`, `main.js:541–567`)
- Optional density mode toggle for 2D density contours under points (`main.js:492–511`, `main.js:188–210`)
- Tooltips on hover and detailed info panel on selection (`main.js:586–620`, `main.js:286–371`)
- Brushing selection with selected count summary (`main.js:373–411`)
- Outlier highlighting and guide line annotation (`main.js:419–448`)
- Responsive layout and adaptive tick density (`main.js:150–161`, `main.js:80–85`)

## Scatterplot Implementation
- Data parsing: Convert numeric fields and normalize types (`main.js:3–15`)
- Scales: 
  - X linear with padded domain to avoid edge collisions (`main.js:127–133`)
  - Y linear inverted for top-down orientation and truncated values (`main.js:134–141`)
  - Size log scale with global persistence factor (`main.js:142–149`, `main.js:41–44`)
- Rendering:
  - Jittered dots with white stroke for separation (`main.js:266–285`)
  - Neon halo effects on hover/selection using computed hues (`main.js:102–111`, `main.js:286–355`)
  - Optional density contours beneath points (`main.js:188–210`)
- Interactions:
  - Legend-based filtering maintains axis domains to avoid jumping (`main.js:228–230`)
  - Vertical dodge to reduce overlapping points on same pixel rows (`main.js:231–265`)
  - Brushing updates selection and detail summary (`main.js:373–411`)

## Local Development
Pre-requisite: [Node.js](https://nodejs.org/en). Install `serve` using:
> npm install serve --global

Start a local server:
> serve -p 8000

Open in browser: [http://localhost:8000](http://localhost:8000)

## Deployment (GitHub Pages)
Use the repository root as the Pages source:
- Repository → Settings → Pages
- Source: Deploy from a branch
- Branch: `main`, folder: `/(root)`
- Wait for publishing, then open `https://<username>.github.io/<repo>/`

## AI Tool Usage & Experience
- Tool: IDE-integrated AI assistant (Trae AI)
- Usage: Assisted with UI text translation to English, legend interactions refinement, density and halo effects tuning, and documentation updates.
- Experience: Accelerated iteration and editing across files; reliable for patching and code navigation, with manual verification for visual design and user experience.

## Debugging Tips
Use your browser’s developer tools:
- Check the console for errors (`console.log`) and D3 warnings
- Verify network requests for `cars.csv` are status 200 and correctly relative (same-origin)