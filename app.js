// app.js @version 7.12.46
// Consolidated, verified build restoring ALL agreed features:
// - Menu: stays open for interactions; closes on outside click and Weather Data only.
// - Header Snow Ratio removed (#snowRatio and related labels), menu Snow Ratio present (Auto/8/10/12/15) and authoritative via getSnowRatio().
// - Gradient: modes (plugin/dom/axis-overlay/custom-scale/separate-canvas/off), width presets (38/64/96/128), left reserve (0/40/80/120).
// - Past 4h overlay; Midnight line (dark=rgba(255,255,255,0.5); light=#000).
// - Sunrise/Sunset lines + day/night shading restored (addDayNightBoxesAligned).
// - Test Mode resolver tolerant of window/globalThis/bare TEST_MODE_DATA and TEST_MODE_DATA_AVAILABLE; test_data.json fallback; no popup if any dataset.
// - Weather Data modal (columns=hours, rows=metrics) for mapping QA.
// - GPS dark-mode contrast; right-header reserved space; maximize button; hour ticks; chart data labels for day min/max.
// - Visible version markers: UI label and console stamp; optional Test Mode footer chip with version.

(function(){ try{ window.APP_VERSION='7.12.46'; console.info('[WeatherApp] app.js', window.APP_VERSION); }catch(e){} })();
const CODE_UPDATED = '05/09/2026 1:06 AM';
(function(){ const _lu=document.getElementById('lastUpdated'); if(_lu) _lu.textContent='- Code updated: '+CODE_UPDATED; })();

function generateCodeUpdateTimestamp(){ const now=new Date(); const mon=String(now.getMonth()+1).padStart(2,'0'); const day=String(now.getDate()).padStart(2,'0'); const yr=now.getFullYear(); let h=now.getHours(); const m=String(now.getMinutes()).padStart(2,'0'); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${mon}/${day}/${yr} ${h}:${m} ${ap}`; }

let chart;
let SHOW_SUNRISE_SUNSET = false; // Toggle sunrise/sunset lines on chart
let isDark = localStorage.getItem('PEVcast-dark-mode') !== null ? JSON.parse(localStorage.getItem('PEVcast-dark-mode')) : false;
let TEST_MODE_ENABLED = false;
let currentDataset = null;
let currentLocationLat = null; // Current location latitude for radar
let currentLocationLon = null; // Current location longitude for radar
let currentCityName = ''; // Current city for reloading with past_days
let pastDays = 0; // Past days to include (0-92); 0=forecast only, 3/7/14=with history
const PAST_DAYS_CYCLE = [0, 3, 7, 14]; // Cycle through these values on shift-click

// Range modes: 24h → 72h → 168h → Max → 24h
const RANGE_STATES = [24, 72, 168, 'max'];
let rangeIndex = 0; // start at 24h
const MIN_TEMP_THRESHOLD_FOR_SNOW = 33; // Hide snow data when min temp exceeds this
const MAX_WIND_DISPLAY = 40; // Maximum wind speed (mph) displayed at top of chart
const MIN_VISIBLE_HOURS = 12; // Never zoom tighter than 12 visible hours
const MOBILE_TOOLTIP_HIDE_DELAY_MS = 1500;

let snowRatioMode = 'Auto'; // 'Auto' | '8' | '10' | '12' | '15'
let LAYOUT_MODE = 'fit';    // 'fit' | 'scroll'
let LAYOUT_SCROLL_SCALE = 1.0; // Width scale multiplier for scroll mode (0.1 - 1.2)
let lastClickedIndex = null; // Last clicked chart data index for scroll-centering
let lastClickedTime = null; // Last clicked chart time for Weather Data column selection
let mobileTooltipTimer = null;
const FEELS_LIKE_LINE_STORAGE_KEY = 'PEVcast-feels-like-line';
let APPARENT_OVERLAY_ENABLED = localStorage.getItem(FEELS_LIKE_LINE_STORAGE_KEY) !== null ? JSON.parse(localStorage.getItem(FEELS_LIKE_LINE_STORAGE_KEY)) : false;
const WIND_SPEED_LINE_STORAGE_KEY = 'PEVcast-wind-speed-line';
let WIND_SPEED_LINE_ENABLED = localStorage.getItem(WIND_SPEED_LINE_STORAGE_KEY) !== null ? JSON.parse(localStorage.getItem(WIND_SPEED_LINE_STORAGE_KEY)) : true;
let WIND_DISPLAY_MODE = WIND_SPEED_LINE_ENABLED ? 'line' : 'off'; // 'off' | 'line' | 'barbs' | 'overlay' | 'arrows'
const REVERSE_GEOCODE_CACHE_STORAGE_KEY = 'PEVcast-reverse-geocode-cache-v1';

// Gradient render modes
// 'plugin' | 'dom' | 'axis-overlay' | 'custom-scale' | 'separate-canvas' | 'off'
let GRADIENT_MODE = 'custom-scale';
let GRADIENT_WIDTH = 96; // px, user selectable
let GRADIENT_EXTRA_LEFT = 40; // px extra left padding

const TEST_DATA_URL = './test_data.json';

const QUICK_SELECT_CITIES = {
  "Yakutat, AK": { lat: 59.546, lon: -139.727 },
  "St. John's, NL": { lat: 47.5615, lon: -52.7126 },
  "Seattle, WA": { lat: 47.6062, lon: -122.3321 },
  "Syracuse, NY": { lat: 43.0481, lon: -76.1474 },
  "Erie, PA": { lat: 42.1292, lon: -80.0851 },
  "Moon Township, PA": { lat: 40.5162, lon: -80.221 },
  "Columbus, OH": { lat: 39.9612, lon: -82.9988 },
  "Pittsburgh, PA": { lat: 40.4406, lon: -79.9959 },
  "Washington, DC": { lat: 38.9072, lon: -77.0369 },
  "New York City, NY": { lat: 40.7128, lon: -74.006 },
  "Boston, MA": { lat: 42.3601, lon: -71.0589 },
  "Portland, OR": { lat: 45.5152, lon: -122.6784 },
  "Phoenix, AZ": { lat: 33.4484, lon: -112.074 },
  "Tucson, AZ": { lat: 32.2226, lon: -110.9747 },
  "Hilo, HI": { lat: 19.7297, lon: -155.09 },
  "Denver, CO": { lat: 39.7392, lon: -104.9903 },
  "Houston, TX": { lat: 29.7604, lon: -95.3698 },
  "New Orleans, LA": { lat: 29.9511, lon: -90.2623 },
  "Cleveland, OH": { lat: 41.4993, lon: -81.6954 },
  "Orlando, FL": { lat: 28.5421, lon: -81.3774 },
  "Toronto, ON": { lat: 43.6532, lon: -79.3832 }
};

const LOCATIONS_STORAGE_KEY = 'PEVcast-locations-v1';
const DEFAULT_LOCATION_STORAGE_KEY = 'PEVcast-default-location-v1';

function $(id){ return document.getElementById(id); }
function setCityTitle(name){ const el=$("cityTitle"); if(!el) return; el.textContent = name; const lat=currentLocationLat, lon=currentLocationLon; if(lat!=null && lon!=null){ el.title=`${lat.toFixed(4)}, ${lon.toFixed(4)}`; el.style.cursor='help'; } else { el.title=''; el.style.cursor=''; } }

function initCityTitleTooltip(){
  const el=$("cityTitle");
  if(!el || el.dataset.tooltipWired) return;
  el.dataset.tooltipWired = '1';
  let popup = document.getElementById('coordsPopup');
  if(!popup){ popup=document.createElement('div'); popup.id='coordsPopup'; popup.className='coords-popup hidden'; document.body.appendChild(popup); }
  let pressTimer=null, hideTimer=null;
  function showPopup(){
    const lat=currentLocationLat, lon=currentLocationLon;
    if(lat==null||lon==null) return;
    popup.textContent=`${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    clearTimeout(hideTimer);
    // Position below the city title using fixed coords
    const r=el.getBoundingClientRect();
    popup.style.top=(r.bottom+6)+'px';
    popup.style.left=r.left+'px';
    popup.classList.remove('hidden');
    hideTimer=setTimeout(hidePopup, 2500);
  }
  function hidePopup(){ popup.classList.add('hidden'); clearTimeout(hideTimer); }
  el.addEventListener('touchstart',()=>{ clearTimeout(pressTimer); pressTimer=setTimeout(showPopup, 500); },{passive:true});
  el.addEventListener('touchend',()=>{ clearTimeout(pressTimer); },{passive:true});
  el.addEventListener('touchmove',()=>{ clearTimeout(pressTimer); },{passive:true});
  document.addEventListener('touchstart',(e)=>{ if(!popup.classList.contains('hidden')&&e.target!==el&&!popup.contains(e.target)) hidePopup(); },{passive:true});
}

// ---------- Saved Locations ----------
function createLocationId(){ return `loc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function normalizeLocation(loc){
  if(!loc) return null;
  const name=String(loc.name||'').trim();
  const lat=Number(loc.lat);
  const lon=Number(loc.lon);
  if(!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { id: String(loc.id||createLocationId()), name, lat, lon };
}
function getSeedLocations(){
  return Object.entries(QUICK_SELECT_CITIES)
    .sort((a,b)=>a[1].lon-b[1].lon)
    .map(([name, coords])=>normalizeLocation({ id:`seed-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`, name, lat:coords.lat, lon:coords.lon }))
    .filter(Boolean);
}
function readStoredJson(key){
  try{ const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }catch{ return null; }
}
function writeStoredJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function readSavedLocations(){
  const raw=readStoredJson(LOCATIONS_STORAGE_KEY);
  const list=Array.isArray(raw) ? raw.map(normalizeLocation).filter(Boolean) : [];
  if(list.length) return list;
  const seeded=getSeedLocations();
  writeSavedLocations(seeded);
  return seeded;
}
function writeSavedLocations(locations){ writeStoredJson(LOCATIONS_STORAGE_KEY, (locations||[]).map(normalizeLocation).filter(Boolean)); }
function readDefaultLocation(){
  const raw=readStoredJson(DEFAULT_LOCATION_STORAGE_KEY);
  if(!raw || typeof raw!=='object') return null;
  if(raw.mode==='gps') return { mode:'gps', name:raw.name||'', lat:Number(raw.lat), lon:Number(raw.lon), savedAt:raw.savedAt||null };
  if(raw.mode==='saved') return { mode:'saved', locationId:raw.locationId||null, name:raw.name||'', lat:Number(raw.lat), lon:Number(raw.lon), savedAt:raw.savedAt||null };
  return null;
}
function writeDefaultLocation(value){ writeStoredJson(DEFAULT_LOCATION_STORAGE_KEY, value); }
function clearDefaultLocation(){ localStorage.removeItem(DEFAULT_LOCATION_STORAGE_KEY); }
function findSavedLocationById(id){ return readSavedLocations().find(loc=>loc.id===id) || null; }
function coordsAreNear(a,b){ if(!a||!b) return false; return Math.abs(Number(a.lat)-Number(b.lat))<=0.02 && Math.abs(Number(a.lon)-Number(b.lon))<=0.02; }
function findDuplicateLocation(loc, locations=readSavedLocations()){
  const name=(loc?.name||'').trim().toLowerCase();
  return locations.find(saved=>saved.name.trim().toLowerCase()===name || coordsAreNear(saved, loc)) || null;
}
function currentLocationRecord(){
  if(currentLocationLat==null || currentLocationLon==null) return null;
  return normalizeLocation({ name: currentCityName || $('cityTitle')?.textContent || 'Current Location', lat: currentLocationLat, lon: currentLocationLon });
}
function syncGpsDefaultCheckbox(){
  const box=$('mGpsDefault');
  if(box) box.checked = readDefaultLocation()?.mode === 'gps';
}
function saveCurrentLocationAsDefault(){
  const loc=currentLocationRecord();
  if(!loc){ alert('No current location is loaded yet.'); return; }
  const match=findDuplicateLocation(loc);
  writeDefaultLocation({ mode:'saved', locationId:match?.id||null, name:loc.name, lat:loc.lat, lon:loc.lon, savedAt:new Date().toISOString() });
  syncGpsDefaultCheckbox();
  alert(`${loc.name} saved as default.`);
}
function saveGpsDefault(enabled){
  if(enabled) writeDefaultLocation({ mode:'gps', savedAt:new Date().toISOString() });
  else if(readDefaultLocation()?.mode==='gps') clearDefaultLocation();
  syncGpsDefaultCheckbox();
}
function saveCurrentLocationToQuickList(){
  const loc=currentLocationRecord();
  if(!loc){ alert('No current location is loaded yet.'); return; }
  const locations=readSavedLocations();
  const duplicate=findDuplicateLocation(loc, locations);
  if(duplicate){
    const choice=prompt(`"${duplicate.name}" already looks like this location.\nType U to update it, A to add anyway, or C to cancel.`, 'U');
    const action=(choice||'').trim().toUpperCase();
    if(action==='C' || action==='') return;
    if(action==='U'){
      const updated=locations.map(item=>item.id===duplicate.id ? {...item, name:loc.name, lat:loc.lat, lon:loc.lon} : item);
      writeSavedLocations(updated);
      populateQuickSelectSorted();
      alert(`${loc.name} updated in Quick List.`);
      return;
    }
    if(action!=='A') return;
  }
  locations.push({...loc, id:createLocationId()});
  writeSavedLocations(locations);
  populateQuickSelectSorted();
  alert(`${loc.name} saved to Quick List.`);
}
function requestDeviceLocation(){
  return new Promise((resolve, reject)=>{
    if(!navigator.geolocation){ reject(new Error('Geolocation not supported by this browser.')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy:true, timeout:8000, maximumAge:300000});
  });
}
async function loadGpsLocation(saveAsDefault=false){
  const pos=await requestDeviceLocation();
  const {latitude:lat, longitude:lon}=pos.coords||{};
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('GPS did not return valid coordinates.');
  return loadCoordinatesLocation(lat, lon, saveAsDefault);
}
async function loadCoordinatesLocation(lat, lon, saveAsDefault=false){
  lat=Number(lat); lon=Number(lon);
  if(!isValidCoordinate(lat, lon)) throw new Error('Coordinates must be valid latitude and longitude values.');
  const resolved=await reverseGeocode(lat, lon);
  const name=resolved||`My Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
  if(saveAsDefault) writeDefaultLocation({ mode:'gps', name, lat, lon, savedAt:new Date().toISOString() });
  await loadCityByName(name, {lat, lon});
  return {name, lat, lon};
}
function parseCoordinateSearch(query){
  const text=String(query||'').trim();
  const match=text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s+(-?\d+(?:\.\d+)?)\s*$/);
  if(!match) return null;
  const lat=Number(match[1]), lon=Number(match[2]);
  return isValidCoordinate(lat, lon) ? {lat, lon} : null;
}

// ---------- Test Mode data resolution ----------
async function tryLoadFixture(){
  try{
    const res = await fetch(TEST_DATA_URL, {cache:'no-store'});
    if(!res.ok) return null;
    const j = await res.json();
    if (j && j.hourly && j.daily && j.hourly.time && j.daily.time){
      return buildDataFromLive(j);
    }
    if (j && Array.isArray(j.hourly) && Array.isArray(j.daily)){
      return normalizeLegacyDatasetToMm(j);
    }
    return null;
  }catch(e){ return null; }
}

function pickFromBag(bag, cityName){
  if (!bag || typeof bag !== 'object') return null;
  if (bag[cityName]) return bag[cityName];
  const keys = Object.keys(bag);
  if (keys.length === 0) return null;
  if (keys.length === 1) return bag[keys[0]];
  const lc = cityName.toLowerCase();
  const k = keys.find(x => x.toLowerCase() === lc)
        || keys.find(x => x.toLowerCase().startsWith(lc.split(',')[0]));
  return bag[k] || bag[keys[0]];
}

function resolveLegacyTestData(cityName){
  try{
    const bagWin = (typeof window!== 'undefined') ? (window.TEST_MODE_DATA || null) : null;
    const bagGlob = (typeof globalThis!== 'undefined' && typeof globalThis.TEST_MODE_DATA !== 'undefined') ? globalThis.TEST_MODE_DATA : null;
    const bag = bagWin || bagGlob;
    const availFlag = (typeof window!=='undefined' && window.TEST_MODE_DATA_AVAILABLE) ? true : false;
    if (!bag && !availFlag) return null;
    const candidate = bag || (typeof TEST_MODE_DATA !== 'undefined' ? TEST_MODE_DATA : null);
    if (!candidate) return null;
    return pickFromBag(candidate, cityName);
  }catch{ return null; }
}

function normalizeLegacyDatasetToMm(dataset){
  if(!dataset || !Array.isArray(dataset.hourly) || !Array.isArray(dataset.daily)) return dataset;
  return {
    ...dataset,
    hourly: dataset.hourly.map(h => ({
      ...h,
      precipIn: h?.precipIn != null ? h.precipIn * 25.4 : h?.precipIn,
      rainIn: h?.rainIn != null ? h.rainIn * 25.4 : h?.rainIn,
      snowIn: h?.snowIn != null ? h.snowIn * 25.4 : h?.snowIn
    })),
    daily: dataset.daily.map(d => ({
      ...d,
      totalPrecipIn: d?.totalPrecipIn != null ? d.totalPrecipIn * 25.4 : d?.totalPrecipIn,
      totalSnowIn: d?.totalSnowIn != null ? d.totalSnowIn * 25.4 : d?.totalSnowIn
    }))
  };
}

async function loadWeatherData(cityName, lat, lon, pastDaysParam=0){
  if (TEST_MODE_ENABLED){
    const bagData = resolveLegacyTestData(cityName); if (bagData) return normalizeLegacyDatasetToMm(bagData);
    const fix = await tryLoadFixture(); if (fix) return fix;
    if (typeof window !== 'undefined' && window.TEST_DATA && window.TEST_DATA.hourly && window.TEST_DATA.daily){
      return normalizeLegacyDatasetToMm(window.TEST_DATA);
    }
    throw new Error('Test Mode: No TEST_MODE_DATA / test_data.json / TEST_DATA found.');
  }
  const apiData = await fetchForecastLive(lat, lon, pastDaysParam); return buildDataFromLive(apiData);
}

// ---------- Open-Meteo live fetch ----------
async function geocodeCity(query){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url); if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json(); return data.results || [];
}
async function fetchForecastLive(lat, lon, pastDaysParam=0){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&hourly=temperature_2m,apparent_temperature,precipitation,rain,snowfall,wind_speed_10m,wind_direction_10m,precipitation_probability`
    + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunrise,sunset`
    + `&timezone=auto&forecast_days=16&wind_speed_unit=mph&precipitation_unit=mm`
    + (pastDaysParam > 0 ? `&past_days=${pastDaysParam}` : '');
  const res = await fetch(url); if (!res.ok) throw new Error('Forecast fetch failed'); const fetchedAt = res.headers.get('date') || new Date().toISOString();
  const data = await res.json(); data._fetchedAt = fetchedAt; return data;
}

function buildDataFromLive(apiData){
  const hourly = apiData.hourly; const daily = apiData.daily;
  const hourlyArr = hourly.time.map((t, i) => {
    const tempF = hourly.temperature_2m[i] * 9/5 + 32;
    const apparentF = (typeof hourly.apparent_temperature !== 'undefined' && hourly.apparent_temperature[i] != null)
      ? (hourly.apparent_temperature[i] * 9/5 + 32) : null;
    const precipIn = hourly.precipitation[i];
    const rainIn = hourly.rain[i];
    const snowIn = hourly.snowfall[i];
    const windMph = hourly.wind_speed_10m[i];
    const windDir = hourly.wind_direction_10m[i];
    const precipProb = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
    const precipType = snowIn > 0 ? 'snow' : (rainIn > 0 ? 'rain' : 'none');
    return { time: t, temperatureF: tempF, apparentF, precipIn, rainIn, snowIn, precipType, windMph, windDir, precipProb };
  });
  const dailyArr = daily.time.map((d, i) => ({
    date: d,
    highTempF: daily.temperature_2m_max[i] * 9/5 + 32,
    lowTempF:  daily.temperature_2m_min[i] * 9/5 + 32,
    totalPrecipIn: daily.precipitation_sum[i],
    totalSnowIn:   daily.snowfall_sum[i],
    sunrise: daily.sunrise[i], sunset: daily.sunset[i]
  }));
  return { hourly: hourlyArr, daily: dailyArr, fetchedAt: apiData._fetchedAt || null, generationtimeMs: apiData.generationtime_ms ?? null };
}

// ---------- Utility: Snow Ratio ----------
function getSnowRatio(tempF){
  if (snowRatioMode && snowRatioMode !== 'Auto'){
    const fixed = parseInt(snowRatioMode, 10);
    if (!Number.isNaN(fixed) && fixed > 0) return fixed;
  }
  // Auto: temperature-based heuristic
  if (tempF >= 31) return 8;
  if (tempF >= 26) return 10;
  if (tempF >= 20) return 12;
  return 15;
}

// ---------- Plugins ----------
(function registerPlugins(){
  try{
    if (window['chartjs-plugin-annotation']) { Chart.register(window['chartjs-plugin-annotation']); }
    else if (window.ChartAnnotation) { Chart.register(window.ChartAnnotation); }
  }catch(e){ console.warn('Annotation plugin registration failed:', e); }
  try{
    if (window.ChartDataLabels) { Chart.register(window.ChartDataLabels); }
  }catch(e){ console.warn('ChartDataLabels registration failed:', e); }
})();

// Hour tick marks plugin
const hourTicksPlugin = { id: 'hourTicksPlugin', afterDatasetsDraw(c, args, opts){ if(!opts||!opts.enabled) return; const skipForBar=opts.skipForBar||[]; const {ctx, chartArea, scales:{x,yTemp}}=c; if(!x||!yTemp||!chartArea) return; ctx.save(); ctx.strokeStyle = isDark?'rgba(156,163,175,0.6)':'rgba(107,114,128,0.55)'; ctx.lineWidth=1; const bottom=chartArea.bottom, top=bottom-6; const labels=c.data.labels||[]; for(let i=0;i<labels.length;i++){ if((skipForBar[i]??0)>0.0005) continue; const cx=x.getPixelForValue(labels[i]); if(cx<chartArea.left||cx>chartArea.right) continue; ctx.beginPath(); ctx.moveTo(cx,top); ctx.lineTo(cx,bottom); ctx.stroke(); } ctx.restore(); } };
Chart.register(hourTicksPlugin);

// Past 4h hatching plugin
const pastHoursHatchingPlugin = { id: 'pastHoursHatching', afterDatasetsDraw(chart){ const {ctx, chartArea, scales:{x,yTemp}} = chart; if(!x || !yTemp || !chartArea) return; const labels = chart.data.labels || []; if(labels.length === 0) return; const currentIdx = findCurrentOrPreviousHourIndex(labels); if(currentIdx <= 0) return; const pastStartIdx = Math.max(0, currentIdx - 4); if(pastStartIdx >= currentIdx) return; const xStart = Math.max(chartArea.left, x.getPixelForValue(pastStartIdx)); const xEnd = Math.min(chartArea.right, x.getPixelForValue(currentIdx)); if(xEnd <= xStart) return; const top = chartArea.top, bottom = chartArea.bottom; ctx.save(); ctx.beginPath(); ctx.rect(xStart, top, xEnd - xStart, bottom - top); ctx.clip(); ctx.globalAlpha = 0.12; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; const spacing = 8; const hatchWidth = xEnd - xStart; for(let offset = -hatchWidth - spacing; offset <= hatchWidth + spacing; offset += spacing){ ctx.beginPath(); ctx.moveTo(xStart + offset, top); ctx.lineTo(xEnd + offset, bottom); ctx.stroke(); } ctx.restore(); } };
Chart.register(pastHoursHatchingPlugin);

// Day labels plugin (top X axis)
function shouldShowDateInDayLabel(dateStr){
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const labelDate = new Date(dateStr + 'T00:00:00');
  const labelStart = new Date(labelDate.getFullYear(), labelDate.getMonth(), labelDate.getDate()).getTime();
  const dayOffset = Math.round((labelStart - todayStart) / 86400000);
  return dayOffset < 0 || dayOffset > 5;
}
const dayLabelsPlugin = { id: 'dayLabels', afterDatasetsDraw(chart){ const {ctx, chartArea, scales:{x}} = chart; if(!x || !chartArea) return; const labels = chart.data.labels || []; if(labels.length === 0) return; const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const labelDates = labels.map(t => t.substring(0,10)); const dayBoundaries = {}; for(let i = 0; i < labels.length; i++){ const d = labelDates[i]; if(!(d in dayBoundaries)) dayBoundaries[d] = {firstIdx: i}; dayBoundaries[d].lastIdx = i; } ctx.save(); ctx.font = 'bold 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = isDark ? '#d1d5db' : '#374151'; for(const [dateStr, {firstIdx, lastIdx}] of Object.entries(dayBoundaries)){ const d = new Date(dateStr + 'T00:00:00'); const dayName = dayNames[d.getDay()]; const label = shouldShowDateInDayLabel(dateStr) ? `${dayName} ${d.getMonth()+1}/${d.getDate()}` : dayName; const xPos = (x.getPixelForValue(firstIdx - 0.5) + x.getPixelForValue(lastIdx + 0.5)) / 2; const y = chartArea.top - 4; if(xPos >= chartArea.left && xPos <= chartArea.right) ctx.fillText(label, xPos, y); } ctx.restore(); } };
Chart.register(dayLabelsPlugin);

// Wind display plugins - 4 different visualization modes
// Wind background overlay - colors chart background by wind speed when no precip bars
const windBackgroundPlugin = { id: 'windBackground', afterDatasetsDraw(chart){ if(WIND_DISPLAY_MODE !== 'overlay') return; const {ctx, chartArea, scales:{x, yTemp}} = chart; if(!x || !yTemp || !chartArea) return; const labels = chart.data.labels || []; const wind = chart.data.windData || []; if(!wind.length) return; const accumData = chart.data.datasets.find(ds => ds.label === 'Accumulation')?.data || []; ctx.save(); for(let i = 0; i < labels.length; i++){ const w = wind[i]; if(w == null || w === 0) continue; const accum = accumData[i]; if(accum && accum > 0.001) continue; const px = x.getPixelForValue(i - 0.5); const pw = x.getPixelForValue(i + 0.5) - px; if(px + pw < chartArea.left || px > chartArea.right) continue; let color = 'rgba(0,0,0,0)'; if(w >= 20) color = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)'; else if(w >= 12) color = isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.06)'; ctx.fillStyle = color; ctx.fillRect(px, chartArea.top, pw, chartArea.bottom - chartArea.top); } ctx.restore(); } };

// Wind Barbs plugin
const windBarbsPlugin = { id: 'windBarbs', afterDatasetsDraw(chart){ if(WIND_DISPLAY_MODE !== 'barbs') return; const {ctx, chartArea, scales:{x, yTemp}} = chart; if(!x || !yTemp || !chartArea) return; const labels = chart.data.labels || []; const wind = chart.data.windData || []; if(!wind.length) return; const baseY = chartArea.top + (chartArea.bottom - chartArea.top) * 0.10; ctx.save(); ctx.font = 'bold 9px Arial'; for(let i = 0; i < labels.length; i++){ const w = wind[i]; if(w == null) continue; const windMph = Array.isArray(w) ? w[0] : w; const dirDeg = chart.data.windDir?.[i] ?? 0; const px = x.getPixelForValue(i); if(px < chartArea.left || px > chartArea.right) continue; const barbLen = Math.min(windMph / 2.5, 8); ctx.save(); ctx.translate(px, baseY); ctx.rotate((dirDeg + 180) * Math.PI / 180); let strokeColor = '#22d3ee'; if(windMph >= 20) strokeColor = '#ef4444'; else if(windMph >= 12) strokeColor = '#f59e0b'; else if(windMph >= 7) strokeColor = '#eab308'; ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -barbLen); ctx.lineTo(0, barbLen); if(windMph >= 10){ ctx.moveTo(0, -barbLen); ctx.lineTo(2, -barbLen + 2); } if(windMph >= 20){ ctx.moveTo(0, -barbLen + 3); ctx.lineTo(2, -barbLen + 5); } ctx.stroke(); ctx.restore(); ctx.fillStyle = strokeColor; ctx.fillText(windMph.toFixed(0), px, baseY + 12); } ctx.restore(); } };

// Wind Arrows plugin
const windArrowsPlugin = { id: 'windArrows', afterDatasetsDraw(chart){ if(WIND_DISPLAY_MODE !== 'arrows') return; const {ctx, chartArea, scales:{x, yTemp}} = chart; if(!x || !yTemp || !chartArea) return; const labels = chart.data.labels || []; const wind = chart.data.windData || []; if(!wind.length) return; const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']; const baseY = chartArea.top + (chartArea.bottom - chartArea.top) * 0.10; ctx.save(); ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for(let i = 0; i < labels.length; i++){ const w = wind[i]; if(w == null) continue; const px = x.getPixelForValue(i); if(px < chartArea.left || px > chartArea.right) continue; const windMph = Array.isArray(w) ? w[0] : w; const dirDeg = (chart.data.windDir?.[i] ?? 0) / 45; const dirIdx = Math.round(dirDeg) % 8; const arrow = directions[dirIdx]; let arrowColor = '#22d3ee'; if(windMph >= 20) arrowColor = '#ef4444'; else if(windMph >= 12) arrowColor = '#f59e0b'; else if(windMph >= 7) arrowColor = '#eab308'; ctx.fillStyle = arrowColor; ctx.globalAlpha = 1.0; ctx.fillText(arrow, px, baseY); ctx.font = 'bold 9px Arial'; ctx.fillText(windMph.toFixed(0), px, baseY + 12); } ctx.restore(); } };

// Wind Speed Color Overlay
const windOverlayData = { mode: 'overlay', mphThresholds: [{threshold: 12, color: 'rgba(234, 179, 8, 0.08)'}, {threshold: 20, color: 'rgba(249, 115, 22, 0.12)'}, {threshold: 999, color: 'rgba(239, 68, 68, 0.15)'}] };

// Wind Speed Line Labels Plugin
const windSpeedLabelsPlugin = { id: 'windSpeedLabels', afterDatasetsDraw(chart){ if(WIND_DISPLAY_MODE !== 'line') return; const {ctx, chartArea, scales:{x, yAccum}} = chart; if(!x || !yAccum || !chartArea) return; const labels = chart.data.labels || []; const wind = chart.data.windData || []; if(!wind.length) return; const labelDates = labels.map(t=>t.substring(0,10)); const labelDatesList = labelDates; const indicesByDay={}; for(let i=0;i<labels.length;i++){ const d=labelDatesList[i]; (indicesByDay[d] ||= []).push(i); } const firstMinMaxWindByDay={}; for(const [d,idxs] of Object.entries(indicesByDay)){ if(!idxs||!idxs.length) continue; let minV=Infinity, maxV=-Infinity; for(const i of idxs){ const v=wind[i]; if(v!=null && (minV===Infinity || v<minV)) minV=v; if(v!=null && (maxV===-Infinity || v>maxV)) maxV=v; } if(minV===Infinity) continue; let minIdx=null, maxIdx=null; for(const i of idxs){ const v=wind[i]; if(minIdx===null && v===minV) minIdx=i; if(maxIdx===null && v===maxV) maxIdx=i; if(minIdx!==null && maxIdx!==null) break; } firstMinMaxWindByDay[d]={minIdx,maxIdx}; } ctx.save(); ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = isDark ? '#e5e7eb' : '#111827'; for(let i = 0; i < labels.length; i++){ const d = labelDatesList[i]; const fm = firstMinMaxWindByDay[d]; if(!fm) continue; const isMin = i===fm.minIdx; const isMax = i===fm.maxIdx; if(!isMin && !isMax) continue; const w = wind[i]; if(w == null) continue; const px = x.getPixelForValue(i); if(px < chartArea.left || px > chartArea.right) continue; const py = yAccum.getPixelForValue((w / MAX_WIND_DISPLAY * (yAccum.max - yAccum.min)) + yAccum.min); const offsetY = isMin ? 12 : -12; ctx.fillText(`${w.toFixed(1)}\nMPH`, px, py + offsetY); } ctx.restore(); } };

Chart.register(windBarbsPlugin, windArrowsPlugin, windBackgroundPlugin, windSpeedLabelsPlugin);

// Temperature color bar plugin (uses global width and extra reserve)
const TempColorBarPlugin = {
  id:'tempColorBar',
  anchors:[{t:-4,c:'#000000'},{t:5,c:'#3a3a3a'},{t:14,c:'#2b2f83'},{t:23,c:'#0033cc'},{t:32,c:'#005eff'},{t:41,c:'#3f7fff'},{t:50,c:'#8cc6ff'},{t:59,c:'#4fd9e6'},{t:68,c:'#2e8b57'},{t:77,c:'#9acd32'},{t:86,c:'#ffd400'},{t:95,c:'#ff7f00'},{t:104,c:'#ff2b2b'}],
  lerp(aHex,bHex,t){ const a=parseInt(aHex.slice(1),16), b=parseInt(bHex.slice(1),16); const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255; const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255; const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t); const h=v=>v.toString(16).padStart(2,'0'); return `#${h(r)}${h(g)}${h(bl)}`; },
  colorAtTemp(t){ const A=this.anchors; if(t<=A[0].t) return A[0].c; if(t>=A[A.length-1].t) return A[A.length-1].c; for(let i=0;i<A.length-1;i++){ const a=A[i], b=A[i+1]; if(t>=a.t && t<=b.t){ const p=(t-a.t)/((b.t-a.t)||1); return this.lerp(a.c,b.c,p);} } return A[0].c; },
  afterFit(chart, scale){ if(GRADIENT_MODE!=='plugin') return; if(scale.id==='yTemp'){ scale.width += (GRADIENT_WIDTH + 8 + GRADIENT_EXTRA_LEFT); } },
  beforeDraw(chart,args){ const y=chart.scales.yTemp, area=chart.chartArea; if(!y||!area) return; const ctx=chart.ctx; const top=area.top, bottom=area.bottom; const lo=y.min, hi=y.max; const range=(hi-lo)||1; const anchors=[{t:lo,c:this.colorAtTemp(lo)},...this.anchors.filter(a=>a.t>lo&&a.t<hi),{t:hi,c:this.colorAtTemp(hi)}].sort((a,b)=>a.t-b.t); const grad=ctx.createLinearGradient(0,top,0,bottom); anchors.forEach(a=>{ const p=1-((a.t-lo)/range); grad.addColorStop(Math.min(1,Math.max(0,p)), a.c); });
    if(GRADIENT_MODE==='plugin'){ const gap=8; const xRight=y.left-gap; const xLeft=xRight-GRADIENT_WIDTH; ctx.save(); ctx.fillStyle=grad; ctx.fillRect(xLeft, top, GRADIENT_WIDTH, bottom-top); ctx.restore(); }
    else if(GRADIENT_MODE==='axis-overlay'){ const w=(y.width||GRADIENT_WIDTH); const xLeft=y.left-w; ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle=grad; ctx.fillRect(xLeft, top, w, bottom-top); ctx.restore(); }
    else if(GRADIENT_MODE==='custom-scale'){ /* handled in afterDraw */ }
    else if(GRADIENT_MODE==='separate-canvas'){ /* drawn by SeparateColorBar */ }
    else { /* 'dom' or 'off' */ }
  },
  afterDraw(chart,args){ if(GRADIENT_MODE!=='custom-scale') return; const y=chart.scales.yTemp, area=chart.chartArea; if(!y||!area) return; const ctx=chart.ctx; const top=area.top, bottom=area.bottom; const lo=y.min, hi=y.max; const range=(hi-lo)||1; const anchors=[{t:lo,c:this.colorAtTemp(lo)},...this.anchors.filter(a=>a.t>lo&&a.t<hi),{t:hi,c:this.colorAtTemp(hi)}].sort((a,b)=>a.t-b.t); const grad=ctx.createLinearGradient(0,top,0,bottom); anchors.forEach(a=>{ const p=1-((a.t-lo)/range); grad.addColorStop(Math.min(1,Math.max(0,p)), a.c); }); const w=(chart.scales.yTemp.width||GRADIENT_WIDTH); const xLeft=chart.scales.yTemp.left-w;
    ctx.save(); ctx.fillStyle=grad; ctx.fillRect(xLeft, top, w, bottom-top);
    ctx.fillStyle = '#ffffff'; ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; ctx.textAlign='right'; ctx.textBaseline='middle';
    const ticks = chart.scales.yTemp.ticks || []; for(const t of ticks){ const py = chart.scales.yTemp.getPixelForValue(t.value); if(py>=top && py<=bottom){ ctx.fillText(`${t.value}°`, chart.scales.yTemp.left-6, py); } }
    ctx.restore();
  }
};
Chart.register(TempColorBarPlugin);

// DOM color bar (absolute overlay)
const DomColorBar = {
  id: 'DomColorBar', el: null,
  ensure(){ if(this.el && document.body.contains(this.el)) return this.el; const host=document.querySelector('.chart-container'); if(!host) return null; let cv=document.getElementById('tempColorBarCanvas'); if(!cv){ cv=document.createElement('canvas'); cv.id='tempColorBarCanvas'; cv.style.position='absolute'; cv.style.pointerEvents='none'; cv.style.zIndex='2'; host.appendChild(cv); } this.el=cv; return cv; },
  render(chart){ if(GRADIENT_MODE!=='dom') return this.hide(); const y=chart.scales.yTemp, area=chart.chartArea; const cv=this.ensure(); if(!cv||!y||!area) return; const top=area.top; const bottom=area.bottom; const h=bottom-top; const gap=8; const xRight=y.left-gap; const xLeft=xRight-GRADIENT_WIDTH; const dpr=window.devicePixelRatio||1; cv.style.left=`${xLeft}px`; cv.style.top=`${top}px`; cv.style.width=`${GRADIENT_WIDTH}px`; cv.style.height=`${h}px`; cv.width=Math.max(1,Math.floor(GRADIENT_WIDTH*dpr)); cv.height=Math.max(1,Math.floor(h*dpr)); const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); const lo=y.min, hi=y.max; const range=(hi-lo)||1; const stops=[{t:lo,c:TempColorBarPlugin.colorAtTemp(lo)}, ...TempColorBarPlugin.anchors.filter(a=>a.t>lo&&a.t<hi), {t:hi,c:TempColorBarPlugin.colorAtTemp(hi)}].sort((a,b)=>a.t-b.t); const grad=ctx.createLinearGradient(0,0,0,h); stops.forEach(s=>{ const p=1-((s.t-lo)/range); grad.addColorStop(Math.min(1,Math.max(0,p)), s.c); }); ctx.fillStyle=grad; ctx.fillRect(0,0,GRADIENT_WIDTH,h); cv.style.display='block'; },
  hide(){ if(this.el){ this.el.style.display='none'; } }
};

// Separate canvas color bar — independent fixed canvas on the page to guarantee space
const SeparateColorBar = {
  id:'SeparateColorBar', el:null,
  ensure(){ if(this.el && document.body.contains(this.el)) return this.el; let cv=document.getElementById('tempColorBarSeparate'); if(!cv){ cv=document.createElement('canvas'); cv.id='tempColorBarSeparate'; cv.style.position='fixed'; cv.style.pointerEvents='none'; cv.style.zIndex='2'; document.body.appendChild(cv); } this.el=cv; return cv; },
  render(chart){ if(GRADIENT_MODE!=='separate-canvas') return this.hide(); const y=chart.scales.yTemp, area=chart.chartArea; const cv=this.ensure(); if(!cv||!y||!area) return; const rect=chart.canvas.getBoundingClientRect(); const top=area.top+rect.top; const bottom=area.bottom+rect.top; const h=bottom-top; const w=GRADIENT_WIDTH; const gap=8; const xRight=(rect.left + y.left) - gap; const xLeft=xRight - w; const dpr=window.devicePixelRatio||1; cv.style.left=`${Math.round(xLeft)}px`; cv.style.top=`${Math.round(top)}px`; cv.style.width=`${w}px`; cv.style.height=`${h}px`; cv.width=Math.max(1,Math.floor(w*dpr)); cv.height=Math.max(1,Math.floor(h*dpr)); const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); const lo=y.min, hi=y.max; const range=(hi-lo)||1; const stops=[{t:lo,c:TempColorBarPlugin.colorAtTemp(lo)}, ...TempColorBarPlugin.anchors.filter(a=>a.t>lo&&a.t<hi), {t:hi,c:TempColorBarPlugin.colorAtTemp(hi)}].sort((a,b)=>a.t-b.t); const grad=ctx.createLinearGradient(0,0,0,h); stops.forEach(s=>{ const p=1-((s.t-lo)/range); grad.addColorStop(Math.min(1,Math.max(0,p)), s.c); }); ctx.fillStyle=grad; ctx.fillRect(0,0,w,h); cv.style.display='block'; },
  hide(){ if(this.el){ this.el.style.display='none'; } }
};

// ---------- UI helpers ----------
function pad2(n){ return String(n).padStart(2,'0'); }
function formatClock(iso){ const d=new Date(iso); if(Number.isNaN(d.getTime())) return 'n/a'; let h=d.getHours(); const m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${h}:${pad2(m)} ${ap}`; }
function formatTooltipTime(iso){ const d=new Date(iso); const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; const mon=d.getMonth()+1; const day=d.getDate(); let h=d.getHours(); const m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${dow} ${mon}/${day} ${h}:${pad2(m)} ${ap}`; }
function formatPointFooter(iso){ const d=new Date(iso); const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; const mon=d.getMonth()+1; const day=d.getDate(); let h=d.getHours(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${dow} ${mon}/${day} ${h} ${ap}`; }
function formatXAxisHour(iso){ const d=new Date(iso); const h24=d.getHours(); if(h24===0) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; if(h24===12) return 'Noon'; let h=h24; const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${h} ${ap}`; }
function formatRangeDebugTime(iso){ const d=new Date(iso); const mon=d.getMonth()+1; const day=d.getDate(); let h=d.getHours(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${mon}/${day} ${h}${ap}`; }
function getVisibleHoursBaseStops(){ const rangeState = RANGE_STATES[rangeIndex]; if(rangeState===24) return [12]; if(rangeState===72) return [12,24,36,60]; if(rangeState===168) return [24,36,60,84,108]; return [24,60,84,108,204]; }
function getVisibleHoursStops(totalHours){ const maxHours = Math.max(1, Math.round(totalHours || 0)); const baseStops = getVisibleHoursBaseStops().filter(h=>h<=maxHours); const stops = baseStops.length ? baseStops : [Math.min(MIN_VISIBLE_HOURS, maxHours)]; if(stops[stops.length-1]!==maxHours) stops.push(maxHours); return [...new Set(stops)].sort((a,b)=>a-b); }
function getVisibleHoursBounds(totalHours){ const maxHours = Math.max(1, Math.round(totalHours || 0)); const stops = getVisibleHoursStops(maxHours); const minHours = Math.min(stops[0] || MIN_VISIBLE_HOURS, maxHours); return { minHours, maxHours }; }
function clampVisibleHours(targetHours, totalHours){ const { minHours, maxHours } = getVisibleHoursBounds(totalHours); const parsed = Number.isFinite(targetHours) ? targetHours : maxHours; return Math.max(minHours, Math.min(maxHours, Math.round(parsed))); }
function snapVisibleHours(targetHours, totalHours){ const clamped = clampVisibleHours(targetHours, totalHours); const stops = getVisibleHoursStops(totalHours); let best = stops[0], bestDist = Infinity; for(const stop of stops){ const d = Math.abs(clamped - stop); if(d < bestDist){ best = stop; bestDist = d; } } return best; }
function formatVisibleHoursLabel(hours, maxHours){ if(hours>=maxHours) return 'All'; if(hours>60) return `${Math.floor(hours/24)}d`; return `${hours}h`; }
function updateVisibleHoursDisplay(valueSpan, hours, maxHours){ if(valueSpan) valueSpan.textContent = formatVisibleHoursLabel(hours, maxHours); }
function renderVisibleHoursTicks(totalHours){ const ticks=$("mainScrollScaleTicks"); const slider=$("mainScrollScale"); if(!ticks||!slider) return; const minHours=parseFloat(slider.min); const maxHours=parseFloat(slider.max); const span=Math.max(1, maxHours-minHours); ticks.textContent=''; getVisibleHoursStops(totalHours).forEach(stop=>{ if(stop<minHours||stop>maxHours) return; const tick=document.createElement('span'); tick.textContent=formatVisibleHoursLabel(stop, maxHours); tick.style.left=`${((stop-minHours)/span)*100}%`; ticks.appendChild(tick); }); }
function getVisibleHoursForScale(scale, scrollerWidth, pxPerHour){ if(!scale || !scrollerWidth || !pxPerHour) return 0; return scrollerWidth / (pxPerHour * scale); }
function getScaleForVisibleHours(visibleHours, scrollerWidth, pxPerHour){ if(!visibleHours || !scrollerWidth || !pxPerHour) return 1; return scrollerWidth / (pxPerHour * visibleHours); }
function getXAxisMaxTicks(labelCount){ const canvas=$("weatherChart"); const scroller=$("chartScroll"); const container=document.querySelector('.chart-container'); const viewportWidth=scroller?.clientWidth || container?.clientWidth || window.innerWidth; const scrollWidth=parseFloat(canvas?.style?.width) || Number(canvas?.getAttribute?.('width')) || canvas?.getBoundingClientRect?.().width || viewportWidth; const width=(LAYOUT_MODE==='scroll') ? scrollWidth : viewportWidth; return Math.max(6, Math.min(labelCount, Math.floor(width/48))); }
function labelTimeMs(label){ const ms=new Date(label).getTime(); return Number.isNaN(ms) ? null : ms; }
function findCurrentOrPreviousHourIndex(labels, now=Date.now()){ if(!labels||!labels.length) return 0; let previousIdx=-1; for(let i=0;i<labels.length;i++){ const ms=labelTimeMs(labels[i]); if(ms==null) continue; if(ms<=now) previousIdx=i; else break; } if(previousIdx>=0) return previousIdx; return 0; }
function getCurrentTimePosition(labels, now=Date.now()){ if(!labels||!labels.length) return null; const times=labels.map(labelTimeMs); for(let i=0;i<times.length;i++){ const ms=times[i]; if(ms==null) continue; if(now===ms) return i; if(now<ms){ if(i===0) return null; const prev=times[i-1]; if(prev==null || ms<=prev) return i-1; return (i-1)+((now-prev)/(ms-prev)); } } return null; }
function findNowIndex(labels){ return findCurrentOrPreviousHourIndex(labels); }

function updateSunTimesForNow(daily, fullLabels, nowIdxFull, fetchedAt){ try{ const el=$("sunTimes"); if(!el||!daily||!daily.length||!fullLabels||nowIdxFull==null) return; const dayKey=fullLabels[nowIdxFull].substring(0,10); const rec=daily.find(d=>d.date===dayKey) || daily[0]; const fetchedText = fetchedAt ? formatClock(fetchedAt) : "n/a"; el.textContent=`Forecast Updated: ${fetchedText} | Sunrise: ${formatClock(rec?.sunrise)} | Sunset: ${formatClock(rec?.sunset)}`; }catch(e){ console.warn("updateSunTimesForNow failed", e); } }

function calcDayAccum(hourly, idx){ const d=hourly[idx].time.substring(0,10); let sumLiquid=0, sumEstSnow=0; for(let i=0;i<=idx;i++){ if(hourly[i].time.substring(0,10)!==d) continue; const h=hourly[i]; sumLiquid += h.precipIn||0; const likely=(h.precipType==='snow')||(h.temperatureF<=32); if(likely){ const ratio=getSnowRatio(h.temperatureF); sumEstSnow += (h.precipIn||0)*ratio; } } return {liquid:sumLiquid, estSnow:sumEstSnow}; }

function isTouchTooltipMode(){ return window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches || false; }
function scheduleMobileTooltipHide(chartInstance){
  if(!isTouchTooltipMode() || !chartInstance?.tooltip) return;
  clearTimeout(mobileTooltipTimer);
  mobileTooltipTimer = setTimeout(()=>{
    try{
      chartInstance.tooltip.setActiveElements([], {x: 0, y: 0});
      chartInstance.update('none');
    }catch(e){ console.warn('Unable to hide mobile tooltip', e); }
  }, MOBILE_TOOLTIP_HIDE_DELAY_MS);
}

function applyLayout(labels){ const container=document.querySelector('.chart-container'); const scroller=$("chartScroll"); const canvas=$("weatherChart"); const header=document.querySelector('.app-header'); const footer=document.querySelector('.app-footer'); const sumBoxes=document.querySelectorAll('.summary-box'); const testBanner=$("testModeBanner"); let used=(header?.offsetHeight||0)+(footer?.offsetHeight||0)+(testBanner?.offsetHeight||0)+32; sumBoxes.forEach(el=> used+=(el?.offsetHeight||0)+8); const avail=Math.max(240, window.innerHeight-used); container.style.height=avail+'px'; canvas.style.height='100%'; const hours=labels.length, pxPerHour=56; const fitScale=parseFloat(Math.min(1.0, Math.max(0.0, scroller.clientWidth/(Math.max(hours,1)*pxPerHour))).toFixed(4)); const slider=$("mainScrollScale"); const valueSpan=$("mainScrollScaleValue"); const { minHours, maxHours } = getVisibleHoursBounds(hours); const fitVisibleHours = snapVisibleHours(getVisibleHoursForScale(fitScale, scroller.clientWidth, pxPerHour), hours); if(slider){ slider.min=String(minHours); slider.max=String(maxHours); slider.step='any'; renderVisibleHoursTicks(hours); }
  if(LAYOUT_MODE==='fit'){
    LAYOUT_SCROLL_SCALE=fitScale;
    if(slider) slider.value=String(fitVisibleHours);
    updateVisibleHoursDisplay(valueSpan, fitVisibleHours, maxHours);
    scroller.style.overflowX='hidden'; canvas.style.width=''; canvas.removeAttribute('width');
  } else {
    const currentVisibleHours = snapVisibleHours(getVisibleHoursForScale(LAYOUT_SCROLL_SCALE, scroller.clientWidth, pxPerHour), hours);
    const atFit = currentVisibleHours >= maxHours;
    if(atFit){
      LAYOUT_SCROLL_SCALE=fitScale;
      if(slider) slider.value=String(fitVisibleHours);
      updateVisibleHoursDisplay(valueSpan, fitVisibleHours, maxHours);
      scroller.style.overflowX='hidden'; canvas.style.width=''; canvas.removeAttribute('width');
    } else {
      const clampedVisibleHours = snapVisibleHours(currentVisibleHours, hours);
      const targetScale = Math.max(fitScale, getScaleForVisibleHours(clampedVisibleHours, scroller.clientWidth, pxPerHour));
      LAYOUT_SCROLL_SCALE=targetScale;
      const w=Math.max(scroller.clientWidth, hours*pxPerHour*LAYOUT_SCROLL_SCALE);
      scroller.style.overflowX=(w<=scroller.clientWidth+1)?'hidden':'auto'; canvas.style.width=w+'px'; canvas.setAttribute('width', w);
      if(slider) slider.value=String(clampedVisibleHours);
      updateVisibleHoursDisplay(valueSpan, clampedVisibleHours, maxHours);
    }
  } }

// ---------- Build Chart ----------
function buildChart(dataset){
  currentDataset = dataset; const ctx=$("weatherChart").getContext('2d'); if(chart) chart.destroy();
  clearTimeout(mobileTooltipTimer);
  const fullHourly = dataset.hourly||[]; const fullLabels = fullHourly.map(h=>h.time); const nowIdxFull = findNowIndex(fullLabels);
  updateSunTimesForNow(dataset.daily||[], fullLabels, nowIdxFull, dataset.fetchedAt);

  let startIdx, endIdx;
  const rangeState = RANGE_STATES[rangeIndex];
  if(pastDays > 0){
    // When viewing past data, show from start up to NOW (don't show future forecast)
    startIdx = 0;
    endIdx = nowIdxFull;
  } else {
    // Normal mode: center around "now"
    const fwd = (rangeState==='max') ? (fullLabels.length - nowIdxFull) : rangeState;
    startIdx = Math.max(0, nowIdxFull - 4);
    endIdx   = Math.min(fullLabels.length - 1, nowIdxFull + fwd - 1);
  }
  
  const hourly = fullHourly.slice(startIdx, endIdx+1);
  const labels = hourly.map(h=>h.time);
  const temps  = hourly.map(h=>h.temperatureF);
  const apTemps= hourly.map(h=>h.apparentF ?? null);
  const precip = hourly.map(h=>h.precipIn);
  const snow   = hourly.map(h=>h.snowIn);
  const rain   = hourly.map(h=>h.rainIn);
  const prob   = hourly.map(h=>h.precipProb ?? null);
  const wind   = hourly.map(h=>h.windMph ?? null);
  const windDir= hourly.map(h=>h.windDir ?? 0);
  const nowIdxVisible = nowIdxFull - startIdx;
  const nowPositionVisible = getCurrentTimePosition(labels);

  applyLayout(labels);

  const tempValues = temps.filter(x=>x!=null);
  const axisTempValues = APPARENT_OVERLAY_ENABLED ? tempValues.concat(apTemps.filter(x=>x!=null)) : tempValues;
  const minT = tempValues.length ? Math.min(...tempValues) : 32;
  const maxT = tempValues.length ? Math.max(...tempValues) : 32;
  const axisMinT = axisTempValues.length ? Math.min(...axisTempValues) : minT;
  const axisMaxT = axisTempValues.length ? Math.max(...axisTempValues) : maxT;
  const yMin=Math.floor(axisMinT-5); let yMax=Math.ceil(axisMaxT+5); if(axisMaxT<35) yMax=35;

  // Accumulation bar scaling in mm: snap to rounded metric ranges.
  let maxPrecip = Math.max(...precip, 0.1);
  let accumMax = 15;
  if (maxPrecip <= 2) accumMax = 2;
  else if (maxPrecip <= 5) accumMax = 5;
  else if (maxPrecip <= 10) accumMax = 10;
  const accumTickStep = accumMax <= 5 ? 1 : (accumMax <= 10 ? 2 : 3);
  const nonZeroPrecipHours = precip.filter(v => (v || 0) > 0.0127).length;
  const debugEl = $("rangeDebug");
  if(debugEl){
    const rangeLabel = pastDays > 0 ? `-${pastDays}d history` : (rangeState === 'max' ? '15d' : (rangeState === 72 ? '3d' : (rangeState === 168 ? '7d' : `${rangeState}h`)));
    const startLabel = labels.length ? formatRangeDebugTime(labels[0]) : 'n/a';
    const endLabel = labels.length ? formatRangeDebugTime(labels[labels.length - 1]) : 'n/a';
    const nowLabel = (nowIdxVisible >= 0 && nowIdxVisible < labels.length) ? formatRangeDebugTime(labels[nowIdxVisible]) : 'n/a';
    debugEl.textContent = `${rangeLabel} window | precip max: ${maxPrecip.toFixed(1)} mm | precip hours: ${nonZeroPrecipHours}/${labels.length} | now: ${nowLabel} | visible: ${startLabel} -> ${endLabel}`;
  }

  // Original scaling: liquid and snow both use same scale, no reduction for liquid
  const scaledPrecip = precip.map((v)=> v);
  const scaledWind = wind.map(w => w ? Math.min(w / MAX_WIND_DISPLAY * accumMax, accumMax) : null);
  let barColors = hourly.map(h=> (h.temperatureF>32 ? 'rgb(96, 165, 250)' : 'rgb(216, 139, 254)'));

  // Wind overlay - change bar color based on wind speed
  if(WIND_DISPLAY_MODE === 'overlay'){
    barColors = hourly.map((h,i)=>{ const w = wind[i]; if(w == null) return (h.temperatureF>32 ? '#10b981' : '#60a5fa'); const baseColor = h.temperatureF>32 ? '#aef3aa' : '#a5d4ff'; if(w >= 20) return isDark ? '#fe7867' : '#ff5555'; if(w >= 12) return isDark ? '#faa54a' : '#ff9500'; return baseColor; });
  }

  const tr=$("totalRain"), ts=$("totalSnow"), es=$("estSnow"), wr=$("windRange");
  if(tr) tr.textContent=`${rain.reduce((a,b)=>a+b,0).toFixed(1)} mm`;
  const hidesnow = yMin > MIN_TEMP_THRESHOLD_FOR_SNOW;
  if(ts){ ts.textContent=`${snow.reduce((a,b)=>a+b,0).toFixed(1)} mm`; ts.parentElement.style.display = hidesnow ? 'none' : 'block'; }
  if(es){ es.textContent=`${hourly.reduce((s,h)=>{ const likely=(h.precipType==='snow')||(h.temperatureF<=32); if(!likely) return s; const ratio=getSnowRatio(h.temperatureF); return s+(h.precipIn||0)*ratio; },0).toFixed(1)} mm`; es.parentElement.style.display = hidesnow ? 'none' : 'block'; }
  
  // Calculate daily wind high/low
  if(wr){
    let minWind = Infinity, maxWind = -Infinity;
    for(const h of hourly){
      const w = h.windMph ?? null;
      if(w != null){
        if(w < minWind) minWind = w;
        if(w > maxWind) maxWind = w;
      }
    }
    if(minWind === Infinity) wr.textContent = '— MPH';
    else wr.textContent = `${minWind.toFixed(1)}–${maxWind.toFixed(1)} MPH`;
  }

  // Day min/max label selection per day
  const labelDates = labels.map(t=>t.substring(0,10)); const indicesByDay={}; for(let i=0;i<labels.length;i++){ const d=labelDates[i]; (indicesByDay[d] ||= []).push(i); }
  const firstMinMaxIndexByDay={}; for(const [d,idxs] of Object.entries(indicesByDay)){ if(!idxs||!idxs.length) continue; let minV=Infinity, maxV=-Infinity; for(const i of idxs){ const v=temps[i]; if(v<minV) minV=v; if(v>maxV) maxV=v; } let minIdx=null, maxIdx=null; for(const i of idxs){ const v=temps[i]; if(minIdx===null && v===minV) minIdx=i; if(maxIdx===null && v===maxV) maxIdx=i; if(minIdx!==null && maxIdx!==null) break; } firstMinMaxIndexByDay[d]={minIdx,maxIdx}; }
  
  // Wind speed min/max by day
  const firstMinMaxWindByDay={}; for(const [d,idxs] of Object.entries(indicesByDay)){ if(!idxs||!idxs.length) continue; let minV=Infinity, maxV=-Infinity; for(const i of idxs){ const v=wind[i]; if(v!=null && (minV===Infinity || v<minV)) minV=v; if(v!=null && (maxV===-Infinity || v>maxV)) maxV=v; } if(minV===Infinity) continue; let minIdx=null, maxIdx=null; for(const i of idxs){ const v=wind[i]; if(minIdx===null && v===minV) minIdx=i; if(maxIdx===null && v===maxV) maxIdx=i; if(minIdx!==null && maxIdx!==null) break; } firstMinMaxWindByDay[d]={minIdx,maxIdx}; }

  const annotations={};
  // Day/Night shading and sunrise/sunset lines
  try{ if (dataset.daily && dataset.daily.length>0 && typeof addDayNightBoxesAligned==='function'){ addDayNightBoxesAligned(labels, dataset.daily, annotations, yMin, yMax, SHOW_SUNRISE_SUNSET); } }catch{}

  // Midnight lines — theme-aware: black (light), rgba(255,255,255,0.5) (dark)
  try{ for (let i=0;i<labels.length;i++){ const d=new Date(labels[i]); if (d.getHours()===0 && d.getMinutes()===0){ const edge=i-0.5; const color = isDark ? 'rgba(255,255,255,0.5)' : '#000000'; annotations[`midnight-${i}`]={ type:'line', xScaleID:'x', yScaleID:'yTemp', xMin:edge, xMax:edge, borderColor:color, borderWidth:1.5, borderDash:[] }; } } }catch{}

  // Freezing & zero lines
  annotations['freezing-line']={ type:'line', xScaleID:'x', yScaleID:'yTemp', yMin:32, yMax:32, borderColor:'rgba(96,165,250,0.75)', borderWidth:2 };
  if (yMin<=0 && 0<=yMax){ annotations['zero-line']={ type:'line', xScaleID:'x', yScaleID:'yTemp', yMin:0, yMax:0, borderColor:'rgba(96,165,250,0.85)', borderWidth:7, borderDash:[6,4] }; }

  // Now line
  if(nowPositionVisible!=null && nowPositionVisible>=0 && nowPositionVisible<=labels.length-1){ const c=isDark?'rgba(234,179,8,0.95)':'rgba(217,119,6,0.95)'; annotations['now-line']={ type:'line', xScaleID:'x', yScaleID:'yTemp', xMin:nowPositionVisible, xMax:nowPositionVisible, borderColor:c, borderWidth:1.5 };
  }

  const approxMaxTicks=getXAxisMaxTicks(labels.length);
  const responsiveMode=(LAYOUT_MODE==='fit');

  const hideChartYAxis = (GRADIENT_MODE==='custom-scale');

  const precipChanceFill = (context) => {
    const area = context.chart.chartArea;
    if (!area) return 'rgba(147,197,253,0.18)';
    const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, 'rgba(147,197,253,0.34)');
    gradient.addColorStop(0.55, 'rgba(96,165,250,0.16)');
    gradient.addColorStop(1, 'rgba(59,130,246,0.02)');
    return gradient;
  };

  const baseDatasets = [
    { type:'bar', label:'Accumulation', data:scaledPrecip, yAxisID:'yAccum', backgroundColor:barColors, borderColor:barColors.map(()=>"#111827"), borderWidth:1, categoryPercentage:1.0, barPercentage:1.0, hidden: false, order: 10 },
    { type:'line', label:'Temperature', data:temps, yAxisID:'yTemp', borderColor:'#eab308', backgroundColor:'rgba(234,179,8,0.20)', tension:0.3, pointRadius:2, pointHoverRadius:3, order: 1,
      datalabels:{ display:(c)=>{ const i=c.dataIndex; const d=labelDates[i]; const fm=firstMinMaxIndexByDay[d]; if(!fm) return false; return i===fm.minIdx || i===fm.maxIdx; }, formatter:(v)=>`${Math.round(v)}\u00B0`, align:(c)=>{ const i=c.dataIndex; const fm=firstMinMaxIndexByDay[labelDates[i]]; return (!fm)?'top':(i===fm.minIdx?'bottom':'top'); }, offset:4, color: isDark ? '#e5e7eb' : '#111827', backgroundColor:'rgba(0,0,0,0)', borderWidth:0, clamp:true }
    },
    { type:'line', label:'Feels Like', data:apTemps, yAxisID:'yTemp', borderColor:'#f472b6', backgroundColor:'rgba(244,114,182,0.18)', tension:0.3, pointRadius:1.5, pointHoverRadius:2.5, hidden: !APPARENT_OVERLAY_ENABLED, order: 2 },
    { type:'line', label:'Chance of Precip', data:prob, yAxisID:'yProb', borderColor:'#3b82f6', backgroundColor:precipChanceFill, fill:true, tension:0.3, pointRadius:1.5, pointHoverRadius:2.5, order: 3 }
  ];
  
  // Add wind speed line if in line mode (uses same scale as precipitation)
  if(WIND_DISPLAY_MODE === 'line'){
    baseDatasets.push({ type:'line', label:'Wind Speed', data:scaledWind, yAxisID:'yAccum', borderColor:'#22d3ee', backgroundColor:'rgba(34,211,238,0.15)', tension:0.3, pointRadius:1, pointHoverRadius:2, hidden:false, borderDash:[4,3], order: 4 });
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: baseDatasets, windDir: windDir, windData: wind },
    options: {
      responsive: responsiveMode,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: {
        padding: {
          left:
            GRADIENT_MODE === "plugin"
              ? GRADIENT_EXTRA_LEFT
              : GRADIENT_EXTRA_LEFT,
          top: 40,
        },
      },
      onClick: (evt) => {
        const a = chart.chartArea;
        if (!a) return;
        const pos = Chart.helpers.getRelativePosition(
          evt && evt.native ? evt.native : evt,
          chart,
        );
        if (
          !(
            pos.x >= a.left &&
            pos.x <= a.right &&
            pos.y >= a.top &&
            pos.y <= a.bottom
          )
        )
          return;
        const sx = chart.scales.x;
        const idx = sx.getValueForPixel(pos.x);
        const i = Math.max(
          0,
          Math.min(
            labels.length - 1,
            typeof idx === "number" ? Math.round(idx) : 0,
          ),
        );
        const h = hourly[i];
        const day = calcDayAccum(hourly, i);
        const host = $("statusLine");
        const svEl = host ? host.querySelector(".summary-value") : null;
        if (svEl) {
          const ratio = getSnowRatio(h.temperatureF);
          const estHour = (
            h.temperatureF <= 32 ? (h.precipIn || 0) * ratio : 0
          ).toFixed(1);
          const windSpd = h.windMph ? h.windMph.toFixed(1) : "N/A";
          const windDir = h.windDir ?? "N/A";
          svEl.textContent = `${formatPointFooter(h.time)} - Temp: ${h.temperatureF.toFixed(1)}\u00B0, Precip: ${h.precipIn.toFixed(1)} mm, Snow: ${h.snowIn.toFixed(1)} mm, Rain: ${h.rainIn.toFixed(1)} mm, Est Snow: ${estHour} mm, Chance: ${h.precipProb ?? "N/A"}%, Wind: ${windSpd} mph @ ${windDir}\u00B0, Day Accum (Liquid): ${day.liquid.toFixed(1)} mm, Day Accum (Snow): ${day.estSnow.toFixed(1)} mm`;
        }
        lastClickedIndex = i;
        lastClickedTime = labels[i];
        setCursorAnnotation(chart, labels[i]);
        chart.update();
        scheduleMobileTooltipHide(chart);
      },
      plugins: {
        legend: { display: false },
        annotation: { annotations },
        datalabels: { display: false },
        hourTicksPlugin: { enabled: true, skipForBar: scaledPrecip },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) =>
              items.length ? formatTooltipTime(items[0].label) : "",
            label: (ctx) => {
              const i = ctx.dataIndex;
              const h = hourly[i];
              if (
                ctx.dataset.yAxisID === "yTemp" &&
                ctx.dataset.label === "Temperature"
              )
                return `Temp: ${Math.round(h.temperatureF)}\u00B0`;
              if (
                ctx.dataset.yAxisID === "yTemp" &&
                ctx.dataset.label === "Feels Like"
              )
                return h.apparentF != null
                  ? `Feels Like: ${Math.round(h.apparentF)}\u00B0`
                  : "Feels Like: N/A";
              if (ctx.dataset.yAxisID === "yProb")
                return `Chance: ${h.precipProb ?? "N/A"}%`;
              if (
                ctx.dataset.yAxisID === "yAccum" &&
                ctx.dataset.label === "Accumulation"
              )
                return `Accum: ${h.precipIn.toFixed(1)} mm`;
              if (
                ctx.dataset.yAxisID === "yAccum" &&
                ctx.dataset.label === "Wind Speed"
              )
                return "";
              return "";
            },
            footer: (items) => {
              if (!items || !items.length) return "";
              const i = items[0].dataIndex;
              const h = hourly[i];
              const windSpd = h.windMph ? h.windMph.toFixed(1) : "N/A";
              const windDir = h.windDir ?? "N/A";
              return [`Wind: ${windSpd} mph`];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: isDark ? "#e5e7eb" : "#111827",
            callback: (val, idx) => formatXAxisHour(labels[idx]),
            autoSkip: true,
            autoSkipPadding: 2,
            maxRotation: 0,
            minRotation: 0,
            maxTicksLimit: approxMaxTicks,
          },
          grid: { display: false },
        },
        yTemp: {
          position: "left",
          display: !hideChartYAxis,
          min: yMin,
          max: yMax,
          ticks: {
            color: isDark ? "#e5e7eb" : "#111827",
            callback: (v) => `${v}°`,
          },
          grid: {
            color: isDark ? "rgba(55,65,81,0.5)" : "rgba(209,213,219,0.7)",
          },
          title: {
            display: !hideChartYAxis,
            text: "Temperature (F)",
            color: isDark ? "#e5e7eb" : "#111827",
          },
        },
        yAccum: {
          position: "right",
          min: 0,
          max: accumMax,
          display: true,
          ticks: {
            display: true,
            color: isDark ? "#93c5fd" : "#1d4ed8",
            stepSize: accumTickStep,
            precision: 0,
            callback: (v) => Number.isInteger(v) ? `${v} mm` : '',
          },
          grid: { drawOnChartArea: false },
          title: {
            display: false,
            text: "Accumulation (mm)",
            color: isDark ? "#93c5fd" : "#1d4ed8",
          },
        },
        yProb: {
          max: 100,
          display: true,
          grid: { drawOnChartArea: false },
          ticks: { display: false },
        },
      },
    },
    plugins: [
      ChartDataLabels,
      hourTicksPlugin,
      TempColorBarPlugin,
      pastHoursHatchingPlugin,
      ...(rangeState !== 24 ? [dayLabelsPlugin] : []),
      ...(WIND_DISPLAY_MODE === "barbs" ? [windBarbsPlugin] : []),
      ...(WIND_DISPLAY_MODE === "arrows" ? [windArrowsPlugin] : []),
      ...(WIND_DISPLAY_MODE === "overlay" ? [windBackgroundPlugin] : []),
    ],
  });

  // Render external gradients
  try{ DomColorBar.render(chart); }catch{}
  try{ SeparateColorBar.render(chart); }catch{}

  // Hover straight line helper
  chart.canvas.addEventListener('mousemove', (evt)=>{ const e=(evt&&evt.native)?evt.native:evt; const pos=Chart.helpers.getRelativePosition(e, chart); const a=chart.chartArea; if(!a || !(pos.x>=a.left&&pos.x<=a.right&&pos.y>=a.top&&pos.y<=a.bottom)){ clearHoverAnnotation(chart); chart.update('none'); return; } const sx=chart.scales.x; const idx = sx.getValueForPixel(pos.x); const i = Math.max(0, Math.min(labels.length-1, typeof idx==='number'? Math.round(idx): 0)); setHoverAnnotation(chart, labels[i]); chart.update('none'); scheduleMobileTooltipHide(chart); });
  chart.canvas.addEventListener('mouseleave', ()=>{ clearHoverAnnotation(chart); chart.update('none'); });

  // Re-apply cursor line and re-center scroll if a point was previously selected
  if(lastClickedIndex !== null && lastClickedIndex < labels.length){
    setCursorAnnotation(chart, labels[lastClickedIndex]);
    chart.update('none');
    scrollToClickedPoint();
  }
}

// Hover / Click annotations helpers
function setCursorAnnotation(chart, xValue){ const anns = (chart.options.plugins.annotation.annotations ||= {}); anns['cursor-line'] = { type:'line', xScaleID:'x', yScaleID:'yTemp', xMin: xValue, xMax: xValue, borderColor:'rgba(234,179,8,0.90)', borderWidth: 2.5, borderDash:[4,3] }; }
function setHoverAnnotation(chart, xValue){ const anns = (chart.options.plugins.annotation.annotations ||= {}); anns['hover-line'] = { type:'line', xScaleID:'x', yScaleID:'yTemp', xMin: xValue, xMax: xValue, borderColor:'rgba(229,231,235,0.5)', borderWidth:1.5 }; }
function clearHoverAnnotation(chart){ const anns = (chart.options.plugins.annotation.annotations ||= {}); if (anns['hover-line']) delete anns['hover-line']; }

// ---------- Theming and Chrome ----------
function updateChromeForTheme(){
  // Summary boxes and status line
  const boxes = document.querySelectorAll('.summary-box');
  boxes.forEach(el=>{
    if (!el) return;
    if (isDark){ el.style.background='rgba(31,41,55,0.85)'; el.style.color='#e5e7eb'; el.style.border='1px solid rgba(255,255,255,0.12)'; }
    else { el.style.background='rgba(255,255,255,0.95)'; el.style.color='#111827'; el.style.border='1px solid rgba(17,24,39,0.20)'; }
  });
  const status=$("statusLine"); if(status){ if(isDark){ status.style.background='rgba(31,41,55,0.90)'; status.style.color='#f3f4f6'; status.style.border='1px solid rgba(255,255,255,0.15)'; } else { status.style.background='rgba(255,255,255,0.98)'; status.style.color='#111827'; status.style.border='1px solid rgba(17,24,39,0.20)'; } }
  // Menu button + panel + selects
  const btn=$("appMenuBtn"), panel=$("appMenuPanel");
  if(btn){ if(isDark){ Object.assign(btn.style,{background:'rgba(31,41,55,0.80)',color:'#f9fafb',border:'1px solid rgba(255,255,255,0.18)'}); } else { Object.assign(btn.style,{background:'rgba(243,244,246,0.95)',color:'#111827',border:'1px solid rgba(17,24,39,0.20)'}); } }
  if(panel){ if(isDark){ Object.assign(panel.style,{background:'rgba(17,24,39,0.96)',color:'#e5e7eb',border:'1px solid #374151'}); } else { Object.assign(panel.style,{background:'rgba(255,255,255,0.98)',color:'#111827',border:'1px solid rgba(17,24,39,0.20)'}); }
    const selects = panel.querySelectorAll('select'); selects.forEach(s=>{ if(!s) return; if(isDark){ s.style.background='#111927'; s.style.color='#e5e7eb'; s.style.border='1px solid #374151'; } else { s.style.background='#ffffff'; s.style.color='#111827'; s.style.border='1px solid rgba(17,24,39,0.25)'; } });
    const labels = panel.querySelectorAll('label'); labels.forEach(l=>{ if(isDark){ l.style.color='#e5e7eb'; } else { l.style.color='#111827'; } });
  }
  // GPS button contrast
  const gps=$("gpsBtn"); if(gps){ if(isDark){ gps.style.background='rgba(31,41,55,0.85)'; gps.style.color='#e5e7eb'; gps.style.border='1px solid rgba(255,255,255,0.18)'; } else { gps.style.background='rgba(243,244,246,0.95)'; gps.style.color='#111827'; gps.style.border='1px solid rgba(17,24,39,0.20)'; } }
}

// ---------- Menu (top-right) ----------
let _menuOutsideHandler=null;
function ensureAppMenu(){
  if($("appMenuBtn")) return;
  ensureButtonContainer();
  const btn = document.createElement('button'); btn.id='appMenuBtn'; btn.textContent='☰ Menu';
  Object.assign(btn.style,{position:'static',height:'32px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(31,41,55,0.75)',color:'#f9fafb',padding:'0 10px',cursor:'pointer',backdropFilter:'blur(6px)'});

  const panel=document.createElement('div'); panel.id='appMenuPanel';
  Object.assign(panel.style,{position:'fixed',right:'16px',top:'56px',zIndex:'2999',minWidth:'274px',padding:'10px',borderRadius:'8px',border:'1px solid #374151',background:'rgba(17,24,39,0.95)',color:'#e5e7eb',display:'none',boxSizing:'border-box'});

  panel.innerHTML = `
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mTheme"> Dark Theme</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mApparent"> Feels Like Line</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mWindLine"> Wind Speed Line</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mTest"> Test Mode</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mLayout"> Layout: Scroll</label>
  <details id="mLocationsMenu" style="margin:8px 0;border-top:1px solid rgba(107,114,128,0.35);border-bottom:1px solid rgba(107,114,128,0.35);padding:8px 0">
    <summary style="cursor:pointer;font-weight:700;user-select:none">Locations</summary>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      <button id="mSaveDefaultLocation" style="width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Save current location as default</button>
      <label style="display:flex;align-items:center;gap:8px;margin:2px 0"><input type="checkbox" id="mGpsDefault"> Use GPS location as default</label>
      <button id="mSaveQuickLocation" style="width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Save current location to Quick List</button>
      <button id="mEditQuickLocations" style="width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Edit Quick List</button>
    </div>
  </details>
  <button id="mData" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Weather Data</button>
  <button id="mCheck" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Check for Updates</button>
  <button id="mAbout" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">About</button>
  `;

  function openMenu(){ panel.style.display='block'; if(!_menuOutsideHandler){ _menuOutsideHandler = (e)=>{ if(!panel.contains(e.target) && e.target!==btn){ closeMenu(); } }; document.addEventListener('click', _menuOutsideHandler, true); } }
  function closeMenu(){ panel.style.display='none'; if(_menuOutsideHandler){ document.removeEventListener('click', _menuOutsideHandler, true); _menuOutsideHandler=null; } }

  btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); const isClosed = (panel.style.display==='none'); if(isClosed) openMenu(); else closeMenu(); });

  document.getElementById('btnContainer').appendChild(btn); document.body.appendChild(panel);

  const mTheme=$("mTheme"), mApp=$("mApparent"), mTest=$("mTest"), mLay=$("mLayout"), mWindLine=$("mWindLine"), mData=$("mData"), mCheck=$("mCheck");
  if(mTheme){ mTheme.checked = isDark; mTheme.addEventListener('change', ()=>{ toggleTheme(); mTheme.checked=isDark; /* keep menu open */ }); }
  if(mApp){ mApp.checked = APPARENT_OVERLAY_ENABLED; mApp.addEventListener('change', ()=>{ toggleApparent(); mApp.checked=APPARENT_OVERLAY_ENABLED; /* keep menu open */ }); }
  if(mTest){ mTest.checked = TEST_MODE_ENABLED; mTest.addEventListener('change', ()=>{ toggleTestMode(); mTest.checked=TEST_MODE_ENABLED; /* keep menu open */ }); }
  if(mLay){ mLay.checked = (LAYOUT_MODE==='scroll'); mLay.addEventListener('change', ()=>{ toggleLayout(); updateScrollScaleVisibility(); mLay.checked=(LAYOUT_MODE==='scroll'); /* keep menu open */ }); }
  if(mWindLine){ mWindLine.checked = WIND_SPEED_LINE_ENABLED; mWindLine.addEventListener('change', ()=>{ toggleWindSpeedLine(); mWindLine.checked=WIND_SPEED_LINE_ENABLED; /* keep menu open */ }); }
  syncGpsDefaultCheckbox();
  $("mSaveDefaultLocation")?.addEventListener('click', ()=>{ saveCurrentLocationAsDefault(); /* keep menu open */ });
  $("mGpsDefault")?.addEventListener('change', (e)=>{ saveGpsDefault(!!e.target.checked); /* keep menu open */ });
  $("mSaveQuickLocation")?.addEventListener('click', ()=>{ saveCurrentLocationToQuickList(); /* keep menu open */ });
  $("mEditQuickLocations")?.addEventListener('click', ()=>{ showQuickListEditor(); /* keep menu open */ });
  if(mCheck){ mCheck.addEventListener('click', ()=>{ checkForUpdates(); /* keep menu open */ }); }
  if(mData){ mData.addEventListener('click', ()=>{ try{ showWeatherData(); }catch(e){ alert('Failed to build Weather Data table'); } closeMenu(); }); }

  const mAbout=$("mAbout");
  if(mAbout){ mAbout.addEventListener('click', ()=>{ showAboutDialog(); closeMenu(); }); }

  updateChromeForTheme();
}

function reserveRightHeaderSpace(){
  // Prevent overlap behind Menu/Maximize: add right padding to header and center other controls
  const header=document.querySelector('.app-header');
  if(header){ header.style.paddingRight = '220px'; header.style.position='relative'; header.style.zIndex='100'; }
  const ctrl = document.querySelector('.header-controls, #headerControls');
  if(ctrl){ ctrl.style.display='flex'; ctrl.style.justifyContent='center'; ctrl.style.alignItems='center'; }
}

function dedupeHeaderControls(){
  const ids = ['themeToggle','testModeToggle','layoutToggle','snowRatioTop'];
  ids.forEach(id=>{ const el=$(id); if(el) el.style.display='none'; });
  // Explicitly remove the provided Snow Ratio select from heading
  try{
    const sr = document.getElementById('snowRatio');
    if(sr){
      const parent = sr.parentElement; sr.remove(); if(parent && parent.tagName==='LABEL'){ parent.remove(); }
    }
  }catch{}
  // Hide other common selectors by class/data attribute and by label text
  const alt = document.querySelector('#snowRatioTop, .snow-ratio-top, [data-snow-ratio-top]');
  if(alt) alt.style.display='none';
  document.querySelectorAll('label').forEach(l=>{ try{ const txt=(l.textContent||'').trim().toLowerCase(); if(txt.includes('snow ratio')){ l.style.display='none'; const forId=l.getAttribute('for'); if(forId){ const el=$(forId); if(el) el.style.display='none'; } const sib=l.nextElementSibling; if(sib && ['SELECT','DIV'].includes(sib.tagName)) sib.style.display='none'; } }catch{} });
}

// ---------- Weather Data Popup ----------
function ensureDataModal(){
  if($("dataModal")) return $("dataModal");
  const modal=document.createElement('div'); modal.id='dataModal'; Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.35)',display:'none',zIndex:'4000'});
  const panel=document.createElement('div'); panel.id='dataPanel'; Object.assign(panel.style,{position:'absolute',left:'50%',top:'10%',transform:'translateX(-50%)',width:'80%',maxWidth:'1200px',maxHeight:'70%',overflow:'hidden',background:isDark?'#0b1220':'#ffffff',color:isDark?'#e5e7eb':'#111827',border:'1px solid rgba(0,0,0,0.2)',borderRadius:'10px',boxShadow:'0 10px 30px rgba(0,0,0,0.35)'});
  const head=document.createElement('div'); head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center'; head.style.padding='8px 12px'; head.style.borderBottom='1px solid rgba(0,0,0,0.15)'; head.innerHTML=`<div style="font-weight:600">Hourly Weather Data</div>`;
  const actions=document.createElement('div'); Object.assign(actions.style,{display:'flex',alignItems:'center',gap:'8px'});
  const nowBtn=document.createElement('button'); nowBtn.id='weatherDataNowBtn'; nowBtn.textContent='Now'; Object.assign(nowBtn.style,{border:'1px solid rgba(0,0,0,0.2)',borderRadius:'6px',background:isDark?'#1f2937':'#f3f4f6',color:'inherit',cursor:'pointer',height:'28px',padding:'0 10px'});
  const close=document.createElement('button'); close.textContent='✕'; Object.assign(close.style,{border:'1px solid rgba(0,0,0,0.2)',borderRadius:'6px',background:'transparent',color:'inherit',cursor:'pointer',height:'28px',width:'32px'}); close.addEventListener('click', ()=> modal.style.display='none'); actions.appendChild(nowBtn); actions.appendChild(close); head.appendChild(actions);
  const wrap=document.createElement('div'); wrap.id='dataTableWrap'; Object.assign(wrap.style,{overflowX:'auto',overflowY:'auto',maxHeight:'calc(70vh - 48px)'});
  const inner=document.createElement('div'); inner.id='dataTableInner'; inner.style.padding='10px'; wrap.appendChild(inner);
  panel.appendChild(head); panel.appendChild(wrap); modal.appendChild(panel); document.body.appendChild(modal);
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.style.display='none'; });
  window.addEventListener('resize', applyWeatherDataModalLayout);
  window.addEventListener('orientationchange', applyWeatherDataModalLayout);
  return modal;
}

function applyWeatherDataModalLayout(){
  const modal=$("dataModal"), panel=$("dataPanel"), wrap=$("dataTableWrap");
  if(!modal || !panel || !wrap) return;
  const mobile=window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches || window.innerWidth<=760;
  if(mobile){
    Object.assign(panel.style,{left:'0',top:'0',transform:'none',width:'100vw',height:'100dvh',maxWidth:'none',maxHeight:'none',borderRadius:'0',border:'0'});
    Object.assign(wrap.style,{maxHeight:'calc(100dvh - 45px)',height:'calc(100dvh - 45px)'});
  } else {
    Object.assign(panel.style,{left:'50%',top:'10%',transform:'translateX(-50%)',width:'80%',height:'auto',maxWidth:'1200px',maxHeight:'70%',borderRadius:'10px',border:'1px solid rgba(0,0,0,0.2)'});
    Object.assign(wrap.style,{maxHeight:'calc(70vh - 48px)',height:'auto'});
  }
}

function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function getWeatherSymbol(hour){
  const precip=hour.precipIn||0, rain=hour.rainIn||0, snow=hour.snowIn||0, temp=hour.temperatureF;
  if(snow>0.0127 || (precip>0.0127 && temp<=32)) return '❄';
  if(rain>0.0127 || precip>0.0127) return '☔';
  const h=new Date(hour.time).getHours();
  return (h>=7 && h<19) ? '☀' : '☁';
}
function windArrowSymbol(directionDeg){
  if(directionDeg==null || Number.isNaN(Number(directionDeg))) return null;
  const arrows=['↑','↗','→','↘','↓','↙','←','↖'];
  return arrows[Math.round((((Number(directionDeg)%360)+360)%360)/45)%8];
}
function formatWindArrow(directionDeg, windMph){
  const arrow=windArrowSymbol(directionDeg);
  if(!arrow) return { html:'N/A', text:'N/A' };
  const speed=Number(windMph)||0;
  const size=Math.max(13, Math.min(28, 13 + speed*0.55));
  const deg=Math.round(Number(directionDeg));
  return { html:`<span style="display:inline-block;font-size:${size.toFixed(0)}px;line-height:1" title="${deg}°">${arrow}</span>`, text:`${arrow} ${deg}°` };
}
function getSelectedWeatherDataColumn(hours){
  if(!hours?.length) return 0;
  if(lastClickedTime){
    const clicked=hours.findIndex(h=>h.time===lastClickedTime);
    if(clicked>=0) return clicked;
  }
  return findCurrentOrPreviousHourIndex(hours.map(h=>h.time));
}
function formatWeatherDataHeader(time, lineBreak='\n'){
  const d=new Date(time);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const hr=d.getHours();
  const ap=hr>=12?'PM':'AM';
  const h12=(hr%12)||12;
  return `${days[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}${lineBreak}${h12} ${ap}`;
}
function isWeatherDataNightHour(time, daily){
  const dayKey=String(time).substring(0,10);
  const day=(daily||[]).find(d=>d.date===dayKey);
  if(!day?.sunrise || !day?.sunset) return false;
  const ms=new Date(time).getTime();
  const sunriseMs=new Date(day.sunrise).getTime();
  const sunsetMs=new Date(day.sunset).getTime();
  if([ms,sunriseMs,sunsetMs].some(Number.isNaN)) return false;
  return ms < sunriseMs || ms >= sunsetMs;
}
function highlightWeatherDataColumn(table, col){
  if(!table || col==null) return;
  table.querySelectorAll('th,td').forEach(cell=>{
    cell.style.background = cell.dataset.baseBg || '';
    cell.style.color = cell.dataset.baseColor || '';
  });
  const th=table.querySelector(`.weather-col-header[data-col="${col}"]`);
  if(th){ th.style.background='#fef3c7'; th.style.color='#78350f'; }
  table.querySelectorAll(`td[data-col="${col}"]`).forEach(cell=>{
    cell.style.background='#fef3c7';
    cell.style.color='#78350f';
  });
}
function centerWeatherDataColumn(table, col){
  const wrap=$("dataTableWrap");
  const th=table?.querySelector(`.weather-col-header[data-col="${col}"]`);
  if(!wrap || !th) return;
  const left=th.offsetLeft - (wrap.clientWidth / 2) + (th.offsetWidth / 2);
  wrap.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
}
function cleanClipboardCell(value){ return String(value ?? '').replace(/[\r\n]+/g, ' '); }

function showWeatherData(){
  const modal=ensureDataModal(); const inner=$("dataTableInner"); if(!inner) return;
  const ds=currentDataset; if(!ds||!ds.hourly){ alert('No dataset loaded'); return; }
  const H=ds.hourly; const cols=H.map(h=>h.time);
  const fields=[
    { label:'Weather', html:h=>`<span style="font-size:18px;line-height:1">${getWeatherSymbol(h)}</span>`, copy:h=>getWeatherSymbol(h), align:'center' },
    { label:'Temp (\u00B0F)', html:h=>h.temperatureF!=null? h.temperatureF.toFixed(1):'N/A', copy:h=>h.temperatureF!=null? h.temperatureF.toFixed(1):'N/A', bg:h=>h.temperatureF!=null?TempColorBarPlugin.colorAtTemp(h.temperatureF):'', color:h=>h.temperatureF!=null?'#111827':'' },
    { label:'Feels Like (\u00B0F)', html:h=>h.apparentF!=null? h.apparentF.toFixed(1):'N/A', copy:h=>h.apparentF!=null? h.apparentF.toFixed(1):'N/A' },
    { label:'Chance (%)', html:h=>h.precipProb!=null? h.precipProb:'N/A', copy:h=>h.precipProb!=null? h.precipProb:'N/A' },
    { label:'Precip (mm)', html:h=>h.precipIn!=null? h.precipIn.toFixed(1):'0.0', copy:h=>h.precipIn!=null? h.precipIn.toFixed(1):'0.0' },
    { label:'Rain (mm)', html:h=>h.rainIn!=null? h.rainIn.toFixed(1):'0.0', copy:h=>h.rainIn!=null? h.rainIn.toFixed(1):'0.0' },
    { label:'Snow (mm)', html:h=>h.snowIn!=null? h.snowIn.toFixed(1):'0.0', copy:h=>h.snowIn!=null? h.snowIn.toFixed(1):'0.0' },
    { label:'Precip Type', html:h=>escapeHtml(h.precipType??'none'), copy:h=>h.precipType??'none' },
    { label:'Wind (mph)', html:h=>h.windMph!=null? h.windMph.toFixed(1):'N/A', copy:h=>h.windMph!=null? h.windMph.toFixed(1):'N/A' },
    { label:'Wind Dir', html:h=>formatWindArrow(h.windDir, h.windMph).html, copy:h=>formatWindArrow(h.windDir, h.windMph).text, align:'center' }
  ];
  // Add Copy button
  let html = '<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button id="copyWeatherDataBtn" style="padding:4px 12px;border-radius:5px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer;font-size:13px;">Copy Table</button></div>';
  html += '<table id="weatherDataTable" style="border-collapse:collapse; font: 12px system-ui,Segoe UI,Roboto,sans-serif">';
  // Header row
  html += '<tr><th data-base-bg="#111827" data-base-color="#e5e7eb" style="position:sticky;left:0;background:#111827;color:#e5e7eb;padding:6px 8px;border:1px solid #374151">Metric</th>';
  cols.forEach((t, colIdx) => {
    const label=formatWeatherDataHeader(t, '<br>');
    const night=isWeatherDataNightHour(t, ds.daily);
    const bg=night ? '#e5e7eb' : '';
    const color=night ? '#111827' : '';
    html += `<th class="weather-col-header" data-col="${colIdx}" data-base-bg="${bg}" data-base-color="${color}" style="padding:6px 8px;border:1px solid #374151;white-space:nowrap;cursor:pointer;user-select:none;line-height:1.25;${bg?`background:${bg};`:''}${color?`color:${color};`:''}">${label}</th>`;
  });
  html += '</tr>';
  // Data rows
  fields.forEach(field => {
    html += `<tr>`;
    html += `<td data-base-bg="#111827" data-base-color="#e5e7eb" style="position:sticky;left:0;background:#111827;color:#e5e7eb;padding:6px 8px;border:1px solid #374151;font-weight:600">${field.label}</td>`;
    H.forEach((h, colIdx) => {
      const bg=field.bg?.(h)||'';
      const color=field.color?.(h)||'';
      const align=field.align||'right';
      const baseAttrs=`data-base-bg="${escapeHtml(bg)}" data-base-color="${escapeHtml(color)}"`;
      const style=`padding:6px 8px;border:1px solid #374151;text-align:${align};${bg?`background:${bg};`:''}${color?`color:${color};`:''}`;
      html += `<td data-col="${colIdx}" ${baseAttrs} style="${style}">${field.html(h)}</td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  inner.innerHTML = html;

  // Highlight column on any table cell click
  const table = inner.querySelector('#weatherDataTable');
  table?.addEventListener('click', function(e) {
    const cell = e.target.closest('[data-col]');
    if (!cell || !table.contains(cell)) return;
    const col=cell.getAttribute('data-col');
    highlightWeatherDataColumn(table, col);
  });
  const selectedCol=getSelectedWeatherDataColumn(H);
  highlightWeatherDataColumn(table, selectedCol);
  const nowBtn=$("weatherDataNowBtn");
  if(nowBtn) nowBtn.onclick=()=>{
    const nowCol=findCurrentOrPreviousHourIndex(H.map(h=>h.time));
    highlightWeatherDataColumn(table, nowCol);
    centerWeatherDataColumn(table, nowCol);
  };

  // Copy to clipboard button
  const copyBtn = inner.querySelector('#copyWeatherDataBtn');
  copyBtn?.addEventListener('click', function() {
    // Build tab-separated values for Excel
    let tsv = '';
    // Header row
    tsv += 'Metric\t' + cols.map(t => cleanClipboardCell(formatWeatherDataHeader(t))).join('\t') + '\n';
    // Data rows
    fields.forEach(field => {
      tsv += cleanClipboardCell(field.label) + '\t' + H.map(h => cleanClipboardCell(field.copy(h))).join('\t') + '\n';
    });
    // Copy to clipboard
    navigator.clipboard.writeText(tsv).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(()=>{ copyBtn.textContent = 'Copy Table'; }, 1200);
    }, () => {
      copyBtn.textContent = 'Failed';
      setTimeout(()=>{ copyBtn.textContent = 'Copy Table'; }, 1200);
    });
  });
  modal.style.display='block';
  applyWeatherDataModalLayout();
  requestAnimationFrame(()=>centerWeatherDataColumn(table, selectedCol));
}

function showQuickListEditor(){
  let locations=readSavedLocations().map(loc=>({...loc}));
  let editorDefault=readDefaultLocation();
  let modal=$("quickListEditorModal");
  if(!modal){
    modal=document.createElement('div');
    modal.id='quickListEditorModal';
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.45)',display:'none',zIndex:'4500',padding:'16px',boxSizing:'border-box'});
    modal.innerHTML=`
      <div id="quickListEditorPanel" style="display:flex;flex-direction:column;margin:0 auto;width:min(920px,100%);height:calc(100vh - 32px);max-height:820px;overflow:hidden;background:${isDark?'#0b1220':'#ffffff'};color:${isDark?'#e5e7eb':'#111827'};border:1px solid rgba(0,0,0,0.25);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.35)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(107,114,128,0.35)">
          <div style="font-weight:700">Edit Quick List</div>
          <button id="quickListClose" style="border:1px solid rgba(107,114,128,0.5);border-radius:6px;background:transparent;color:inherit;cursor:pointer;height:28px;width:32px">x</button>
        </div>
        <div style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid rgba(107,114,128,0.25)">
          <button id="quickGpsDefaultStar" style="height:32px;border:0;background:transparent;color:#facc15;cursor:pointer;padding:0 10px;font-size:1.15rem" title="Use GPS location as default">☆</button>
          <span style="align-self:center;margin-right:8px">Use GPS location as default</span>
          <button id="quickSortAlpha" style="height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Sort A-Z</button>
          <button id="quickSortWestEast" style="height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Sort West-East</button>
          <button id="quickSortNorthSouth" style="height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Sort North-South</button>
        </div>
        <div id="quickListRows" style="padding:10px 12px;overflow:auto;flex:1;min-height:0"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid rgba(107,114,128,0.35);flex:0 0 auto;background:inherit">
          <button id="quickListCancel" style="height:34px;border-radius:6px;border:1px solid #374151;background:transparent;color:inherit;cursor:pointer;padding:0 14px">Cancel</button>
          <button id="quickListSave" style="height:34px;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;padding:0 14px">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });
  }
  const rows=$("quickListRows");
  let dragState=null;
  function isDefaultLoc(loc){ return editorDefault?.mode==='saved' && editorDefault.locationId===loc.id; }
  function updateGpsStar(){ const star=$("quickGpsDefaultStar"); if(star){ const active=editorDefault?.mode==='gps'; star.textContent=active?'★':'☆'; star.style.opacity=active?'1':'0.5'; star.setAttribute('aria-pressed', active?'true':'false'); } }
  function clearDropIndicators(){
    rows?.querySelectorAll('[data-index]').forEach(row=>{
      row.style.borderBottom='1px solid rgba(107,114,128,0.22)';
      row.style.boxShadow='none';
    });
  }
  function getDropIndex(clientY){
    const rowEls=[...rows.querySelectorAll('[data-index]')];
    if(!rowEls.length) return 0;
    for(const row of rowEls){
      const rect=row.getBoundingClientRect();
      if(clientY < rect.top + rect.height / 2) return Number(row.dataset.index);
    }
    return rowEls.length;
  }
  function showDropIndicator(dropIndex){
    clearDropIndicators();
    const rowEls=[...rows.querySelectorAll('[data-index]')];
    const color=isDark ? '#facc15' : '#2563eb';
    if(dropIndex >= rowEls.length){
      const last=rowEls[rowEls.length - 1];
      if(last) last.style.boxShadow=`inset 0 -3px 0 ${color}`;
      return;
    }
    const target=rowEls[dropIndex];
    if(target) target.style.boxShadow=`inset 0 3px 0 ${color}`;
  }
  function moveLocationToDrop(from, dropIndex){
    if(from<0 || from>=locations.length) return;
    let insertAt=Math.max(0, Math.min(dropIndex, locations.length));
    if(insertAt>from) insertAt--;
    if(insertAt===from) return;
    const [item]=locations.splice(from,1);
    locations.splice(insertAt,0,item);
  }
  function render(){
    if(!rows) return;
    rows.textContent='';
    updateGpsStar();
    if(!locations.length){
      const empty=document.createElement('div');
      empty.textContent='No saved locations.';
      empty.style.opacity='0.75';
      rows.appendChild(empty);
      return;
    }
    locations.forEach((loc, index)=>{
      const row=document.createElement('div');
      row.dataset.index=String(index);
      Object.assign(row.style,{display:'grid',gridTemplateColumns:'34px 1fr auto auto',gap:'8px',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(107,114,128,0.22)',boxShadow:'none',touchAction:'none'});
      const star=document.createElement('button');
      const defaultLoc=isDefaultLoc(loc);
      star.textContent=defaultLoc?'★':'☆';
      star.title='Set as default location';
      Object.assign(star.style,{height:'30px',width:'30px',border:'0',background:'transparent',color:'#facc15',cursor:'pointer',fontSize:'1.15rem',opacity:defaultLoc?'1':'0.5'});
      star.addEventListener('click', ()=>{ editorDefault={mode:'saved',locationId:loc.id,name:loc.name,lat:loc.lat,lon:loc.lon,savedAt:new Date().toISOString()}; render(); });
      const input=document.createElement('input');
      input.value=loc.name;
      input.title=`${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
      Object.assign(input.style,{minWidth:'0',height:'30px',boxSizing:'border-box',borderRadius:'6px',border:'1px solid rgba(107,114,128,0.5)',padding:'0 8px',background:'#ffffff',color:'#111827'});
      input.addEventListener('input', ()=>{ locations[index].name=input.value; });
      const coords=document.createElement('div');
      coords.textContent=`${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}`;
      Object.assign(coords.style,{fontSize:'0.78rem',opacity:'0.75',whiteSpace:'nowrap'});
      const controls=document.createElement('div');
      Object.assign(controls.style,{display:'flex',gap:'4px'});
      [['Drag','drag'],['Delete','delete']].forEach(([label, action])=>{
        const b=document.createElement('button');
        b.textContent=label;
        Object.assign(b.style,{height:'28px',borderRadius:'6px',border:'1px solid #374151',background:action==='delete'?'#7f1d1d':'#1f2937',color:'#e5e7eb',cursor:action==='drag'?'grab':'pointer',touchAction:'none'});
        b.addEventListener('click', ()=>{
          if(action==='delete'){ locations.splice(index,1); render(); }
        });
        if(action==='drag'){
          b.addEventListener('pointerdown', e=>{
            e.preventDefault();
            b.setPointerCapture?.(e.pointerId);
            dragState={from:index,dropIndex:index,pointerId:e.pointerId};
            row.style.opacity='0.55';
            b.style.cursor='grabbing';
            showDropIndicator(index);
          });
          b.addEventListener('pointermove', e=>{
            if(!dragState || dragState.pointerId!==e.pointerId) return;
            const dropIndex=getDropIndex(e.clientY);
            dragState.dropIndex=dropIndex;
            showDropIndicator(dropIndex);
          });
          const endDrag=e=>{
            if(dragState?.pointerId===e.pointerId){
              moveLocationToDrop(dragState.from, dragState.dropIndex);
              dragState=null;
              b.style.cursor='grab';
              clearDropIndicators();
              render();
            }
          };
          b.addEventListener('pointerup', endDrag);
          b.addEventListener('pointercancel', endDrag);
        }
        controls.appendChild(b);
      });
      row.appendChild(star);
      row.appendChild(input);
      row.appendChild(coords);
      row.appendChild(controls);
      rows.appendChild(row);
    });
  }
  $("quickListClose").onclick=() => { modal.style.display='none'; };
  $("quickListCancel").onclick=() => { modal.style.display='none'; };
  $("quickGpsDefaultStar").onclick=() => { editorDefault={mode:'gps',savedAt:new Date().toISOString()}; render(); };
  $("quickSortAlpha").onclick=() => { locations.sort((a,b)=>a.name.localeCompare(b.name)); render(); };
  $("quickSortWestEast").onclick=() => { locations.sort((a,b)=>a.lon-b.lon); render(); };
  $("quickSortNorthSouth").onclick=() => { locations.sort((a,b)=>b.lat-a.lat); render(); };
  $("quickListSave").onclick=() => {
    const cleaned=locations.map(normalizeLocation).filter(Boolean);
    writeSavedLocations(cleaned);
    if(editorDefault?.mode==='gps') writeDefaultLocation({...editorDefault,savedAt:new Date().toISOString()});
    else if(editorDefault?.mode==='saved' && editorDefault.locationId && cleaned.some(loc=>loc.id===editorDefault.locationId)){
      const loc=cleaned.find(item=>item.id===editorDefault.locationId);
      writeDefaultLocation({mode:'saved',locationId:loc.id,name:loc.name,lat:loc.lat,lon:loc.lon,savedAt:new Date().toISOString()});
    } else {
      const def=readDefaultLocation();
      if(def?.mode==='saved' && def.locationId && !cleaned.some(loc=>loc.id===def.locationId)) clearDefaultLocation();
    }
    populateQuickSelectSorted();
    syncGpsDefaultCheckbox();
    modal.style.display='none';
  };
  render();
  modal.style.display='block';
}

// ---------- Range button label helper ----------
function updateRangeButtonLabel(){
  const btn = $('rangeToggle');
  if(!btn) return;
  if(pastDays === 0){
    const rangeState = RANGE_STATES[rangeIndex];
    let label;
    if(rangeState === 24) label = 'Range: 24h';
    else if(rangeState === 72) label = 'Range: 3d';
    else if(rangeState === 168) label = 'Range: 7d';
    else if(rangeState === 'max') label = 'Range: 15d';
    else label = `Range: ${rangeState}h`;
    btn.textContent = label;
    btn.setAttribute('title', `${label} | Shift-click or long-press for history`);
  } else {
    btn.textContent = `Range: -${pastDays}d`;
    btn.setAttribute('title', `${pastDays}d History | Shift-click or long-press to cycle (0 → 3 → 7 → 14 days)`);
  }
}

// ---------- Long-press handler for Range button ----------
function setupRangeButtonLongPress(){
  const btn = $('rangeToggle');
  if(!btn) return;
  
  let pressTimer = null;
  let isLongPress = false;
  
  function startPress(){
    isLongPress = false;
    pressTimer = setTimeout(()=>{
      isLongPress = true;
      handlePastDaysCycle();
    }, 500);
  }
  
  function endPress(){
    if(pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }
  
  async function handlePastDaysCycle(){
    const nextIndex = (PAST_DAYS_CYCLE.indexOf(pastDays) + 1) % PAST_DAYS_CYCLE.length;
    pastDays = PAST_DAYS_CYCLE[nextIndex];
    try{
      const data = await loadWeatherData(currentCityName, currentLocationLat, currentLocationLon, pastDays);
      buildChart(data);
      updateRangeButtonLabel();
    }catch(e){ console.error('Failed to load past data:', e); }
  }
  btn.addEventListener('touchstart', startPress, { passive: true });
  btn.addEventListener('touchend', endPress, { passive: true });
  btn.addEventListener('mousedown', startPress, false);
  btn.addEventListener('mouseup', endPress, false);
  btn.addEventListener('click', (evt)=>{
    if(isLongPress) return;
    if(evt.shiftKey){
      handlePastDaysCycle();
    } else {
      toggleRange(evt);
    }
  }, false);
}

// ---------- Other UI wiring ----------
function toggleTheme(){ isDark=!isDark; localStorage.setItem('PEVcast-dark-mode', JSON.stringify(isDark)); document.body.classList.toggle('dark', isDark); document.body.classList.toggle('light', !isDark); updateChromeForTheme(); if(currentDataset) buildChart(currentDataset); updateVersionChip(); }
function toggleWindSpeedLine(){ WIND_SPEED_LINE_ENABLED=!WIND_SPEED_LINE_ENABLED; localStorage.setItem(WIND_SPEED_LINE_STORAGE_KEY, JSON.stringify(WIND_SPEED_LINE_ENABLED)); WIND_DISPLAY_MODE=WIND_SPEED_LINE_ENABLED?'line':'off'; if(currentDataset) buildChart(currentDataset); }
function toggleTestMode(){ TEST_MODE_ENABLED=!TEST_MODE_ENABLED; const el=$("testModeBanner"); if(el) el.classList.toggle('hidden', !TEST_MODE_ENABLED); const fallback=readSavedLocations()[0] || normalizeLocation({name:'Moon Township, PA', ...QUICK_SELECT_CITIES['Moon Township, PA']}); const name=currentCityName||fallback.name; const coords=(currentLocationLat!=null&&currentLocationLon!=null)?{lat:currentLocationLat,lon:currentLocationLon}:fallback; loadCityByName(name, coords).catch(e=> alert(e?.message||'Failed to load in Test Mode.')); updateVersionChip(); }
function toggleRange(){
  pastDays = 0;
  LAYOUT_MODE = 'fit'; updateLayoutButtonLabel(); const mLay=$('mLayout'); if(mLay) mLay.checked=false;
  rangeIndex=(rangeIndex+1)%RANGE_STATES.length; if(currentDataset){ try{ updateRangeButtonLabel(); buildChart(currentDataset); }catch{ buildChart(currentDataset);} } 
}
function toggleLayout(){ LAYOUT_MODE = (LAYOUT_MODE==='fit')?'scroll':'fit'; updateLayoutButtonLabel(); if(currentDataset) buildChart(currentDataset); }
function updateLayoutButtonLabel(){ const btn = $('layoutToggle'); if(btn) btn.textContent = (LAYOUT_MODE==='scroll') ? 'Layout: Scroll' : 'Layout: Fit'; }
function toggleApparent(){ APPARENT_OVERLAY_ENABLED = !APPARENT_OVERLAY_ENABLED; localStorage.setItem(FEELS_LIKE_LINE_STORAGE_KEY, JSON.stringify(APPARENT_OVERLAY_ENABLED)); if(currentDataset) buildChart(currentDataset); }
function updateScrollScaleVisibility(){ }
function scrollToClickedPoint(){ if(lastClickedIndex==null) return; requestAnimationFrame(()=>{ const scroller=$('chartScroll'); if(!chart||!scroller) return; const px=chart.scales?.x?.getPixelForValue(lastClickedIndex); if(px==null||isNaN(px)) return; scroller.scrollLeft=px-scroller.clientWidth/2; }); }
function ensureScrollScaleSlider(){ const slider=$("mainScrollScale"); const valueSpan=$("mainScrollScaleValue"); if(!slider) return; if(valueSpan && !valueSpan.textContent) valueSpan.textContent='24h'; slider.addEventListener('input', ()=>{ const maxVisibleHours=parseFloat(slider.max); const desiredVisibleHours=snapVisibleHours(parseFloat(slider.value), maxVisibleHours); slider.value=String(desiredVisibleHours); updateVisibleHoursDisplay(valueSpan, desiredVisibleHours, maxVisibleHours); const wantsFit=desiredVisibleHours >= maxVisibleHours; if(wantsFit){ LAYOUT_MODE='fit'; updateLayoutButtonLabel(); const mLay=$("mLayout"); if(mLay) mLay.checked=false; } else if(LAYOUT_MODE==='fit'){ LAYOUT_MODE='scroll'; updateLayoutButtonLabel(); const mLay=$("mLayout"); if(mLay) mLay.checked=true; }
    const scroller=$('chartScroll'); const pxPerHour=56;
    if(scroller){ LAYOUT_SCROLL_SCALE=getScaleForVisibleHours(desiredVisibleHours, scroller.clientWidth, pxPerHour); }
    if(currentDataset){ buildChart(currentDataset); scrollToClickedPoint(); } }); updateScrollScaleVisibility(); }

function openChartCompare(){
  if(!currentDataset || !Array.isArray(currentDataset.hourly) || currentDataset.hourly.length === 0){
    alert('Load a forecast before opening Chart Compare.');
    return;
  }
  const hourly = currentDataset.hourly.map(h => ({
    time: h.time,
    temperatureF: h.temperatureF ?? null,
    precipProb: h.precipProb ?? null,
    rainMm: h.rainIn ?? 0,
    precipitationMm: h.precipIn ?? 0
  }));
  const payload = {
    cityName: currentCityName || $('cityTitle')?.textContent || 'Current forecast',
    latitude: currentLocationLat,
    longitude: currentLocationLon,
    generatedAt: new Date().toISOString(),
    hourly,
    daily: (currentDataset.daily || []).map(d => ({
      date: d.date,
      sunrise: d.sunrise,
      sunset: d.sunset
    }))
  };
  try{
    sessionStorage.setItem('PEVcast.chartCompare.dataset', JSON.stringify(payload));
    window.location.href = 'chart-compare.html';
  }catch(e){
    console.error(e);
    alert('Unable to open Chart Compare. The forecast dataset could not be saved in this browser session.');
  }
}
async function loadCityByName(cityName, coords){ try{ lastClickedIndex=null; lastClickedTime=null; const data=await loadWeatherData(cityName, coords.lat, coords.lon, pastDays); currentCityName=cityName; currentLocationLat=coords.lat; currentLocationLon=coords.lon; setCityTitle(cityName); const host=$("statusLine"); const sv = host ? host.querySelector('.summary-value') : null; if (sv){ sv.textContent = "Click a point on the chart..."; } currentDataset=data; buildChart(data); } catch(e){ console.error(e); alert(e?.message || 'Failed to load weather data.'); } }
async function handleQuickSelectChange(){ const qs=$("quickSelect"); const id=qs ? qs.value : null; if(!id) return; const loc=findSavedLocationById(id); if(!loc) return; const cityInput=$("cityInput"); if(cityInput) cityInput.value=''; await loadCityByName(loc.name, loc); if(qs) qs.value=''; }

function installMaximizeStyles(){ if(document.getElementById('maximizeStyles')) return; const s=document.createElement('style'); s.id='maximizeStyles'; s.textContent = `
  body.maximized .app-header, body.maximized .summary-box, body.maximized .app-footer, body.maximized #testModeBanner, body.maximized #statusLine, body.maximized #matchModal, body.maximized #versionChip { display: none !important; }
  body.maximized .app-main { padding: 0 !important; }
  body.maximized .chart-container { position: fixed !important; inset: 0 !important; z-index: 999 !important; height: 100vh !important; }
`; document.head.appendChild(s); }

// ---------- Button Container (holds Maximize + Menu side-by-side) ----------
function ensureButtonContainer(){ if(document.getElementById('btnContainer')) return; const c=document.createElement('div'); c.id='btnContainer'; Object.assign(c.style,{position:'fixed',right:'6px',top:'16px',zIndex:'3000',display:'flex',gap:'8px',alignItems:'center'}); document.body.appendChild(c); }

function ensureRangeButton(){ const btn=$("rangeToggle"); if(!btn || btn.parentElement?.id==='btnContainer') return; ensureButtonContainer(); const container=document.getElementById('btnContainer'); Object.assign(btn.style,{position:'static',height:'32px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(31,41,55,0.75)',color:'#f9fafb',padding:'0 10px',cursor:'pointer',backdropFilter:'blur(6px)',fontSize:'0.85rem'}); container.appendChild(btn); }

function ensureMaximizeUI(){ if(document.getElementById('chartMaxBtn')) return; ensureButtonContainer(); const b=document.createElement('button'); b.id='chartMaxBtn'; b.title='Maximize'; b.textContent='⛶'; Object.assign(b.style,{position:'static',width:'32px',height:'32px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'8px',background:'rgba(31,41,55,0.75)',color:'#f9fafb',border:'1px solid rgba(255,255,255,0.18)',backdropFilter:'blur(6px)',cursor:'pointer',userSelect:'none'}); b.addEventListener('click', ()=>{ const m=document.body.classList.toggle('maximized'); b.textContent = m ? '🗗' : '⛶'; try{ chart?.resize(); DomColorBar.render(chart); SeparateColorBar.render(chart); }catch{} }); document.getElementById('btnContainer').appendChild(b); }



// ---------- Reverse Geocoding ----------
function isValidCoordinate(lat, lon){
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
function reverseGeocodeCacheKey(lat, lon){ return `city-first-zipfix:${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`; }
function readReverseGeocodeCache(){
  const raw=readStoredJson(REVERSE_GEOCODE_CACHE_STORAGE_KEY);
  return raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};
}
function writeReverseGeocodeCache(cache){ writeStoredJson(REVERSE_GEOCODE_CACHE_STORAGE_KEY, cache || {}); }
function uniqueTruthy(parts){ return parts.filter(Boolean).filter((value, index, arr)=>arr.indexOf(value)===index); }
function correctReverseGeocodePostal({lat, lon, city, postal}){
  const cityText=String(city||'').toLowerCase();
  const isKnownMoonArea=/moon|moon twp|moon township|carnot|coraopolis/.test(cityText);
  const nearMoon=Math.abs(Number(lat)-40.520) <= 0.035 && Math.abs(Number(lon)-(-80.241)) <= 0.045;
  if(nearMoon && isKnownMoonArea) return '15108';
  return postal || null;
}
function buildReverseGeocodeLabel({lat, lon, street, city, state, postal}){
  const place=city || street || null;
  postal=correctReverseGeocodePostal({lat, lon, city:place, postal});
  const region=uniqueTruthy([state, postal]).join(' ');
  if(place && region) return `${place}, ${region}`;
  if(place) return place;
  return null;
}
function formatBigDataCloudReverseGeocode(j, lat, lon){
  const info=[...(j?.localityInfo?.informative||[]), ...(j?.localityInfo?.administrative||[])];
  const streetRec=info.find(item=>{
    const type=String(item?.type||item?.description||'').toLowerCase();
    return type.includes('street') || type.includes('road') || type.includes('route') || type.includes('neighbourhood') || type.includes('neighborhood');
  });
  return buildReverseGeocodeLabel({
    lat, lon,
    street: streetRec?.name || j?.road || j?.street || j?.streetName || j?.thoroughfare || null,
    city: j?.city || j?.locality || null,
    state: j?.principalSubdivisionCode?.replace(/^[A-Z]+-/,'') || j?.principalSubdivision || j?.countryCode || null,
    postal: j?.postcode || j?.postalCode || j?.zipcode || j?.zipCode || null
  });
}
function formatNominatimReverseGeocode(j, lat, lon){
  const a=j?.address || {};
  return buildReverseGeocodeLabel({
    lat, lon,
    street: a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.neighbourhood || a.neighborhood || null,
    city: a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || null,
    state: a.state || a.region || null,
    postal: a.postcode || null
  });
}
async function reverseGeocode(lat, lon){
  lat=Number(lat); lon=Number(lon);
  if(!isValidCoordinate(lat, lon)){
    console.warn('[ReverseGeocode] Skipping lookup: invalid coordinates', {lat, lon});
    return null;
  }
  const cacheKey=reverseGeocodeCacheKey(lat, lon);
  const cache=readReverseGeocodeCache();
  if(cache[cacheKey]?.label) return cache[cacheKey].label;

  try{
    const params=new URLSearchParams({latitude:String(lat), longitude:String(lon), localityLanguage:'en'});
    const res=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
    if(res.ok){
      const label=formatBigDataCloudReverseGeocode(await res.json(), lat, lon);
      if(label){ cache[cacheKey]={label, provider:'bigdatacloud', savedAt:new Date().toISOString()}; writeReverseGeocodeCache(cache); return label; }
      console.warn('[ReverseGeocode] BigDataCloud returned no usable label.');
    } else {
      console.warn(`[ReverseGeocode] BigDataCloud failed: ${res.status} ${res.statusText}`);
    }
  }catch(e){
    console.warn('[ReverseGeocode] BigDataCloud request failed:', e);
  }

  try{
    const params=new URLSearchParams({format:'jsonv2', lat:String(lat), lon:String(lon), addressdetails:'1', zoom:'18', 'accept-language':'en'});
    const res=await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {headers:{Accept:'application/json'}});
    if(res.ok){
      const label=formatNominatimReverseGeocode(await res.json(), lat, lon);
      if(label){ cache[cacheKey]={label, provider:'nominatim', savedAt:new Date().toISOString()}; writeReverseGeocodeCache(cache); return label; }
      console.warn('[ReverseGeocode] Nominatim returned no usable label.');
    } else {
      console.warn(`[ReverseGeocode] Nominatim failed: ${res.status} ${res.statusText}`);
    }
  }catch(e){
    console.warn('[ReverseGeocode] Nominatim request failed:', e);
  }
  return null;
}

// ---------- Quick Select + GPS ----------
function populateQuickSelectSorted(){ const select=$("quickSelect"); if(!select) return; for (let i = select.options.length - 1; i >= 1; i--) select.remove(i); for (const loc of readSavedLocations()){ const opt=document.createElement('option'); opt.value=loc.id; opt.textContent=loc.name; select.appendChild(opt); } }

function ensureGPSButton(){ const qs=$("quickSelect"); if(!qs || $("gpsBtn")) return; const btn=document.createElement('button'); btn.id='gpsBtn'; btn.textContent='Use GPS'; btn.title='Use device location'; btn.style.marginLeft='6px'; btn.style.padding='4px 8px'; btn.style.borderRadius='6px'; btn.style.cursor='pointer'; qs.insertAdjacentElement('afterend', btn); updateChromeForTheme(); btn.addEventListener('click', async()=>{ try{ const cityInput=$("cityInput"); if(cityInput) cityInput.value=''; await loadGpsLocation(false); }catch(err){ alert('Unable to get location: '+(err?.message||'Unknown error')); } }); }

// ---------- Version chip (Test Mode) ----------
function updateVersionChip(){
  let chip = document.getElementById('versionChip');
  if(!chip){ chip=document.createElement('div'); chip.id='versionChip'; Object.assign(chip.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'1100',padding:'4px 8px',borderRadius:'6px',font:'12px system-ui,Segoe UI,Roboto,sans-serif',border:'1px solid rgba(0,0,0,0.2)'}); document.body.appendChild(chip); }
  chip.textContent = `v ${window.APP_VERSION || '?.?.?'}${TEST_MODE_ENABLED?' • Test Mode':''}`;
  if(TEST_MODE_ENABLED){ chip.style.display='block'; chip.style.background = isDark ? 'rgba(31,41,55,0.85)' : 'rgba(255,255,255,0.95)'; chip.style.color = isDark ? '#e5e7eb' : '#111827'; }
  else { chip.style.display='none'; }
}

// ======= Update Checking =======
let latestVersionData = null;
let updateAvailable = false;

async function checkForUpdates(){
  try {
    console.log('[Update] Checking for updates...');
    const response = await fetch('./version.json?cache_bust=' + Date.now());
    if (!response.ok) throw new Error('Failed to fetch version info');
    
    latestVersionData = await response.json();
    const currentVersion = window.FILE_VERSIONS?.js || 'unknown';
    const latestVersion = latestVersionData.js;
    
    console.log(`[Update] Current: ${currentVersion}, Latest: ${latestVersion}`);
    
    if (latestVersion && latestVersion !== currentVersion) {
      updateAvailable = true;
      showUpdateBanner();
      console.log('[Update] Update available!');
      return true;
    } else {
      console.log('[Update] Already on latest version');
      alert('PEVcast is already up to date!');
      return false;
    }
  } catch (e) {
    console.error('[Update] Check failed:', e);
    alert('Failed to check for updates. Please try again.');
    return false;
  }
}

function showUpdateBanner(){
  const banner = $("updateBanner");
  if (banner) {
    banner.classList.remove('hidden');
    console.log('[Update] Showing update banner');
  }
}

function hideUpdateBanner(){
  const banner = $("updateBanner");
  if (banner) {
    banner.classList.add('hidden');
  }
}

function reloadForUpdate(){
  console.log('[Update] Reloading for update...');
  // Skip service worker cache bypass - reload normally so SW can serve updated assets
  window.location.reload(true); // Hard reload to bypass cache
}

async function loadInitialLocation(){
  readSavedLocations();
  const def=readDefaultLocation();
  if(def?.mode==='gps'){
    try{ await loadGpsLocation(true); updateRangeButtonLabel(); return; }
    catch(e){ console.warn('[Locations] GPS default failed, falling back:', e); }
  }
  if(def?.mode==='saved'){
    const saved=def.locationId ? findSavedLocationById(def.locationId) : null;
    const snapshot=normalizeLocation(def);
    const loc=saved || snapshot;
    if(loc){ await loadCityByName(loc.name, loc); updateRangeButtonLabel(); return; }
  }
  try{
    await loadGpsLocation(true);
    updateRangeButtonLabel();
    return;
  }catch(e){
    console.warn('[Locations] Startup GPS failed, falling back to saved quick list:', e);
  }
  const first=readSavedLocations()[0];
  if(first){ await loadCityByName(first.name, first); updateRangeButtonLabel(); return; }
  const moon=normalizeLocation({name:'Moon Township, PA', ...QUICK_SELECT_CITIES['Moon Township, PA']});
  if(moon){ await loadCityByName(moon.name, moon); updateRangeButtonLabel(); }
}

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', async ()=>{
  // Apply initial theme classes based on localStorage value
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  
  // Register service worker for PWA support (offline app shell caching)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('[PWA] Service worker registered:', registration);
      })
      .catch(error => {
        console.warn('[PWA] Service worker registration failed:', error);
      });
  } else {
    console.info('[PWA] Service workers not supported in this browser');
  }
  
  try { const elJs=$("ver-js"); if(elJs) elJs.textContent = `app.js v7.12.46`; } catch(e){ console.warn(e); }
  
  installMaximizeStyles(); ensureMaximizeUI(); ensureRangeButton(); ensureAppMenu(); ensureRadarButton(); reserveRightHeaderSpace(); dedupeHeaderControls(); updateChromeForTheme(); updateVersionChip(); ensureScrollScaleSlider(); updateLayoutButtonLabel();
  populateQuickSelectSorted(); ensureGPSButton(); initCityTitleTooltip();
  
  // Setup update banner button handlers
  $("updateReloadBtn")?.addEventListener("click", reloadForUpdate);
  $("updateDismissBtn")?.addEventListener("click", hideUpdateBanner);

  $("quickSelect")?.addEventListener("change", handleQuickSelectChange);
  $("searchBtn")?.addEventListener("click", async ()=>{ const q=$("cityInput")?.value?.trim(); if(!q) return; try{ const coords=parseCoordinateSearch(q); if(coords){ await loadCoordinatesLocation(coords.lat, coords.lon, false); const qs=$("quickSelect"); if(qs) qs.value=''; return; } const results=await geocodeCity(q); if(results.length===0){ alert('No matches found.'); return;} if(results.length===1){ const r=results[0]; const name=`${r.name}, ${r.admin1 || r.country}`; await loadCityByName(name, {lat:r.latitude, lon:r.longitude}); const qs=$("quickSelect"); if(qs) qs.value=''; return;} const modal=$("matchModal"), list=$("matchList"); if(!modal||!list) return; list.innerHTML=''; results.forEach(r=>{ const li=document.createElement('li'); const label=`${r.name}, ${r.admin1 || r.country}`; li.textContent=label; li.addEventListener('click', async()=>{ modal.classList.add('hidden'); await loadCityByName(label, {lat:r.latitude, lon:r.longitude}); const qs=$("quickSelect"); if(qs) qs.value=''; }); list.appendChild(li); }); $("matchCancelBtn").onclick=()=> modal.classList.add('hidden'); modal.classList.remove('hidden'); }catch(e){ console.error(e); alert('Search failed.'); } });
  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("testModeToggle")?.addEventListener("click", toggleTestMode);
  setupRangeButtonLongPress();
  $("rangeToggle")?.setAttribute('title', 'Range: 24h | Long-press for history');
  $("layoutToggle")?.addEventListener("click", toggleLayout);
  $("cityInput")?.addEventListener("keydown", e=>{ if(e.key==="Enter") $("searchBtn")?.click(); });
  $("chartCompareBtn")?.addEventListener("click", openChartCompare);

  try{
    await loadInitialLocation();
  }catch(e){ console.error(e); alert(e?.message||'Failed to load initial data.'); }

  window.addEventListener('resize', ()=>{ if(LAYOUT_MODE==='fit' && currentDataset){ try{ applyLayout(currentDataset.hourly.map(h=>h.time)); chart?.resize(); DomColorBar.render(chart); SeparateColorBar.render(chart);}catch{} } });
});

// ======= About Dialog =======
function formatRevisionMarkdownInline(text){
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(127,127,127,0.16);padding:1px 4px;border-radius:4px">$1</code>');
}
function renderRevisionMarkdown(markdown){
  const lines=String(markdown||'').replace(/\r\n/g, '\n').split('\n');
  const html=[];
  let inList=false;
  function closeList(){ if(inList){ html.push('</ul>'); inList=false; } }
  lines.forEach(raw=>{
    const line=raw.trimEnd();
    if(!line.trim()){ closeList(); html.push('<div style="height:8px"></div>'); return; }
    if(/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)){
      closeList();
      html.push(`<hr style="border:0;border-top:1px solid ${isDark?'#374151':'#d1d5db'};margin:18px 0 14px 0">`);
      return;
    }
    const heading=line.match(/^(#{1,4})\s+(.+)$/);
    if(heading){
      closeList();
      const level=heading[1].length;
      const size=level===1?'1.35rem':level===2?'1.1rem':level===3?'0.98rem':'0.9rem';
      const margin=level===1?'0 0 12px 0':'14px 0 8px 0';
      html.push(`<h${Math.min(level,4)} style="font-size:${size};margin:${margin};line-height:1.25">${formatRevisionMarkdownInline(heading[2])}</h${Math.min(level,4)}>`);
      return;
    }
    const bullet=line.match(/^[-*]\s+(.+)$/);
    if(bullet){
      if(!inList){ html.push('<ul style="margin:6px 0 10px 18px;padding:0;list-style:disc">'); inList=true; }
      html.push(`<li style="margin:4px 0">${formatRevisionMarkdownInline(bullet[1])}</li>`);
      return;
    }
    const quote=line.match(/^>\s?(.+)$/);
    if(quote){
      closeList();
      html.push(`<blockquote style="margin:8px 0;padding:8px 10px;border-left:3px solid #f59e0b;background:${isDark?'rgba(245,158,11,0.12)':'rgba(245,158,11,0.16)'}">${formatRevisionMarkdownInline(quote[1])}</blockquote>`);
      return;
    }
    closeList();
    html.push(`<p style="margin:6px 0;line-height:1.45">${formatRevisionMarkdownInline(line)}</p>`);
  });
  closeList();
  return html.join('');
}
async function showRevisionLogDialog(){
  let backdrop=document.getElementById('revisionLogBackdrop');
  if(!backdrop){
    backdrop=document.createElement('div');
    backdrop.id='revisionLogBackdrop';
    Object.assign(backdrop.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.55)',zIndex:'5100',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',boxSizing:'border-box'});
    const dialog=document.createElement('div');
    Object.assign(dialog.style,{background:isDark?'#111827':'#ffffff',color:isDark?'#e5e7eb':'#111827',borderRadius:'12px',width:'min(860px,100%)',maxHeight:'86vh',display:'flex',flexDirection:'column',boxShadow:'0 10px 40px rgba(0,0,0,0.35)',border:`1px solid ${isDark?'#374151':'#d1d5db'}`});
    dialog.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid ${isDark?'#374151':'#e5e7eb'}">
        <h2 style="margin:0;font-size:1.1rem">Revision Log</h2>
        <button id="revisionLogClose" style="height:30px;width:34px;border-radius:6px;border:1px solid ${isDark?'#374151':'#d1d5db'};background:transparent;color:inherit;cursor:pointer">x</button>
      </div>
      <div id="revisionLogContent" style="padding:14px 18px;overflow:auto;font-size:0.92rem;line-height:1.4"></div>`;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.getElementById('revisionLogClose').addEventListener('click', ()=>backdrop.remove());
    backdrop.addEventListener('click', e=>{ if(e.target===backdrop) backdrop.remove(); });
  }
  const content=document.getElementById('revisionLogContent');
  if(content) content.innerHTML='<p style="margin:0;opacity:0.75">Loading revision log...</p>';
  backdrop.style.display='flex';
  try{
    const res=await fetch('./REVISION_LOG.md?cache_bust=' + Date.now());
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const markdown=await res.text();
    if(content) content.innerHTML=renderRevisionMarkdown(markdown);
  }catch(e){
    if(content) content.innerHTML=`<p style="margin:0;color:${isDark?'#fecaca':'#7f1d1d'}">Unable to load the revision log right now.</p><p style="margin:8px 0 0 0;opacity:0.75">${formatRevisionMarkdownInline(e?.message||'Unknown error')}</p>`;
  }
}
function showAboutDialog(){
  let backdrop = document.getElementById('aboutBackdrop');
  if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.id = 'aboutBackdrop';
    Object.assign(backdrop.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.5)', zIndex:'5000', display:'flex', alignItems:'center', justifyContent:'center' });
    const dialog = document.createElement('div');
    Object.assign(dialog.style, { background: isDark ? '#1f2937' : '#ffffff', color: isDark ? '#e5e7eb' : '#111827', padding:'24px', borderRadius:'12px', maxWidth:'500px', width:'90%', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 10px 40px rgba(0,0,0,0.3)' });
    dialog.innerHTML = `
      <h2 style="margin:0 0 16px 0; font-size:1.5rem;">PEVcast</h2>
      <p style="margin:0 0 12px 0; opacity:0.9;">Find upcoming nice days for PEV riding</p>
      <p style="margin:0 0 8px 0; font-size:0.9rem; opacity:0.7;">App Version: <strong>${window.APP_VERSION}</strong></p>
      <p style="margin:0 0 8px 0; font-size:0.9rem; opacity:0.7;">Code Updated: <strong>${CODE_UPDATED}</strong></p>
      <p style="margin:0 0 8px 0; font-size:0.9rem; opacity:0.7;">Created by <strong>Ben Sacherich</strong></p>
      <div style="margin:16px 0 0 0; padding-top:16px; border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'}">
        <p style="margin:0 0 12px 0; font-weight:600; font-size:0.95rem;">APIs & Libraries:</p>
        <ul style="margin:0 0 16px 0; padding-left:20px; list-style:disc;">
          <li style="margin:6px 0;"><a href="https://www.bigdatacloud.com/" target="_blank" style="color:#3b82f6; text-decoration:none;">BigDataCloud Reverse Geocoding</a></li>
          <li style="margin:6px 0;"><a href="https://nominatim.org/" target="_blank" style="color:#3b82f6; text-decoration:none;">Nominatim Reverse Geocoding</a></li>
          <li style="margin:6px 0;"><a href="https://open-meteo.com/" target="_blank" style="color:#3b82f6; text-decoration:none;">Open-Meteo Geolocation</a></li>
          <li style="margin:6px 0;"><a href="https://open-meteo.com/" target="_blank" style="color:#3b82f6; text-decoration:none;">Open-Meteo Forecast</a></li>
          <li style="margin:6px 0;"><a href="https://www.chartjs.org/" target="_blank" style="color:#3b82f6; text-decoration:none;">Chart.js v4.4.1</a></li>
          <li style="margin:6px 0;"><a href="https://radar.weather.gov/" target="_blank" style="color:#3b82f6; text-decoration:none;">NOAA Weather Radar</a></li>
        </ul>
      </div>
      <button id="aboutRevisionLog" style="width:100%; padding:10px; margin-top:12px; border:1px solid #2563eb; background:#2563eb; color:#ffffff; border-radius:6px; cursor:pointer; font-size:0.95rem;">Show Revision Log</button>
      <button id="aboutClearCache" style="width:100%; padding:10px; margin-top:12px; border:1px solid #7f1d1d; background:#7f1d1d; color:#ffffff; border-radius:6px; cursor:pointer; font-size:0.95rem;">Clear Cache</button>
      <button id="aboutClose" style="width:100%; padding:10px; margin-top:12px; border:1px solid ${isDark ? '#374151' : '#d1d5db'}; background:${isDark ? '#111827' : '#f3f4f6'}; color:inherit; border-radius:6px; cursor:pointer; font-size:0.95rem;">Close</button>
    `;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.getElementById('aboutRevisionLog').addEventListener('click', ()=>{ showRevisionLogDialog(); });
    document.getElementById('aboutClearCache').addEventListener('click', ()=>{
      const message=[
        'Clear all saved PEVcast settings from local storage?',
        '',
        'This will clear:',
        '- Saved Quick List locations',
        '- Default location and GPS-default preference',
        '- Dark/light theme preference',
        '- Feels Like Line and Wind Speed Line preferences',
        '- Cached GPS place names',
        '- Any other PEVcast settings saved in this browser',
        '',
        'You will need to reconfigure these after the app reloads.'
      ].join('\n');
      if(!confirm(message)) return;
      localStorage.clear();
      alert('Saved settings cleared. The app will reload.');
      window.location.reload();
    });
    document.getElementById('aboutClose').addEventListener('click', ()=>{ backdrop.remove(); });
    backdrop.addEventListener('click', (e)=>{ if(e.target === backdrop) backdrop.remove(); });
  } else {
    backdrop.style.display = 'flex';
  }
}

// ======= Radar Button =======
function ensureRadarButton(){
  if(document.getElementById('radarBtn')) return;
  // const btn = document.createElement('button');
  // btn.id = 'radarBtn';
  // btn.title = 'View Weather Radar';
  // btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>';
  // btn.style.display = 'inline-flex';
  // btn.style.alignItems = 'center';
  // btn.style.justifyContent = 'center';
  // btn.style.padding = '4px 8px';
  // btn.style.marginLeft = '6px';
  // btn.style.borderRadius = '6px';
  // btn.style.cursor = 'pointer';
// Ensure a single <style> block to enable CSS-only hover glow for #radarBtn
(function(){
  var sty = document.getElementById('radarBtnStyles');
  if(!sty){
    sty = document.createElement('style');
    sty.id = 'radarBtnStyles';
    sty.textContent = `
      /* Button baseline look (inherits color from context) */
      #radarBtn {
        color: #16a34a; /* classic radar green; change as needed */
        background: transparent;
        border: 1px solid currentColor;
      }
      #radarBtn svg {
        display: block;
        transition: filter .25s ease, opacity .25s ease;
      }
      /* Subtle ambient glow element inside the SVG (off by default) */
      #radarBtn .radar-glow {
        opacity: 0.15;
        transition: opacity .25s ease;
      }
      /* CSS-only hover glow */
      #radarBtn:hover svg {
        filter: drop-shadow(0 0 6px currentColor);
      }
      #radarBtn:hover .radar-glow {
        opacity: 0.35;
      }
      /* Optional: keyboard focus glow for accessibility */
      #radarBtn:focus-visible svg {
        filter: drop-shadow(0 0 6px currentColor);
      }
    `;
    document.head.appendChild(sty);
  }
})();

// Drop-in replacement button creation
const btn = document.createElement('button');
btn.id = 'radarBtn';
btn.title = 'View Weather Radar';
btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round" role="img" aria-label="Radar scope icon (static)"><defs><radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.25"/><stop offset="70%" stop-color="currentColor" stop-opacity="0.10"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><g><circle class="radar-glow" cx="12" cy="12" r="11" fill="url(#rg)" stroke="none"></circle><circle cx="12" cy="12" r="11"></circle><circle cx="12" cy="12" r="8" opacity="0.55"></circle><circle cx="12" cy="12" r="5" opacity="0.45"></circle><circle cx="12" cy="12" r="2" opacity="0.35"></circle><line x1="12" y1="1.5" x2="12" y2="22.5" opacity="0.45"></line><line x1="1.5" y1="12" x2="22.5" y2="12" opacity="0.45"></line><g><line x1="12" y1="12" x2="20" y2="9" opacity="0.9"></line><circle cx="16.5" cy="8.5" r="0.9" fill="currentColor" stroke="none"></circle><circle cx="7.3" cy="9.5" r="0.9" fill="currentColor" stroke="none" opacity="0.85"></circle><circle cx="15" cy="15.3" r="0.9" fill="currentColor" stroke="none" opacity="0.85"></circle></g></g></svg>';
btn.style.display = 'inline-flex';
btn.style.alignItems = 'center';
btn.style.justifyContent = 'center';
btn.style.padding = '4px 8px';
btn.style.marginLeft = '6px';
btn.style.borderRadius = '6px';
btn.style.cursor = 'pointer';

// Append it wherever you need, for example:
// document.body.appendChild(btn);


  const searchBtn = document.getElementById('searchBtn');
  const searchGroup = searchBtn ? searchBtn.closest('.search-group') : null;
  if(searchBtn && searchBtn.parentNode) {
    searchBtn.insertAdjacentElement('afterend', btn);
  } else {
    document.body.appendChild(btn);
  }
  btn.addEventListener('click', ()=>{
    if(currentLocationLat === null || currentLocationLon === null){
      alert('Please select a location first.');
      return;
    }
    const settings = {
      agenda: {
        id: "weather",
        center: [currentLocationLon, currentLocationLat],
        location: [currentLocationLon, currentLocationLat],
        zoom: 9.0,
        layer: "bref_qcd"
      },
      animating: false,
      base: "standard",
      artcc: false,
      county: true,
      cwa: false,
      rfc: true,
      state: true,
      menu: true,
      shortFusedOnly: false,
      opacity: {
        alerts: 0.2,
        local: 0.6,
        localStations: 0.8,
        national: 1.0
      }
    };
    const base64 = btoa(JSON.stringify(settings));
    const urlSafeBase64 = base64.replace(/=/g, '%3D');
    window.open(`https://radar.weather.gov/?settings=v1_${urlSafeBase64}`, '_blank');
  });
  updateChromeForTheme();
}

// ======= Day/Night shading helper =======
function addDayNightBoxesAligned(labels, daily, annotations, yMin, yMax, showSunriseSunset){
  try{
    const timesMs = labels.map(t => new Date(t).getTime());
    const perDay = {};
    const idxBefore = (ms) => timesMs.findIndex(t => t > ms) - 1;
    const roundToNearest = (target, i0) => { if (i0 < 0) return 0; const i1 = Math.min(i0+1, timesMs.length-1); const d0 = Math.abs(target - timesMs[i0]); const d1 = Math.abs(timesMs[i1] - target); return (d1 < d0) ? i1 : i0 };
    for (const d of (daily || [])){
      const key = d.date;
      const srMs = new Date(d.sunrise).getTime(); const ssMs = new Date(d.sunset).getTime();
      const srIdx = roundToNearest(srMs, Math.max(0, idxBefore(srMs))); const ssIdx = roundToNearest(ssMs, Math.max(0, idxBefore(ssMs)));
      perDay[key] = { sunriseIdx: srIdx, sunsetIdx: ssIdx };
    }
    const firstIdxForDay = (dayKey) => labels.findIndex(t => t.startsWith(dayKey));
    const lastIdxForDay  = (dayKey) => { for (let i=labels.length-1;i>=0;i--) if (labels[i].startsWith(dayKey)) return i; return -1; };
    const dayColorDark = 'rgba(255,255,255,0.080)'; const nightColorLight= 'rgba(17,24,39,0.10)';
    for (const [key, info] of Object.entries(perDay)){
      const first = firstIdxForDay(key), last = lastIdxForDay(key); if (first === -1 || last === -1) continue;
      const leftEdge = first - 0.5; const rightEdge = last + 0.5; const srEdge = info.sunriseIdx - 0.5; const ssEdge = info.sunsetIdx - 0.5;
      if (isDark){ const xMin = Math.max(srEdge, leftEdge); const xMax = Math.min(ssEdge, rightEdge); if (xMax > xMin) annotations[`day-${key}`] = { type:'box', xScaleID:'x', yScaleID:'yTemp', xMin, xMax, yMin, yMax, backgroundColor: dayColorDark, borderWidth:0 }; }
      else { const preMin = leftEdge; const preMax = Math.min(srEdge, rightEdge); if (preMax > preMin) annotations[`night-pre-${key}`] = { type:'box', xScaleID:'x', yScaleID:'yTemp', xMin: preMin, xMax: preMax, yMin, yMax, backgroundColor: nightColorLight, borderWidth:0 }; const postMin = Math.max(ssEdge, leftEdge); const postMax = rightEdge; if (postMax > postMin) annotations[`night-post-${key}`] = { type:'box', xScaleID:'x', yScaleID:'yTemp', xMin: postMin, xMax: postMax, yMin, yMax, backgroundColor: nightColorLight, borderWidth:0 }; }
    }
    if(showSunriseSunset){
      const amber = 'rgba(245, 158, 11, 0.95)'; const blue  = '#3b82f6';
      for (const [key, info] of Object.entries(perDay)){
        const srEdge = info.sunriseIdx - 0.5; const ssEdge = info.sunsetIdx - 0.5;
        if (info.sunriseIdx>=0 && info.sunriseIdx<labels.length) annotations[`sunrise-${key}`] = { type:'line', xScaleID:'x', yScaleID:'yTemp', xMin: srEdge, xMax: srEdge, borderColor: amber, borderWidth: 1.5, borderDash:[2,2] };
        if (info.sunsetIdx>=0 && info.sunsetIdx<labels.length) annotations[`sunset-${key}`] = { type:'line', xScaleID:'x', yScaleID:'yTemp', xMin: ssEdge, xMax: ssEdge, borderColor: blue,  borderWidth: 1.5, borderDash:[2,2] };
      }
    }
  }catch(e){ console.error('addDayNightBoxesAligned failed', e); }
}












