
// app.js @version 7.12.24
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

(function(){ try{ window.APP_VERSION='7.12.28'; console.info('[WeatherApp] app.js', window.APP_VERSION); }catch(e){} })();

function generateCodeUpdateTimestamp(){ const now=new Date(); const mon=String(now.getMonth()+1).padStart(2,'0'); const day=String(now.getDate()).padStart(2,'0'); const yr=now.getFullYear(); let h=now.getHours(); const m=String(now.getMinutes()).padStart(2,'0'); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${mon}/${day}/${yr} ${h}:${m} ${ap}`; }

let chart;
let SHOW_SUNRISE_SUNSET = false; // Toggle sunrise/sunset lines on chart
let isDark = localStorage.getItem('PEVcast-dark-mode') !== null ? JSON.parse(localStorage.getItem('PEVcast-dark-mode')) : true;
let TEST_MODE_ENABLED = false;
let currentDataset = null;
let currentLocationLat = null; // Current location latitude for radar
let currentLocationLon = null; // Current location longitude for radar
let currentCityName = 'Moon Township, PA'; // Current city for reloading with past_days
let pastDays = 0; // Past days to include (0-92); 0=forecast only, 3/7/14=with history
const PAST_DAYS_CYCLE = [0, 3, 7, 14]; // Cycle through these values on shift-click

// Range modes: 24h → 72h → 168h → Max → 24h
const RANGE_STATES = [24, 72, 168, 'max'];
let rangeIndex = 0; // start at 24h
const MIN_TEMP_THRESHOLD_FOR_SNOW = 33; // Hide snow data when min temp exceeds this
const MAX_WIND_DISPLAY = 40; // Maximum wind speed (mph) displayed at top of chart

let snowRatioMode = 'Auto'; // 'Auto' | '8' | '10' | '12' | '15'
let LAYOUT_MODE = 'fit';    // 'fit' | 'scroll'
let APPARENT_OVERLAY_ENABLED = false; // default off
let WIND_DISPLAY_MODE = 'line'; // 'off' | 'line' | 'barbs' | 'overlay' | 'arrows'

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

function $(id){ return document.getElementById(id); }
function setCityTitle(name){ const el=$("cityTitle"); if(el) el.textContent = name; }

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
      return j;
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

async function loadWeatherData(cityName, lat, lon, pastDaysParam=0){
  if (TEST_MODE_ENABLED){
    const bagData = resolveLegacyTestData(cityName); if (bagData) return bagData;
    const fix = await tryLoadFixture(); if (fix) return fix;
    if (typeof window !== 'undefined' && window.TEST_DATA && window.TEST_DATA.hourly && window.TEST_DATA.daily){
      return window.TEST_DATA;
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
    + `&timezone=auto&forecast_days=16&wind_speed_unit=mph`
    + (pastDaysParam > 0 ? `&past_days=${pastDaysParam}` : '');
  const res = await fetch(url); if (!res.ok) throw new Error('Forecast fetch failed');
  return await res.json();
}

function buildDataFromLive(apiData){
  const hourly = apiData.hourly; const daily = apiData.daily;
  const hourlyArr = hourly.time.map((t, i) => {
    const tempF = hourly.temperature_2m[i] * 9/5 + 32;
    const apparentF = (typeof hourly.apparent_temperature !== 'undefined' && hourly.apparent_temperature[i] != null)
      ? (hourly.apparent_temperature[i] * 9/5 + 32) : null;
    const precipIn = hourly.precipitation[i] / 25.4;
    const rainIn = hourly.rain[i] / 25.4;
    const snowIn = hourly.snowfall[i] / 25.4;
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
    totalPrecipIn: daily.precipitation_sum[i] / 25.4,
    totalSnowIn:   daily.snowfall_sum[i] / 25.4,
    sunrise: daily.sunrise[i], sunset: daily.sunset[i]
  }));
  return { hourly: hourlyArr, daily: dailyArr };
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
const pastHoursHatchingPlugin = { id: 'pastHoursHatching', afterDatasetsDraw(chart){ const {ctx, chartArea, scales:{x,yTemp}} = chart; if(!x || !yTemp || !chartArea) return; const labels = chart.data.labels || []; if(labels.length === 0) return; const nowIdx = labels.findIndex(t => new Date(t).getTime() >= Date.now()); if(nowIdx <= 0) return; const pastStartIdx = Math.max(0, nowIdx - 4); if(pastStartIdx >= nowIdx) return; const xStart = x.getPixelForValue(pastStartIdx - 0.5); const xEnd = x.getPixelForValue(nowIdx + 0.5); const top = chartArea.top, bottom = chartArea.bottom; ctx.save(); ctx.beginPath(); ctx.rect(xStart, top, xEnd - xStart, bottom - top); ctx.clip(); ctx.globalAlpha = 0.12; ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; const spacing = 8; for(let offset = -300; offset < 300; offset += spacing){ ctx.beginPath(); ctx.moveTo(xStart + offset, top); ctx.lineTo(xEnd + offset, bottom); ctx.stroke(); } ctx.restore(); } };
Chart.register(pastHoursHatchingPlugin);

// Day labels plugin (top X axis)
const dayLabelsPlugin = { id: 'dayLabels', afterDatasetsDraw(chart){ const {ctx, chartArea, scales:{x}} = chart; if(!x || !chartArea) return; const labels = chart.data.labels || []; if(labels.length === 0) return; const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const labelDates = labels.map(t => t.substring(0,10)); const dayBoundaries = {}; for(let i = 0; i < labels.length; i++){ const d = labelDates[i]; if(!(d in dayBoundaries)) dayBoundaries[d] = {firstIdx: i}; dayBoundaries[d].lastIdx = i; } ctx.save(); ctx.font = 'bold 11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = isDark ? '#d1d5db' : '#374151'; for(const [dateStr, {firstIdx, lastIdx}] of Object.entries(dayBoundaries)){ const d = new Date(dateStr + 'T00:00:00'); const dayName = dayNames[d.getDay()]; const xPos = (x.getPixelForValue(firstIdx - 0.5) + x.getPixelForValue(lastIdx + 0.5)) / 2; const y = chartArea.top - 4; if(xPos >= chartArea.left && xPos <= chartArea.right) ctx.fillText(dayName, xPos, y); } ctx.restore(); } };
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
function formatClock(iso){ const d=new Date(iso); let h=d.getHours(); const m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${h}:${pad2(m)} ${ap}`; }
function formatTooltipTime(iso){ const d=new Date(iso); const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; const mon=d.getMonth()+1; const day=d.getDate(); let h=d.getHours(); const m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${dow} ${mon}/${day} ${h}:${pad2(m)} ${ap}`; }
function formatPointFooter(iso){ const d=new Date(iso); const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; const mon=d.getMonth()+1; const day=d.getDate(); let h=d.getHours(); const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${dow} ${mon}/${day} ${h} ${ap}`; }
function formatXAxisHour(iso){ const d=new Date(iso); const h24=d.getHours(); if(h24===0) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; if(h24===12) return 'Noon'; let h=h24; const ap=h>=12?'PM':'AM'; h=h%12; if(h===0) h=12; return `${h} ${ap}`; }
function findNowIndex(labels){ const now=Date.now(); let firstGE=labels.findIndex(t=> new Date(t).getTime()>=now); if(firstGE>=0) return firstGE; let bestIdx=0,best=Infinity; for(let i=0;i<labels.length;i++){ const d=Math.abs(new Date(labels[i]).getTime()-now); if(d<best){best=d; bestIdx=i;} } return bestIdx; }

function updateSunTimesForNow(daily, fullLabels, nowIdxFull){ try{ const el=$("sunTimes"); if(!el||!daily||!daily.length||!fullLabels||nowIdxFull==null) return; const dayKey=fullLabels[nowIdxFull].substring(0,10); const rec=daily.find(d=>d.date===dayKey) || daily[0]; el.textContent=`Sunrise: ${formatClock(rec.sunrise)} · Sunset: ${formatClock(rec.sunset)}`; }catch(e){ console.warn('updateSunTimesForNow failed', e); } }

function calcDayAccum(hourly, idx){ const d=hourly[idx].time.substring(0,10); let sumLiquid=0, sumEstSnow=0; for(let i=0;i<=idx;i++){ if(hourly[i].time.substring(0,10)!==d) continue; const h=hourly[i]; sumLiquid += h.precipIn||0; const likely=(h.precipType==='snow')||(h.temperatureF<=32); if(likely){ const ratio=getSnowRatio(h.temperatureF); sumEstSnow += (h.precipIn||0)*ratio; } } return {liquid:sumLiquid, estSnow:sumEstSnow}; }

function applyLayout(labels){ const container=document.querySelector('.chart-container'); const scroller=$("chartScroll"); const canvas=$("weatherChart"); if(LAYOUT_MODE==='fit'){ const header=document.querySelector('.app-header'); const footer=document.querySelector('.app-footer'); const sumBoxes=document.querySelectorAll('.summary-box'); const testBanner=$("testModeBanner"); let used=(header?.offsetHeight||0)+(footer?.offsetHeight||0)+(testBanner?.offsetHeight||0)+32; sumBoxes.forEach(el=> used+=(el?.offsetHeight||0)+8); const avail=Math.max(240, window.innerHeight-used); container.style.height=avail+'px'; scroller.style.overflowX='hidden'; canvas.style.width=''; canvas.style.height='100%'; } else { container.style.height='420px'; scroller.style.overflowX='auto'; const hours=labels.length, pxPerHour=56; const w=Math.max(scroller.clientWidth, hours*pxPerHour); canvas.style.width=w+'px'; canvas.style.height='100%'; canvas.setAttribute('width', w); } }

// ---------- Build Chart ----------
function buildChart(dataset){
  currentDataset = dataset; const ctx=$("weatherChart").getContext('2d'); if(chart) chart.destroy();
  const fullHourly = dataset.hourly||[]; const fullLabels = fullHourly.map(h=>h.time); const nowIdxFull = findNowIndex(fullLabels);
  updateSunTimesForNow(dataset.daily||[], fullLabels, nowIdxFull);

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

  applyLayout(labels);

  const minT=Math.min(...temps.filter(x=>x!=null)), maxT=Math.max(...temps.filter(x=>x!=null));
  const yMin=Math.floor(minT-5); let yMax=Math.ceil(maxT+5); if(maxT<35) yMax=35;

  const maxSnowRate=Math.max(...snow), maxRainRate=Math.max(...rain); const snowScale=2.0, rainScale=1.0; const baseAccumMax=Math.max(maxSnowRate>0?snowScale:0, maxRainRate>0?rainScale:0, 0.1); const accumMax=baseAccumMax/5;

  // Reduce liquid (green) ~50%; snow unchanged
  const scaledPrecip = precip.map((v,i)=>{ const isLiquid=(temps[i]>32) || (rain[i]>0 && snow[i]===0); const f=isLiquid?0.5:1.0; return (v/accumMax)*f; });
  const scaledWind = wind.map(w => w ? Math.min(w / MAX_WIND_DISPLAY * accumMax, accumMax) : null);
  let barColors = hourly.map(h=> (h.temperatureF>32 ? '#10b981' : '#60a5fa'));
  
  // Wind overlay - change bar color based on wind speed
  if(WIND_DISPLAY_MODE === 'overlay'){
    barColors = hourly.map((h,i)=>{ const w = wind[i]; if(w == null) return (h.temperatureF>32 ? '#10b981' : '#60a5fa'); const isLiquid=(temps[i]>32) || (rain[i]>0 && snow[i]===0); const baseColor = h.temperatureF>32 ? '#aef3aa' : '#a5d4ff'; if(w >= 20) return isDark ? '#fe7867' : '#ff5555'; if(w >= 12) return isDark ? '#faa54a' : '#ff9500'; return baseColor; });
  }

  const tr=$("totalRain"), ts=$("totalSnow"), es=$("estSnow"), wr=$("windRange");
  if(tr) tr.textContent=`${rain.reduce((a,b)=>a+b,0).toFixed(2)}"`;
  const hidesnow = yMin > MIN_TEMP_THRESHOLD_FOR_SNOW;
  if(ts){ ts.textContent=`${snow.reduce((a,b)=>a+b,0).toFixed(2)}"`; ts.parentElement.style.display = hidesnow ? 'none' : 'block'; }
  if(es){ es.textContent=`${hourly.reduce((s,h)=>{ const likely=(h.precipType==='snow')||(h.temperatureF<=32); if(!likely) return s; const ratio=getSnowRatio(h.temperatureF); return s+(h.precipIn||0)*ratio; },0).toFixed(2)}`; es.parentElement.style.display = hidesnow ? 'none' : 'block'; }
  
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
  if(nowIdxVisible>=0 && nowIdxVisible<labels.length){ const nowValue=labels[nowIdxVisible]; const c=isDark?'rgba(234,179,8,0.95)':'rgba(217,119,6,0.95)'; annotations['now-line']={ type:'line', xScaleID:'x', yScaleID:'yTemp', xMin:nowValue, xMax:nowValue, borderColor:c, borderWidth:1.5 };
  }

  const cw=document.querySelector('.chart-container')?.clientWidth || window.innerWidth; const approxMaxTicks=Math.max(6, Math.min(labels.length, Math.floor(cw/48)));
  const responsiveMode=(LAYOUT_MODE==='fit');

  const hideChartYAxis = (GRADIENT_MODE==='custom-scale');

  const baseDatasets = [
    { type:'bar', label:'Accumulation', data:scaledPrecip, yAxisID:'yAccum', backgroundColor:barColors, borderColor:barColors.map(()=>"#111827"), borderWidth:1, categoryPercentage:1.0, barPercentage:1.0, hidden: yMin > MIN_TEMP_THRESHOLD_FOR_SNOW, order: 0 },
    { type:'line', label:'Temperature', data:temps, yAxisID:'yTemp', borderColor:'#eab308', backgroundColor:'rgba(234,179,8,0.20)', tension:0.3, pointRadius:2, pointHoverRadius:3, order: 1,
      datalabels:{ display:(c)=>{ const i=c.dataIndex; const d=labelDates[i]; const fm=firstMinMaxIndexByDay[d]; if(!fm) return false; return i===fm.minIdx || i===fm.maxIdx; }, formatter:(v)=>`${Math.round(v)}°`, align:(c)=>{ const i=c.dataIndex; const fm=firstMinMaxIndexByDay[labelDates[i]]; return (!fm)?'top':(i===fm.minIdx?'bottom':'top'); }, offset:4, color: isDark ? '#e5e7eb' : '#111827', backgroundColor:'rgba(0,0,0,0)', borderWidth:0, clamp:true }
    },
    { type:'line', label:'Feels Like', data:apTemps, yAxisID:'yTemp', borderColor:'#f472b6', backgroundColor:'rgba(244,114,182,0.18)', tension:0.3, pointRadius:1.5, pointHoverRadius:2.5, hidden: !APPARENT_OVERLAY_ENABLED, order: 2 },
    { type:'line', label:'Chance of Precip', data:prob, yAxisID:'yProb', borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.26)', tension:0.3, pointRadius:1.5, pointHoverRadius:2.5, order: 3 }
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
          ).toFixed(2);
          const windSpd = h.windMph ? h.windMph.toFixed(1) : "N/A";
          const windDir = h.windDir ?? "N/A";
          svEl.textContent = `${formatPointFooter(h.time)} - Temp: ${h.temperatureF.toFixed(1)}°, Precip: ${h.precipIn.toFixed(2)}", Snow: ${h.snowIn.toFixed(2)}", Rain: ${h.rainIn.toFixed(2)}", Est Snow: ${estHour}", Chance: ${h.precipProb ?? "N/A"}%, Wind: ${windSpd} mph @ ${windDir}°, Day Accum (Liquid): ${day.liquid.toFixed(2)}", Day Accum (Snow): ${day.estSnow.toFixed(1)}"`;
        }
        setCursorAnnotation(chart, labels[i]);
        chart.update();
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
                return `Temp: ${Math.round(h.temperatureF)}°`;
              if (
                ctx.dataset.yAxisID === "yTemp" &&
                ctx.dataset.label === "Feels Like"
              )
                return h.apparentF != null
                  ? `Feels Like: ${Math.round(h.apparentF)}°`
                  : "Feels Like: N/A";
              if (ctx.dataset.yAxisID === "yProb")
                return `Chance: ${h.precipProb ?? "N/A"}%`;
              if (ctx.dataset.yAxisID === "yAccum")
                return `Accum: ${h.precipIn.toFixed(2)}"`;
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
          ticks: { display: false },
          grid: { drawOnChartArea: false },
        },
        yProb: {
          position: "right",
          min: 0,
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
  chart.canvas.addEventListener('mousemove', (evt)=>{ const e=(evt&&evt.native)?evt.native:evt; const pos=Chart.helpers.getRelativePosition(e, chart); const a=chart.chartArea; if(!a || !(pos.x>=a.left&&pos.x<=a.right&&pos.y>=a.top&&pos.y<=a.bottom)){ clearHoverAnnotation(chart); chart.update('none'); return; } const sx=chart.scales.x; const idx = sx.getValueForPixel(pos.x); const i = Math.max(0, Math.min(labels.length-1, typeof idx==='number'? Math.round(idx): 0)); setHoverAnnotation(chart, labels[i]); chart.update('none'); });
  chart.canvas.addEventListener('mouseleave', ()=>{ clearHoverAnnotation(chart); chart.update('none'); });
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
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mApparent"> Feels Like Overlay</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mTest"> Test Mode</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mLayout"> Layout: Scroll</label>
  <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="mSunrise"> Sunrise/Sunset</label>
  <div style="margin:8px 0 4px 0;font-weight:600;">Snow Ratio</div>
  <select id="mSnow" style="width:100%;margin-bottom:8px"></select>
  <div style="margin:8px 0 4px 0;font-weight:600;">Gradient Mode</div>
  <select id="mGrad" style="width:100%;margin-bottom:8px"></select>
  <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0">
    <label style="flex:1">Gradient Width</label>
    <select id="mGradW" style="flex:1"></select>
  </div>
  <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0">
    <label style="flex:1">Reserve Left</label>
    <select id="mGradPad" style="flex:1"></select>
  </div>
  <div style="margin:8px 0 4px 0;font-weight:600;">Wind Display</div>
  <select id="mWind" style="width:100%;margin-bottom:8px"></select>
  <button id="mCheck" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Check for Updates</button>
  <button id="mData" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">Weather Data</button>
  <button id="mAbout" style="margin-top:6px;width:100%;height:32px;border-radius:6px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;cursor:pointer">About</button>
  `;

  function openMenu(){ panel.style.display='block'; if(!_menuOutsideHandler){ _menuOutsideHandler = (e)=>{ if(!panel.contains(e.target) && e.target!==btn){ closeMenu(); } }; document.addEventListener('click', _menuOutsideHandler, true); } }
  function closeMenu(){ panel.style.display='none'; if(_menuOutsideHandler){ document.removeEventListener('click', _menuOutsideHandler, true); _menuOutsideHandler=null; } }

  btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); const isClosed = (panel.style.display==='none'); if(isClosed) openMenu(); else closeMenu(); });

  document.getElementById('btnContainer').appendChild(btn); document.body.appendChild(panel);

  // Populate selects (do not close menu on change)
  const mSnow=$("mSnow"); if(mSnow){ ['Auto','8','10','12','15'].forEach(v=>{ const o=document.createElement('option'); o.value=(v==='Auto'? 'Auto': String(v)); o.textContent=(v==='Auto'? 'Auto':`${v}:1`); mSnow.appendChild(o); }); mSnow.value = snowRatioMode; mSnow.addEventListener('change', ()=>{ snowRatioMode=mSnow.value; if(currentDataset) buildChart(currentDataset); /* keep menu open */ }); }

  const mGrad=$("mGrad"); if(mGrad){ const modes=[['plugin','Plugin (reserve space)'],['dom','DOM Overlay'],['axis-overlay','Axis Overlay (on top)'],['custom-scale','Custom Scale (white on gradient)'],['separate-canvas','Separate Canvas (fixed)'],['off','Off']]; modes.forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; mGrad.appendChild(o); }); mGrad.value = GRADIENT_MODE; mGrad.addEventListener('change', ()=>{ GRADIENT_MODE=mGrad.value; if(currentDataset) buildChart(currentDataset); /* keep menu open */ }); }

  const mW=$("mGradW"); if(mW){ [38,64,96,128].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=`${v}px`; mW.appendChild(o); }); mW.value=String(GRADIENT_WIDTH); mW.addEventListener('change', ()=>{ GRADIENT_WIDTH=parseInt(mW.value,10)||GRADIENT_WIDTH; if(currentDataset) buildChart(currentDataset); /* keep menu open */ }); }
  const mPad=$("mGradPad"); if(mPad){ [0,40,80,120].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=`${v}px`; mPad.appendChild(o); }); mPad.value=String(GRADIENT_EXTRA_LEFT); mPad.addEventListener('change', ()=>{ GRADIENT_EXTRA_LEFT=parseInt(mPad.value,10)||GRADIENT_EXTRA_LEFT; if(currentDataset) buildChart(currentDataset); /* keep menu open */ }); }

  const mWind=$("mWind"); if(mWind){ const windModes=[['off','Off'],['line','Wind Speed Line'],['barbs','Wind Barbs'],['arrows','Wind Arrows'],['overlay','Wind Color Overlay']]; windModes.forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; mWind.appendChild(o); }); mWind.value = WIND_DISPLAY_MODE; mWind.addEventListener('change', ()=>{ WIND_DISPLAY_MODE=mWind.value; if(currentDataset) buildChart(currentDataset); /* keep menu open */ }); }

  const mTheme=$("mTheme"), mApp=$("mApparent"), mTest=$("mTest"), mLay=$("mLayout"), mSunrise=$("mSunrise"), mData=$("mData"), mCheck=$("mCheck");
  if(mTheme){ mTheme.checked = isDark; mTheme.addEventListener('change', ()=>{ toggleTheme(); mTheme.checked=isDark; /* keep menu open */ }); }
  if(mApp){ mApp.checked = APPARENT_OVERLAY_ENABLED; mApp.addEventListener('change', ()=>{ toggleApparent(); mApp.checked=APPARENT_OVERLAY_ENABLED; /* keep menu open */ }); }
  if(mTest){ mTest.checked = TEST_MODE_ENABLED; mTest.addEventListener('change', ()=>{ toggleTestMode(); mTest.checked=TEST_MODE_ENABLED; /* keep menu open */ }); }
  if(mLay){ mLay.checked = (LAYOUT_MODE==='scroll'); mLay.addEventListener('change', ()=>{ toggleLayout(); mLay.checked=(LAYOUT_MODE==='scroll'); /* keep menu open */ }); }
  if(mSunrise){ mSunrise.checked = SHOW_SUNRISE_SUNSET; mSunrise.addEventListener('change', ()=>{ SHOW_SUNRISE_SUNSET=!SHOW_SUNRISE_SUNSET; if(currentDataset) buildChart(currentDataset); mSunrise.checked=SHOW_SUNRISE_SUNSET; /* keep menu open */ }); }
  if(mCheck){ mCheck.addEventListener('click', ()=>{ checkForUpdates(); /* keep menu open */ }); }
  if(mData){ mData.addEventListener('click', ()=>{ try{ showWeatherData(); }catch(e){ alert('Failed to build Weather Data table'); } closeMenu(); }); }

  const mAbout=$("mAbout");
  if(mAbout){ mAbout.addEventListener('click', ()=>{ showAboutDialog(); closeMenu(); }); }

  updateChromeForTheme();
}

function reserveRightHeaderSpace(){
  // Prevent overlap behind Menu/Maximize: add right padding to header and center other controls
  const header=document.querySelector('.app-header');
  if(header){ header.style.paddingRight = '160px'; header.style.position='relative'; header.style.zIndex='100'; }
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
  const close=document.createElement('button'); close.textContent='✕'; Object.assign(close.style,{border:'1px solid rgba(0,0,0,0.2)',borderRadius:'6px',background:'transparent',color:'inherit',cursor:'pointer',height:'28px',width:'32px'}); close.addEventListener('click', ()=> modal.style.display='none'); head.appendChild(close);
  const wrap=document.createElement('div'); wrap.id='dataTableWrap'; Object.assign(wrap.style,{overflowX:'auto',overflowY:'auto',maxHeight:'calc(70vh - 48px)'});
  const inner=document.createElement('div'); inner.id='dataTableInner'; inner.style.padding='10px'; wrap.appendChild(inner);
  panel.appendChild(head); panel.appendChild(wrap); modal.appendChild(panel); document.body.appendChild(modal);
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.style.display='none'; });
  return modal;
}

function showWeatherData(){
  const modal=ensureDataModal(); const inner=$("dataTableInner"); if(!inner) return;
  const ds=currentDataset; if(!ds||!ds.hourly){ alert('No dataset loaded'); return; }
  const H=ds.hourly; const cols=H.map(h=>h.time);
  const fields=[
    ['Temp (°F)','temperatureF',(v)=>v!=null? v.toFixed(1):'N/A'],
    ['Feels Like (°F)','apparentF',(v)=>v!=null? v.toFixed(1):'N/A'],
    ['Precip (in)','precipIn',(v)=>v!=null? v.toFixed(3):'0.000'],
    ['Rain (in)','rainIn',(v)=>v!=null? v.toFixed(3):'0.000'],
    ['Snow (in)','snowIn',(v)=>v!=null? v.toFixed(3):'0.000'],
    ['Precip Type','precipType',(v)=>v??'none'],
    ['Wind (mph)','windMph',(v)=>v!=null? v.toFixed(1):'N/A'],
    ['Wind Dir (°)','windDir',(v)=>v!=null? Math.round(v):'N/A'],
    ['Chance (%)','precipProb',(v)=>v!=null? v:'N/A']
  ];
  let html = '<table style="border-collapse:collapse; font: 12px system-ui,Segoe UI,Roboto,sans-serif">';
  // Header row
  html += '<tr><th style="position:sticky;left:0;background:#111827;color:#e5e7eb;padding:6px 8px;border:1px solid #374151">Metric</th>';
  for(const t of cols){ const d=new Date(t); const mon=d.getMonth()+1, day=d.getDate(); const hr=d.getHours(); const ap=hr>=12?'PM':'AM'; const h12=(hr%12)||12; const label=`${mon}/${day} ${h12}${ap}`; html += `<th style=\"padding:6px 8px;border:1px solid #374151;white-space:nowrap\">${label}</th>`; }
  html += '</tr>';
  // Data rows
  for(const [label, key, fmt] of fields){
    html += `<tr><td style=\"position:sticky;left:0;background:#111827;color:#e5e7eb;padding:6px 8px;border:1px solid #374151;font-weight:600\">${label}</td>`;
    for(const h of H){ const v=h[key]; html += `<td style=\"padding:6px 8px;border:1px solid #374151;text-align:right\">${fmt(v)}</td>`; }
    html += '</tr>';
  }
  html += '</table>';
  inner.innerHTML = html;
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
  
  btn.addEventListener('touchstart', startPress, false);
  btn.addEventListener('touchend', endPress, false);
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
function toggleTestMode(){ TEST_MODE_ENABLED=!TEST_MODE_ENABLED; const el=$("testModeBanner"); if(el) el.classList.toggle('hidden', !TEST_MODE_ENABLED); const qs=$("quickSelect"); const name=qs?.value||"Moon Township, PA"; const coords=QUICK_SELECT_CITIES[name]||QUICK_SELECT_CITIES["Moon Township, PA"]; loadCityByName(name, coords).catch(e=> alert(e?.message||'Failed to load in Test Mode.')); updateVersionChip(); }
function toggleRange(){
  pastDays = 0;
  rangeIndex=(rangeIndex+1)%RANGE_STATES.length; if(currentDataset){ try{ updateRangeButtonLabel(); buildChart(currentDataset); }catch{ buildChart(currentDataset);} } 
}
function toggleLayout(){ LAYOUT_MODE = (LAYOUT_MODE==='fit')?'scroll':'fit'; if(currentDataset) buildChart(currentDataset); }
function toggleApparent(){ APPARENT_OVERLAY_ENABLED = !APPARENT_OVERLAY_ENABLED; if(currentDataset) buildChart(currentDataset); }

async function loadCityByName(cityName, coords){ try{ const data=await loadWeatherData(cityName, coords.lat, coords.lon, pastDays); currentCityName=cityName; currentLocationLat=coords.lat; currentLocationLon=coords.lon; setCityTitle(cityName); const host=$("statusLine"); const sv = host ? host.querySelector('.summary-value') : null; if (sv){ sv.textContent = "Click a point on the chart..."; } currentDataset=data; buildChart(data); } catch(e){ console.error(e); alert(e?.message || 'Failed to load weather data.'); } }
async function handleQuickSelectChange(){ const qs=$("quickSelect"); const name=qs ? qs.value : null; if(!name) return; const coords=QUICK_SELECT_CITIES[name]; if(!coords) return; const cityInput=$("cityInput"); if(cityInput) cityInput.value=''; await loadCityByName(name, coords); if(qs) qs.value=''; }

function installMaximizeStyles(){ if(document.getElementById('maximizeStyles')) return; const s=document.createElement('style'); s.id='maximizeStyles'; s.textContent = `
  body.maximized .app-header, body.maximized .summary-box, body.maximized .app-footer, body.maximized #testModeBanner, body.maximized #statusLine, body.maximized #matchModal, body.maximized #versionChip { display: none !important; }
  body.maximized .app-main { padding: 0 !important; }
  body.maximized .chart-container { position: fixed !important; inset: 0 !important; z-index: 999 !important; height: 100vh !important; }
`; document.head.appendChild(s); }

// ---------- Button Container (holds Maximize + Menu side-by-side) ----------
function ensureButtonContainer(){ if(document.getElementById('btnContainer')) return; const c=document.createElement('div'); c.id='btnContainer'; Object.assign(c.style,{position:'fixed',right:'16px',top:'16px',zIndex:'3000',display:'flex',gap:'8px',alignItems:'center'}); document.body.appendChild(c); }

function ensureRangeButton(){ const btn=$("rangeToggle"); if(!btn || btn.parentElement?.id==='btnContainer') return; ensureButtonContainer(); const container=document.getElementById('btnContainer'); Object.assign(btn.style,{position:'static',height:'32px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(31,41,55,0.75)',color:'#f9fafb',padding:'0 10px',cursor:'pointer',backdropFilter:'blur(6px)',fontSize:'0.85rem'}); container.appendChild(btn); }

function ensureMaximizeUI(){ if(document.getElementById('chartMaxBtn')) return; ensureButtonContainer(); const b=document.createElement('button'); b.id='chartMaxBtn'; b.title='Maximize'; b.textContent='⛶'; Object.assign(b.style,{position:'static',width:'32px',height:'32px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'8px',background:'rgba(31,41,55,0.75)',color:'#f9fafb',border:'1px solid rgba(255,255,255,0.18)',backdropFilter:'blur(6px)',cursor:'pointer',userSelect:'none'}); b.addEventListener('click', ()=>{ const m=document.body.classList.toggle('maximized'); b.textContent = m ? '🗗' : '⛶'; try{ chart?.resize(); DomColorBar.render(chart); SeparateColorBar.render(chart); }catch{} }); document.getElementById('btnContainer').appendChild(b); }



// ---------- Quick Select + GPS ----------
function populateQuickSelectSorted(){ const select=$("quickSelect"); if(!select) return; for (let i = select.options.length - 1; i >= 1; i--) select.remove(i); const entries = Object.entries(QUICK_SELECT_CITIES).sort((a,b)=> a[1].lon - b[1].lon); for (const [name] of entries){ const opt=document.createElement('option'); opt.value=name; opt.textContent=name; select.appendChild(opt); } }

function ensureGPSButton(){ const qs=$("quickSelect"); if(!qs || $("gpsBtn")) return; const btn=document.createElement('button'); btn.id='gpsBtn'; btn.textContent='Use GPS'; btn.title='Use device location'; btn.style.marginLeft='6px'; btn.style.padding='4px 8px'; btn.style.borderRadius='6px'; btn.style.cursor='pointer'; qs.insertAdjacentElement('afterend', btn); updateChromeForTheme(); btn.addEventListener('click', ()=>{ if(!navigator.geolocation){ alert('Geolocation not supported by this browser.'); return;} navigator.geolocation.getCurrentPosition(async(pos)=>{ const {latitude:lat, longitude:lon}=pos.coords||{}; const cityInput=$("cityInput"); if(cityInput) cityInput.value=''; await loadCityByName(`My Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`, {lat, lon}); }, (err)=>{ alert('Unable to get location: '+(err?.message||'Unknown error')); }, {enableHighAccuracy:true, timeout:8000, maximumAge:300000}); }); }

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
  
  try { const elJs=$("ver-js"); if(elJs) elJs.textContent = `app.js v7.12.28`; } catch(e){ console.warn(e); }
  
  installMaximizeStyles(); ensureMaximizeUI(); ensureRangeButton(); ensureAppMenu(); ensureRadarButton(); reserveRightHeaderSpace(); dedupeHeaderControls(); updateChromeForTheme(); updateVersionChip();
  populateQuickSelectSorted(); ensureGPSButton();
  
  // Setup update banner button handlers
  $("updateReloadBtn")?.addEventListener("click", reloadForUpdate);
  $("updateDismissBtn")?.addEventListener("click", hideUpdateBanner);

  $("quickSelect")?.addEventListener("change", handleQuickSelectChange);
  $("searchBtn")?.addEventListener("click", async ()=>{ const q=$("cityInput")?.value?.trim(); if(!q) return; try{ const results=await geocodeCity(q); if(results.length===0){ alert('No matches found.'); return;} if(results.length===1){ const r=results[0]; const name=`${r.name}, ${r.admin1 || r.country}`; await loadCityByName(name, {lat:r.latitude, lon:r.longitude}); const qs=$("quickSelect"); if(qs) qs.value=''; return;} const modal=$("matchModal"), list=$("matchList"); if(!modal||!list) return; list.innerHTML=''; results.forEach(r=>{ const li=document.createElement('li'); const label=`${r.name}, ${r.admin1 || r.country}`; li.textContent=label; li.addEventListener('click', async()=>{ modal.classList.add('hidden'); await loadCityByName(label, {lat:r.latitude, lon:r.longitude}); const qs=$("quickSelect"); if(qs) qs.value=''; }); list.appendChild(li); }); $("matchCancelBtn").onclick=()=> modal.classList.add('hidden'); modal.classList.remove('hidden'); }catch(e){ console.error(e); alert('Search failed.'); } });
  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("testModeToggle")?.addEventListener("click", toggleTestMode);
  setupRangeButtonLongPress();
  $("rangeToggle")?.setAttribute('title', 'Range: 24h | Long-press for history');
  $("layoutToggle")?.addEventListener("click", toggleLayout);
  $("cityInput")?.addEventListener("keydown", e=>{ if(e.key==="Enter") $("searchBtn")?.click(); });

  const coords = QUICK_SELECT_CITIES['Moon Township, PA'];
  const qs=$("quickSelect"); if(qs) qs.value='Moon Township, PA';
  currentLocationLat = coords.lat;
  currentLocationLon = coords.lon;
  try{
    const data = await loadWeatherData('Moon Township, PA', coords.lat, coords.lon);
    buildChart(data);
    updateRangeButtonLabel();
  }catch(e){ console.error(e); alert(e?.message||'Failed to load initial data.'); }

  window.addEventListener('resize', ()=>{ if(LAYOUT_MODE==='fit' && currentDataset){ try{ applyLayout(currentDataset.hourly.map(h=>h.time)); chart?.resize(); DomColorBar.render(chart); SeparateColorBar.render(chart);}catch{} } });
});

// ======= About Dialog =======
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
      <p style="margin:0 0 8px 0; font-size:0.9rem; opacity:0.7;">Code Updated: <strong>${generateCodeUpdateTimestamp()}</strong></p>
      <p style="margin:0 0 8px 0; font-size:0.9rem; opacity:0.7;">Created by <strong>Ben Sacherich</strong></p>
      <div style="margin:16px 0 0 0; padding-top:16px; border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'}">
        <p style="margin:0 0 12px 0; font-weight:600; font-size:0.95rem;">APIs & Libraries:</p>
        <ul style="margin:0 0 16px 0; padding-left:20px; list-style:disc;">
          <li style="margin:6px 0;"><a href="https://open-meteo.com/" target="_blank" style="color:#3b82f6; text-decoration:none;">Open-Meteo Geolocation</a></li>
          <li style="margin:6px 0;"><a href="https://open-meteo.com/" target="_blank" style="color:#3b82f6; text-decoration:none;">Open-Meteo Forecast</a></li>
          <li style="margin:6px 0;"><a href="https://www.chartjs.org/" target="_blank" style="color:#3b82f6; text-decoration:none;">Chart.js v4.4.1</a></li>
          <li style="margin:6px 0;"><a href="https://radar.weather.gov/" target="_blank" style="color:#3b82f6; text-decoration:none;">NOAA Weather Radar</a></li>
        </ul>
      </div>
      <button id="aboutClose" style="width:100%; padding:10px; margin-top:12px; border:1px solid ${isDark ? '#374151' : '#d1d5db'}; background:${isDark ? '#111827' : '#f3f4f6'}; color:inherit; border-radius:6px; cursor:pointer; font-size:0.95rem;">Close</button>
    `;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
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
document.body.appendChild(btn);


  const rangeToggle = document.getElementById('rangeToggle');
  if(rangeToggle && rangeToggle.parentNode) {
    rangeToggle.insertAdjacentElement('afterend', btn);
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
