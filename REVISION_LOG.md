# PEVcast Revision Log

---

## 7.12.58 - 2026-07-08

> REVIEW ME: Auto-generated during version sync. Edit these notes before publishing if more detail or different grouping would help.

### Chart
- Updated chart rendering, annotations, labels, or weather overlays.

### Menu and Dialogs
- Updated menu options, About dialog controls, or app dialogs.

### Weather Data Popup
- Updated the Hourly Weather Data popup display, selection, or copy behavior.

### Locations
- Updated saved locations, GPS defaults, or reverse-geocoding behavior.

### API
- Updated browser-side API calls, fallback handling, or cache-busting behavior.

### Versioning
- Updated version automation, release notes, or cache-version syncing.

### Maintenance
- Updated application behavior in app.js.

---

## 7.12.57 - 2026-07-03

> REVIEW ME: Auto-generated during version sync. Edit these notes before publishing if more detail or different grouping would help.

### Chart
- Updated chart rendering, annotations, labels, or weather overlays.

### Menu and Dialogs
- Updated menu options, About dialog controls, or app dialogs.

### Weather Data Popup
- Updated the Hourly Weather Data popup display, selection, or copy behavior.

### Locations
- Updated saved locations, GPS defaults, or reverse-geocoding behavior.

### Maintenance
- Updated application behavior in app.js.
- Updated shared styling in styles.css.

---

## Unreleased

### Android Back Button
- Removed the `Close PEVcast?` confirmation prompt from the main-screen Back flow.
- Back still closes open menus and dialogs before requesting the app close.

---

## 7.12.56 - 2026-07-01

### Maintenance
- Updated application behavior in app.js.
- Updated the page shell or version metadata in index.html.
- Updated shared styling in styles.css.

---

## 7.12.55 - 2026-06-30

### Visible Range Defaults
- Added a `Save Visible Range` command to the app menu directly above `Chart Height`.
- Saving now stores the current chart range and Visible Hours slider stop as the user's default view.
- Restoring saved defaults now waits until after the chart layout is rebuilt, so the saved Visible Hours selection is not overwritten during page reload.
- Fixed reload behavior where the Visible Hours slider moved to the saved position but the chart itself still rendered at the previous hours scale.

### Point Details
- Removed the `Range Debug` row from the forecast summary below the chart.
- Reworked the `Point` details area into a larger, more readable weather-card style layout with time, temperature, feels-like temperature, precipitation, precipitation chance, wind, and day liquid accumulation.
- Removed the `Point:` caption and moved the Point details above the Total Rain / Total Snow / Wind Speed summary row.- On page load, the Point details now default to the current time from the chart, unless the user already clicked a chart point.
- Snow details now stay hidden unless there is measurable snow or the lowest temperature in the visible chart is below 34°F.

### External Tools
- Added a `SkyDiff` button next to `Chart Compare` that opens `https://bsacheri.github.io/FreeWeatherAPICompare/` in a new tab.

### Versioning
- Updated published app, service worker, and version metadata through `7.12.55`.

---

## 7.12.53 - 2026-05-24

### Android/PWA Navigation
- Changed the main-screen Back guard to use a real `#pevcast-main` history entry so Samsung/installed PWA Back handling has an in-app step to intercept.
- Kept the close confirmation behavior on the main chart screen while preserving normal closing after the user confirms.

### Tests
- Updated Playwright Back-button coverage to verify the hash-backed guard is armed after launch and re-armed after canceling the close prompt.

---

## 7.12.52 - 2026-05-24

### Android/PWA Navigation
- Re-armed the main-screen Back guard before showing the `Close PEVcast?` prompt so Back on first launch does not immediately close the app.
- Added an explicit app-close request when confirming the close prompt, with a history fallback for browser contexts.
- Prevented duplicate Back prompt handling while the close confirmation dialog is active.

### Tests
- Added Playwright coverage for first-launch Back guard state, canceling the close prompt, and accepting the close prompt after using the Range button.

---

## 7.12.51 - 2026-05-23

### Chart
- Added sticky left and right y-axis overlays so temperature and accumulation scales stay visible while using the Visible Hours horizontal scroll.
- Moved temperature labels back onto the gradient axis and tightened spacing between the gradient, chart plot area, and right-side accumulation axis.
- Added a menu-controlled chart height toggle with Short, Medium, and Tall modes.
- Improved maximized chart mode by hiding Chart Compare and repositioning the Visible Hours slider below floating controls on mobile.
- Refreshed chart resizing and rendering after maximize and layout changes so sticky axes stay aligned.

### Android/PWA Navigation
- Added Android/browser Back handling for PWA use.
- Back now closes open menus, dialogs, and subforms before leaving the main chart screen.
- Back on the main chart screen now prompts with `Close PEVcast?`.

### Locations and GPS
- Added a Cancel button to the Resolving GPS Location overlay.
- Canceling GPS restores the last loaded forecast/location and ignores late GPS results.
- Stopped automatic startup geolocation requests so browsers do not warn about geolocation outside a user gesture.
- Startup now uses saved GPS coordinates if available, otherwise falls back normally.
- Rounded reverse-geocode lookup coordinates before sending them to geocoding providers.

### Menu and Dialogs
- Changed the Locations menu section from collapsible to always open with a `Locations` heading.
- Moved the mobile `Use GPS` button beside the Quick Select dropdown and made it content-width instead of full-width.
- Added the Chart Height control to the menu.

### Tests
- Expanded Playwright coverage for Android Back behavior, sticky y-axes during visible-hours scrolling, GPS cancel behavior, startup geolocation behavior, mobile Quick Select/GPS layout, chart height cycling, and maximized mobile chart layout.

---

## 7.12.50 - 2026-05-14

### Chart Layout
- Added mobile-aware temperature gradient sizing through `getGradientWidth()`, keeping the full desktop gradient while using a narrower mobile gradient.
- Applied the responsive gradient width across the chart plugin, axis overlay, custom scale, DOM gradient, and separate-canvas color bar render paths.
- Moved the Visible Hours control and chart above the forecast summary box so chart controls stay directly with the chart.
- Tightened chart and app container sizing with max-width and overflow constraints to prevent mobile horizontal scrolling.

### Mobile Header and Controls
- Reworked mobile header and control grid constraints so Quick Select, search, GPS, radar, and action controls stay within the viewport.
- Added mobile max-width bounds for floating header buttons to prevent off-screen overlap.

### Versioning
- Bumped app, cache, and version metadata from `7.12.49` to `7.12.50`.

---

## 7.12.49 - 2026-05-13

> REVIEW ME: Auto-generated during version sync. Edit these notes before publishing if more detail or different grouping would help.

### Chart
- Updated chart rendering, annotations, labels, or weather overlays.

### Menu and Dialogs
- Updated menu options, About dialog controls, or app dialogs.

### Weather Data Popup
- Updated the Hourly Weather Data popup display, selection, or copy behavior.

### Locations
- Updated saved locations, GPS defaults, or reverse-geocoding behavior.

### Maintenance
- Updated application behavior in app.js.
- Updated the page shell or version metadata in index.html.
- Updated shared styling in styles.css.

---

## 7.12.49 - 2026-05-12

### Chart
- Changed the Visible Hours slider to use evenly spaced snapped stops while preserving the actual hour labels and zoom values.
- Hid `Day Accum (Snow)` in the point status line when the visible temperature range is above the snow-display threshold.
- Combined the top metrics and bottom point/debug summaries into one summary box above the chart.
- Added a GPS resolving overlay, longer startup GPS timeout, retry prompt on GPS timeout, and deterministic Moon Township fallback instead of loading the first Quick Select item.
- Reworked the mobile header controls into a cleaner app-style layout with full-width Quick Select and a compact search/action row.

---

## 7.12.48 - 2026-05-09

### Locations
- Restored vertical scrolling in the mobile Quick List editor by allowing pan-y behavior in the rows area.
- Increased the mobile city name column to about 60% width.
- Kept the three sort buttons grouped on one row with compact labels.

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













