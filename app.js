const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let toastTimer;
function toast(message){const el=$("#toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
if(window.lucide) window.lucide.createIcons();
$$("[data-demo-action]").forEach(b=>b.addEventListener("click",()=>toast(b.dataset.demoAction)));
$$(".nav-item").forEach(b=>{if(b.href && location.pathname.endsWith(b.getAttribute("href")))b.classList.add("active");});
function drawChart(canvas, values, color, maxValue){
 if(!canvas)return;const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(220,rect.width),h=125;
 canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext("2d");c.scale(dpr,dpr);
 const L=30,R=7,T=8,B=22,pw=w-L-R,ph=h-T-B;c.clearRect(0,0,w,h);c.font="9px Inter, sans-serif";c.textAlign="right";c.textBaseline="middle";c.fillStyle="#7895ae";c.strokeStyle="rgba(63,111,145,.24)";
 for(let i=0;i<=3;i++){let y=T+ph*i/3;c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillText(Math.round(maxValue*(3-i)/3),L-5,y);}
 for(let i=0;i<=5;i++){let x=L+pw*i/5;c.beginPath();c.moveTo(x,T);c.lineTo(x,T+ph);c.stroke();}
 let pts=values.map((v,i)=>({x:L+pw*i/(values.length-1),y:T+ph-Math.min(v,maxValue)/maxValue*ph}));let g=c.createLinearGradient(0,T,0,T+ph);g.addColorStop(0,color+"42");g.addColorStop(1,color+"00");c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.lineTo(pts.at(-1).x,T+ph);c.lineTo(pts[0].x,T+ph);c.closePath();c.fillStyle=g;c.fill();c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=2;c.stroke();c.textAlign="center";c.textBaseline="top";c.fillStyle="#7895ae";["10:20","10:21","10:22","10:23","10:24","10:25"].forEach((t,i)=>c.fillText(t,L+pw*i/5,T+ph+6));
}
const rpmSeries=[2450,2700,2300,2950,3200,2750,3100,3600,2900,3400,3150,3850,3300,4100,3700,4700,3900,4200,3500,3750,3300,3600,3000,3400,2800,2200,1950,2100,1850,2050,1980,2200,1870,2040,1950,2100,1800,1980];
const tempSeries=[74,75,76,75,77,76,78,77,76,78,79,80,79,81,80,82,81,80,83,82,81,82,84,83,82,83,84,82,85,84,83,85,84,86,85,87,86,89];
function renderCharts(){drawChart($("#rpmChart"),rpmSeries,"#00e68a",6000);drawChart($("#tempChart"),tempSeries,"#ff4658",120);}
renderCharts();window.addEventListener("resize",renderCharts);
const refresh=$("#refreshBtn");if(refresh)refresh.addEventListener("click",()=>{const rpm=1500+Math.floor(Math.random()*500),temp=87+Math.floor(Math.random()*5);["#rpmMetric","#rpmGauge","#rpmChartValue"].forEach(s=>{const el=$(s);if(el)el.textContent=s==="#rpmChartValue"?rpm.toLocaleString()+" RPM":rpm.toLocaleString();});if($("#tempMetric"))$("#tempMetric").textContent=temp+"°";if($("#tempChartValue"))$("#tempChartValue").textContent=temp+" °C";toast("Demo values refreshed. No vehicle data was requested.");});
const clear=$("#clearCodesBtn");if(clear)clear.addEventListener("click",()=>{const card=$(".dtc-card");if(card)card.style.opacity=".5";if($("#dtcCount"))$("#dtcCount").textContent="0";if($("#readinessDtc"))$("#readinessDtc").textContent="0";toast("Demo code cleared locally only. No ECU command was sent.");});
const read=$("#readCodesBtn");if(read)read.addEventListener("click",()=>toast("Demo DTC shown only. ECU reading is not connected yet."));
const connect=$("#connectBtn");if(connect && !document.getElementById("apiBase"))connect.addEventListener("click",()=>toast("Open Live Data to test the ESP32 API connection."));
const dialog=$("#vehicleDialog");const edit=$("#editVehicleBtn");if(edit&&dialog)edit.addEventListener("click",()=>dialog.showModal());
const form=$("#vehicleForm");if(form)form.addEventListener("submit",e=>{if(e.submitter?.value!=="save")return;e.preventDefault();if($("#vinValue"))$("#vinValue").textContent=$("#vinInput").value.trim().toUpperCase()||"Not available";if($("#fuelValue"))$("#fuelValue").textContent=$("#fuelInput").value;dialog.close();toast("Demo vehicle profile updated.");});
