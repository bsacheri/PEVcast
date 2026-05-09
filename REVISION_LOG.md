# PEVcast Revision Log

---

## 7.12.47 - 2026-05-09

### Weather Data Popup
- Allowed the Weather Data popup to rotate naturally on mobile.
- Adjusted mobile popup sizing to use the small viewport height for better browser-chrome handling.

### Locations
- Made the Quick List editor full screen on mobile.
- Tightened the mobile Quick List row layout with a no-margin star column and about 40% width for city names.
- Stacked coordinates on mobile to preserve horizontal space.
- Replaced the Drag and Delete text buttons with icon buttons.

---
## 7.12.46 - 2026-05-09

### Chart
- Made x-axis hour label density adapt to the actual rendered canvas width so zoomed 7d/15d views can show more hour labels.
- Fixed the yellow *now* line so it uses the fractional current time instead of snapping forward to the next hour.
- Adjusted past-hour hatching to cover only completed prior hours and avoid extending into the future.
- Expanded the hatching pattern so diagonal lines fill the entire shaded area without blank corner triangles.
- Changed *day* column headings so dates (*m/d*) appear only for past days or days more than five days in the future.

### Weather Data Popup
- Added default and click-based column selection with full-column highlighting.
- Added a Weather symbol row, temperature gradient cell backgrounds, wind direction arrows, and larger arrows for stronger wind.
- Moved Chance (%) above Precip (mm) and renamed Wind Dir formatting from degrees to arrows.
- Updated column headers to show `ddd m/d` with the time on a second line.
- Changed selected-column highlighting to light yellow and centered the selected hour when the popup opens.
- Made the popup full screen on mobile/coarse-pointer devices and responsive to phone rotation.
- Added night shading to top header cells between sunset and sunrise.
- Added a Now button that selects the current/current-previous hour and scrolls it to center.
- Sanitized copied table data so embedded carriage returns/newlines are replaced with spaces.
- Allowed clicking any cell in the Weather Data table to select and highlight that entire column.

### Locations
- Added a Locations submenu for saving defaults, enabling GPS default mode, saving to the Quick List, and editing saved locations.
- Moved Quick List storage into local storage with first-run seeding from the built-in locations.
- Added a Quick List editor with rename, delete, sort A-Z, sort west-east, sort north-south, default-location stars, and mobile-friendly drag/drop reordering.
- Improved drag/drop feedback with an insertion line showing where the location will drop.
- Removed star button backgrounds, dimmed unselected stars, and kept city-name inputs readable in dark mode.
- Changed startup behavior to prefer saved defaults or GPS instead of hard-coding Moon Township.
- Improved GPS labels to include town/street/ZIP when reverse geocoding provides them.
- Changed GPS labels to prefer city/town names over street names when a city is available.
- Added cached reverse-geocode results and a Nominatim fallback when BigDataCloud reverse geocoding fails.
- Added a known-area ZIP correction so Moon/Carnot-Moon/Coraopolis coordinates near `40.520, -80.241` show `15108`.
- Updated reverse-geocode cache keying so stale provider labels such as the incorrect `15231` ZIP are bypassed.

### Search
- Allowed the city/ZIP field to accept coordinate pairs such as `40.520, -80.241`.
- Reused the GPS-style reverse name lookup for coordinate searches.
- Updated the search field placeholder and tooltip to advertise city, ZIP, and coordinate searches.

### Menu and Dialogs
- Defaulted new users to light mode when no saved theme exists.
- Replaced the Wind Display dropdown with a persisted Wind Speed Line checkbox.
- Renamed Feels Like Overlay to Feels Like Line and persisted that preference.
- Removed advanced gradient controls, Sunrise/Sunset, Wind Display dropdown, and hid Snow Ratio from the menu.
- Added Clear Cache to the About dialog with a confirmation that lists settings that will be cleared.
- Added Show Revision Log to the About dialog with a safe markdown viewer.
- Added Nominatim Reverse Geocoding to the About API list.

### API
- Kept weather loading independent from reverse-geocode failures.
- Added clearer console warnings when reverse-geocode providers fail.
- Cached successful GPS place-name lookups by rounded coordinates to reduce repeat provider calls.

### Versioning
- Added this root-level `REVISION_LOG.md` with newest entries first.
- Updated version automation to generate grouped revision-log entries when app versions change.
- Added `REVIEW ME` markers to generated revision-log entries.
- Updated version automation to stage `REVISION_LOG.md` with other version metadata.
- Added markdown horizontal-rule support to the in-app revision-log viewer and future generated entries.
- Added a README pointer to the detailed revision log while keeping the existing brief Version History table.
---
## 7.12.45 - 2026-05-01

### Chart
- Updated chart controls and version documentation.
- Continued improvements around visible-hour controls, range handling, and chart interaction polish.

### Versioning
- Kept app version metadata aligned across `app.js`, `index.html`, `version.json`, and service-worker cache metadata.
---
## 7.12.44 - 2026-04-29

### Chart
- Added visible-hours slider tick labels and range-specific snapping controls.
- Improved precipitation chance fill styling.
- Added mobile tooltip auto-hide behavior.

### Weather Data Popup
- Improved Weather Data modal mapping and QA behavior.

### Chart Compare
- Added daily sunrise/sunset payload support for chart comparison.
---
## 7.12.x - 2026-04

### Versioning
- Added git hook version automation.
- Aligned service-worker cache versioning with app version metadata.
- Added update-check workflow and published version metadata.

### Chart Compare
- Added chart engine comparison page.
- Improved comparison chart interactions and axis behavior.
- Added temperature color encoding and Nivo rain bar rendering.

### PWA
- Updated GitHub Pages PWA `start_url` and scope handling.
---
## 7.12.35 - 2026-03-31

### Weather Data Popup
- Added Weather Data highlighting and copy behavior.

### Chart
- Added dynamic precipitation bars.

### Versioning
- Bumped published app version metadata.
---
## 7.12.34 - 2026-03-30

### Chart
- Fixed Visible Hours slider behavior when returning to the minimum setting so the chart returns to fit mode cleanly.
---
## 7.12.33 - 2026-03-30

### Chart
- Restored the canvas width attribute when the slider returns to the minimum setting.
---
## 7.12.32 - 2026-03-30

### PWA
- Fixed GitHub Pages PWA `start_url`.

### Locations
- Added city latitude/longitude hover tooltip and mobile long-press support.
---
## 7.12.31 - 2026-03-28

### Locations
- Added reverse geocoding for GPS-selected locations.

### Menu and Dialogs
- Added radar button near search.
- Adjusted city input layout.
---
## 7.12.30 - 2026-03-27

### Versioning
- Set `CODE_UPDATED` to the actual publish date/time.
---
## 7.12.24 - 2026-03-17

### Chart
- Added wind speed labels to the speed line using a custom canvas plugin.
---
## 7.12.20 - 2026-03-17

### Chart
- Added daily wind speed high/low display.
---
## 7.12.15 - 2026-03-17

### Chart
- Added wind display modes including barbs, arrows, overlay, and line rendering.
---
## 7.11.0 - Earlier

### Maintenance
- Initial PEVcast development.


