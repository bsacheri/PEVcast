# PEVcast 🌤️

A sophisticated, real-time weather forecasting dashboard that visualizes hourly and daily weather data with interactive chart analysis.

**Current Version:** 7.12.24  
**Last Updated:** March 17, 2026

---

## Features

- **Multi-view Forecasting**: Toggle between 24-hour, 72-hour, 168-hour, and maximum available forecast ranges
- **Dynamic Weather Visualization**:
  - Temperature trends with daily high/low markers
  - Precipitation (rain & snow) with intelligent ratio scaling
  - Wind speed and direction with multiple display modes
  - Cloud cover and precipitation probability
  
- **Smart Snow Accumulation**: 
  - Auto mode calculates volume conversion based on temperature
  - Manual ratio options (8:1, 10:1, 12:1, 15:1)
  
- **Wind Display Modes**:
  - Speed Line: Dashed line with daily high/low labels
  - Barbs: Meteorological barbs with intensity color coding
  - Arrows: Direction arrows with speed-based coloring
  - Overlay: Background color intensity by wind speed
  
- **Theme Support**: Light and dark mode with theme-aware colors
- **Global City Selection**: 15+ preset cities or custom location search
- **GPS Integration**: Get weather for your device's location
- **Interactive Tooltips**: Click any hour to see detailed weather breakdown
- **Responsive Design**: Works on desktop and touch devices
- **Test Mode**: Offline testing with pre-loaded forecast data

---

## Getting Started

### Quick Setup
1. Clone or download the repository
2. Open `index.html` in a modern web browser
3. Select a city or use GPS to load weather data
4. Explore forecasts with the range and layout controls

### No Installation Required
PEVcast is a standalone web app with no build process or dependencies to install.

---

## Requirements

- **Browser**: Any modern browser with ES6+ support
  - Chrome/Edge 90+
  - Firefox 88+
  - Safari 14+
- **Internet**: Required for real-time weather data (Open-Meteo API)
- **JavaScript**: Must be enabled

---

## Usage

### Main Controls

| Control | Purpose |
|---------|---------|
| **City Search** | Find weather by city name or select from 15 preset cities |
| **Range Toggle** | Switch between 24h, 72h, 168h, or Max forecast duration |
| **Layout Mode** | Choose Fit (responsive) or Scroll (fixed width) |
| **Dark/Light Theme** | Toggle between themes |
| **Wind Display** | Select wind visualization mode (Line, Barbs, Arrows, Overlay, Off) |
| **Test Mode** | Load pre-recorded forecast data (offline testing) |
| **Gradient Mode** | Customize temperature gradient visualization |

### Interactive Features
- **Click any hour** on the chart to see detailed breakdown (status line below chart)
- **Hover** to see the cursor position indicator
- **Zoom/Pan** supported in scroll layout mode
- **Day labels** appear automatically for multi-day views

---

## Data Source

PEVcast uses the **Open-Meteo API** for weather data:
- ✅ No authentication required
- ✅ Free tier available
- ✅ 16-day forecast capability
- ✅ Global coverage
- ✅ High-resolution hourly data

Visit: [https://open-meteo.com](https://open-meteo.com)

---

## File Structure

```
PEVcast/
├── app.js              # Main application logic (600+ lines)
├── index.html          # DOM structure and UI
├── styles.css          # Theming and layout
├── .vscode/
│   └── launch.json     # VS Code F5 debug configuration
├── .copilot/
│   └── instructions.md # Development guidelines
└── README.md           # This file
```

### Key Components
- **Chart.js v4.4.1** - Core charting library
- **Chart.js Plugins** - Custom visualization layers:
  - Temperature color gradient bar
  - Diagonal hatching for past 4 hours
  - Day labels on multi-day views
  - Wind speed labels
  - Wind barbs, arrows, and overlay rendering

---

## Version History

| Version | Release Date | Notable Changes |
|---------|--------------|-----------------|
| 7.12.24 | Mar 17, 2026 | Added wind speed labels to speed line, custom canvas plugin |
| 7.12.20 | Mar 17, 2026 | Daily wind speed range display (high/low with MPH) |
| 7.12.15 | Mar 17, 2026 | Wind display modes (barbs, arrows, overlay, line) |
| 7.11.0  | Earlier      | Initial development |

---

## Development Notes

- All file versions track increments (0.001 per change) in:
  - File headers (`// app.js @version X.X.XX`)
  - HTML version object
  - Console startup message
- Uses vanilla JavaScript (ES6+) with no frameworks
- Responsive design with CSS custom properties for theming
- Plugin-based architecture for Chart.js extensibility

---

## Browser Console

On startup, the console logs the version for quick reference:
```
[WeatherApp] app.js 7.12.24
```

---

## Tips & Tricks

- **Multiple days?** Day-of-week labels appear automatically on the top axis
- **Offline testing?** Enable Test Mode to load pre-recorded forecast data
- **Custom cities?** Search by city name (e.g., "Denver, CO") for any location
- **Precision readings?** Click a specific hour for detailed breakdown in the status line below the chart
- **Dark mode?** Automatically respects your system preference on first load

---

## License & Attribution

Built with Open-Meteo weather data API.

---

**Have questions or feature requests?** Check the `.copilot/instructions.md` file for development context.
