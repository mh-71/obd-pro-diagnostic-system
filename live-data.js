// Live Data page: polls the ESP32 read-only API. No fake values are shown as live.
const byId = id => document.getElementById(id);
const apiInput = byId("apiBase");
const intervalInput = byId("pollInterval");
let pollTimer = null;
let requestInFlight = false;
let lastGoodData = null;
const history = { rpm: [], coolant_c: [] };
const maxHistory = 38;

function cleanBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}
function setConnection(ok, message) {
  const label = byId("connectionLabel");
  const sub = byId("connectionSub");
  const side = byId("sideConnection");
  const mode = byId("modeBadge");
  [byId("connectionDot"), byId("sideDot"), byId("footerDot")].forEach(el => {
    if (el) { el.style.background = ok ? "var(--green)" : "var(--red)"; el.style.boxShadow = ok ? "0 0 10px #00e68a66" : "0 0 10px #ff465866"; }
  });
  if (label) label.textContent = ok ? "ESP32 Connected" : "Not connected";
  if (sub) sub.textContent = `API: ${cleanBaseUrl(apiInput.value)}`;
  if (side) side.textContent = ok ? "ESP32 Connected" : "Waiting for ESP32";
  if (mode) { mode.innerHTML = `<span></span>${ok ? "LIVE DATA" : "WAITING"}`; mode.style.color = ok ? "var(--green)" : "var(--orange)"; }
  byId("connectionMessage").textContent = message;
  byId("footerStatus").textContent = ok ? "Live data from ESP32" : "Waiting for ESP32";
}
function fmt(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}
function setStatus(id, available) {
  const el = byId(id);
  if (el) el.innerHTML = available ? '<span class="pill">Received</span>' : '<span class="pill warning">Unsupported</span>';
}
function setText(id, value, digits=1) { const el=byId(id); if(el) el.textContent=fmt(value,digits); }
function updateSpark(id, values) {
  const el=byId(id); if(!el || !values.length) return;
  const min=Math.min(...values), max=Math.max(...values), range=(max-min)||1;
  const pts=values.map((v,i)=>`${i*160/Math.max(1,values.length-1)},${24-(v-min)/range*18}`);
  el.setAttribute("points",pts.join(" "));
}
function drawLiveChart(canvas, values, color, maxValue, unit) {
  if (!canvas) return;
  const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1, w=Math.max(240,rect.width), h=125;
  canvas.width=w*dpr; canvas.height=h*dpr;
  const c=canvas.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);
  const L=36,R=8,T=8,B=22,pw=w-L-R,ph=h-T-B;
  c.font="9px Inter, sans-serif"; c.textAlign="right"; c.textBaseline="middle"; c.fillStyle="#7895ae"; c.strokeStyle="rgba(63,111,145,.24)";
  for(let i=0;i<=3;i++){const y=T+ph*i/3;c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillText(fmt(maxValue*(3-i)/3,0),L-6,y);}
  for(let i=0;i<=5;i++){const x=L+pw*i/5;c.beginPath();c.moveTo(x,T);c.lineTo(x,T+ph);c.stroke();}
  if(values.length>1){
    const pts=values.map((v,i)=>({x:L+pw*i/(values.length-1),y:T+ph-Math.max(0,Math.min(v,maxValue))/maxValue*ph}));
    const g=c.createLinearGradient(0,T,0,T+ph);g.addColorStop(0,color+"42");g.addColorStop(1,color+"00");
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.lineTo(pts.at(-1).x,T+ph);c.lineTo(pts[0].x,T+ph);c.closePath();c.fillStyle=g;c.fill();
    c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=2;c.stroke();
  } else {
    c.fillStyle="#7895ae";c.textAlign="center";c.fillText("Waiting for sensor samples…",L+pw/2,T+ph/2);
  }
  c.textAlign="center";c.textBaseline="top";c.fillStyle="#7895ae";
  ["oldest","", "", "", "", "latest"].forEach((t,i)=>c.fillText(t,L+pw*i/5,T+ph+6));
}
function renderCharts(){
  drawLiveChart(byId("rpmChart"),history.rpm,"#00e68a",6000,"RPM");
  drawLiveChart(byId("tempChart"),history.coolant_c,"#ff4658",120,"°C");
}
function applyData(data) {
  // Expected JSON shape is documented in esp32/README.md; reject obviously malformed replies.
  if (!data || typeof data !== "object" || !data.sensors) throw new Error("API response is missing the sensors object.");
  const s=data.sensors;
  const values = {
    rpm: s.rpm, coolant_c: s.coolant_c, speed_kmh: s.speed_kmh, engine_load_pct: s.engine_load_pct,
    throttle_pct: s.throttle_pct, map_kpa: s.map_kpa, intake_air_c: s.intake_air_c, maf_gps: s.maf_gps
  };
  const mapping = [
    ["rpm", "rpmMetric", "tblRpm", "stRpm", 0],
    ["coolant_c", "tempMetric", "tblTemp", "stTemp", 1],
    ["speed_kmh", "speedMetric", "tblSpeed", "stSpeed", 0],
    ["engine_load_pct", "loadMetric", "tblLoad", "stLoad", 1],
    ["throttle_pct", null, "tblThrottle", "stThrottle", 1],
    ["map_kpa", null, "tblMap", "stMap", 1],
    ["intake_air_c", null, "tblIat", "stIat", 1],
    ["maf_gps", null, "tblMaf", "stMaf", 2]
  ];
  mapping.forEach(([key, metricId, tableId, statusId, digits]) => {
    const v=values[key], available=v!==null && v!==undefined && Number.isFinite(Number(v));
    if(metricId) setText(metricId,v,digits);
    setText(tableId,v,digits);
    setStatus(statusId,available);
  });
  setText("rpmChartValue",s.rpm,0);
  byId("rpmChartValue").textContent = `${fmt(s.rpm,0)} RPM`;
  byId("tempChartValue").textContent = `${fmt(s.coolant_c,1)} °C`;
  byId("dataBadge").textContent = "LIVE";
  byId("dataBadge").className = "pill";
  byId("lastUpdate").textContent = new Date().toLocaleTimeString();
  if(Number.isFinite(Number(s.rpm))){history.rpm.push(Number(s.rpm));if(history.rpm.length>maxHistory)history.rpm.shift();}
  if(Number.isFinite(Number(s.coolant_c))){history.coolant_c.push(Number(s.coolant_c));if(history.coolant_c.length>maxHistory)history.coolant_c.shift();}
  updateSpark("rpmSpark",history.rpm);updateSpark("tempSpark",history.coolant_c);
  updateSpark("speedSpark",history.rpm.map((_,i)=>Number(s.speed_kmh)||0));
  updateSpark("loadSpark",history.rpm.map((_,i)=>Number(s.engine_load_pct)||0));
  renderCharts();
  const source = data.source || "ESP32 / OBD-II";
  byId("rpmSource").textContent = source;
  lastGoodData = data;
}
async function pollOnce() {
  if(requestInFlight) return;
  requestInFlight=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),2500);
  try {
    const url=`${cleanBaseUrl(apiInput.value)}/api/obd`;
    const response=await fetch(url,{method:"GET",cache:"no-store",signal:controller.signal,headers:{"Accept":"application/json"}});
    if(!response.ok) throw new Error(`HTTP ${response.status} from ESP32 API`);
    const data=await response.json();
    applyData(data);
    setConnection(true,`Connected successfully. Updated ${new Date().toLocaleTimeString()}.`);
  } catch(err) {
    setConnection(false,`Could not read ${cleanBaseUrl(apiInput.value)}/api/obd. ${err.name==="AbortError"?"Request timed out.":err.message} Check Wi-Fi, API address and ESP32 firmware.`);
    byId("dataBadge").textContent="NO DATA";byId("dataBadge").className="pill warning";
  } finally {clearTimeout(timeout);requestInFlight=false;}
}
function startPolling() {
  stopPolling(false);
  pollOnce();
  pollTimer=setInterval(pollOnce,Math.max(1000,Number(intervalInput.value)||2000));
  toast("Live polling started. Waiting for ESP32 API response.");
}
function stopPolling(showToast=true) {
  if(pollTimer) clearInterval(pollTimer);
  pollTimer=null;
  if(showToast) toast("Live polling stopped.");
}
byId("startBtn").addEventListener("click",startPolling);
byId("stopBtn").addEventListener("click",()=>stopPolling());
byId("connectBtn").addEventListener("click",pollOnce);
intervalInput.addEventListener("change",()=>{if(pollTimer)startPolling();});
apiInput.addEventListener("change",()=>{byId("connectionSub").textContent=`API: ${cleanBaseUrl(apiInput.value)}`;});
byId("exportBtn").addEventListener("click",()=>{
  if(!lastGoodData){toast("No ESP32 data to export yet.");return;}
  const s=lastGoodData.sensors, rows=[["Parameter","PID","Value","Unit"],["Engine RPM","01 0C",s.rpm,"RPM"],["Vehicle Speed","01 0D",s.speed_kmh,"km/h"],["Coolant Temperature","01 05",s.coolant_c,"°C"],["Engine Load","01 04",s.engine_load_pct,"%"],["Throttle Position","01 11",s.throttle_pct,"%"],["Intake Manifold Pressure","01 0B",s.map_kpa,"kPa"],["Intake Air Temperature","01 0F",s.intake_air_c,"°C"],["MAF Air Flow","01 10",s.maf_gps,"g/s"]];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="obd-pro-live-data.csv";a.click();URL.revokeObjectURL(a.href);
});
setConnection(false,"Not connected yet. Connect the computer to the ESP32 Wi-Fi, confirm the API URL, then press Start live polling.");
renderCharts();
