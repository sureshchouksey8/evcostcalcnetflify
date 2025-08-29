/* ===== Mini utilities ===== */
const $ = s => document.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const inr = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n||0));
const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));

/* Error banner (so silent JS errors aren’t silent) */
(function installErrorBanner(){
  const bar=document.createElement('div');
  bar.id='__errbar__';
  bar.style.cssText='position:sticky;top:0;z-index:9999;background:#7f1d1d;color:#fff;padding:6px 10px;font-weight:800;display:none';
  document.addEventListener('DOMContentLoaded',()=>document.body.prepend(bar));
  window.addEventListener('error',e=>{
    bar.textContent='JS error: '+(e?.error?.message || e.message || e);
    bar.style.display='block';
  });
})();

/* ===== Global State ===== */
const S = {
  tab: 'cars',
  list: [],
  selected: null,
  city: 'Gurugram',
  petrol: 100,
  tariff: 6.8,
  kmPerDay: 20,
  daysPerMonth: 26,
  cmpIndex: 0,
  cmpKm: 20
};

/* ===== Data access ===== */
function DATA(){ return S.tab==='cars' ? (window.MODELS_CARS||[]) : (window.MODELS_SCOOTERS||[]); }
function KMPL(seg){ return (window.BENCH_KMPL||{})[seg] ?? 15; }
function costFor(m, kmOverride){
  const km = kmOverride!=null ? kmOverride : S.kmPerDay;
  const evkm = ((m.eff_kwh_per_100km||15)/100)*(S.tariff)*1.12;
  const icekm = S.petrol / Math.max(1, KMPL(m.segment));
  const perDayE = evkm * km, perDayI = icekm * km;
  const mEV = perDayE * S.daysPerMonth, mICE = perDayI * S.daysPerMonth;
  return { km, perDayE, perDayI, mEV, mICE, evkm, icekm };
}

/* ===== List render ===== */
function renderList(){
  S.list = DATA();
  const q = ($('#q') && $('#q').value || '').toLowerCase();
  const items = S.list.filter(m => !q || (m.brand+' '+m.model+' '+m.segment).toLowerCase().includes(q));
  if ($('#resultCount')) $('#resultCount').textContent = `${items.length} result${items.length===1?'':'s'}`;

  const grid = $('#grid'); if (!grid) return;
  grid.innerHTML='';
  items.forEach(m=>{
    const b = document.createElement('button'); b.className='card';
    const t1 = document.createElement('div'); t1.className='bold'; t1.style.fontSize='18px'; t1.textContent=`${m.brand} ${m.model}`;
    const t2 = document.createElement('div'); t2.className='small muted mt8'; t2.textContent=`${m.segment} • est. range ${m.range_km||'—'} km`;
    const t3 = document.createElement('div'); t3.className='small mt8'; t3.innerHTML = `<span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span>`;
    b.append(t1,t2,t3);
    b.addEventListener('click',()=>openCalc(m));
    grid.appendChild(b);
  });
}

/* ===== Cities ===== */
function initCities(){
  const sel = $('#citySel'); if (!sel) return;
  sel.innerHTML='';
  (window.CITY_PRESETS||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
  const def = (window.CITY_PRESETS||[]).find(x=>x.name==='Gurugram') || (window.CITY_PRESETS||[])[0];
  if (def){ sel.value=def.id; S.city=def.name; S.tariff=def.tariff; S.petrol=def.petrol; if($('#tariffView')) $('#tariffView').textContent=S.tariff.toFixed(1); }
  sel.onchange = ()=>{
    const pick = (window.CITY_PRESETS||[]).find(x=>x.id===sel.value);
    if (pick){ S.city=pick.name; S.tariff=pick.tariff; S.petrol=pick.petrol; if($('#tariffView')) $('#tariffView').textContent=S.tariff.toFixed(1); if($('#petrolIn')) $('#petrolIn').value=S.petrol; compute(); }
  };
  if($('#petrolIn')) { $('#petrolIn').value = S.petrol; $('#petrolIn').oninput = ()=>{ S.petrol = +$('#petrolIn').value || 0; compute(); }; }
}

/* ===== Calculator wiring ===== */
const overlay=$('#overlay');
const perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'), kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce');
const monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair');
const barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY');
const gProg=$('#gProg'), gLabel=$('#gLabel'), gSub=$('#gSub'), modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit');

if ($('#tab-cars')) $('#tab-cars').onclick = ()=>{ S.tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters')&&$('#tab-scooters').classList.remove('active'); renderList(); };
if ($('#tab-scooters')) $('#tab-scooters').onclick = ()=>{ S.tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars')&&$('#tab-cars').classList.remove('active'); renderList(); };
if ($('#q')) $('#q').oninput = renderList;

if ($('#kmRange')) $('#kmRange').oninput = ()=>{
  S.kmPerDay = +$('#kmRange').value; if($('#kmVal')) $('#kmVal').textContent = S.kmPerDay;
  if(kmNoteEv) kmNoteEv.textContent=`For ${S.kmPerDay} km/day`;
  if(kmNoteIce) kmNoteIce.textContent=`For ${S.kmPerDay} km/day`;
  compute();
};
if ($('#daysRange')) $('#daysRange').oninput = ()=>{
  S.daysPerMonth = +$('#daysRange').value; if($('#daysBadge')) $('#daysBadge').textContent = `${S.daysPerMonth} days`; compute();
};

if ($('#infoBtn')) $('#infoBtn').onclick = ()=> openInfo('calc');
if ($('#emiBtn')) $('#emiBtn').onclick = ()=> openTools();
if ($('#closeBtn')) $('#closeBtn').onclick = closeAll;
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAll(); });
if (overlay) overlay.addEventListener('click',e=>{ if(e.target===overlay) closeAll(); });

/* Model switcher */
if ($('#prevModel')) $('#prevModel').onclick = ()=> switchRel(-1);
if ($('#nextModel')) $('#nextModel').onclick = ()=> switchRel(1);
if ($('#modelSwitcher')) $('#modelSwitcher').onchange = ()=>{
  const id = $('#modelSwitcher').value;
  const m = (S.list||[]).find(x=>x.id===id) || DATA().find(x=>x.id===id);
  if (m) openCalc(m,true);
};

function switchRel(dir){
  if (!S.selected) return;
  const L = DATA(); const i = L.findIndex(x=>x.id===S.selected.id);
  const j = (i+dir+L.length)%L.length; openCalc(L[j], true);
}

function openCalc(m, keepOpen){
  S.selected = m;

  if ($('#headerModel')) $('#headerModel').textContent = m.brand+' '+m.model;

  const listForSwitch = DATA();
  if ($('#modelSwitcher')){
    const ms = $('#modelSwitcher'); ms.innerHTML = listForSwitch.map(x=>`<option value="${x.id}">${x.brand} ${x.model}</option>`).join('');
    ms.value = m.id;
  }

  if (modelName) modelName.textContent = m.brand+' '+m.model;
  if (modelInfo) modelInfo.textContent = `${m.segment} • est. range ${m.range_km||'—'} km`;

  // reset AI panel text storage (front-end only now)
  window.__aiShareLine = '';

  if ($('#kmRange')) { $('#kmRange').value = S.kmPerDay; if($('#kmVal')) $('#kmVal').textContent = S.kmPerDay; }
  if ($('#daysRange')) { $('#daysRange').value = S.daysPerMonth; if($('#daysBadge')) $('#daysBadge').textContent = `${S.daysPerMonth} days`; }
  if ($('#tariffView')) $('#tariffView').textContent = (S.tariff||0).toFixed(1);
  if ($('#petrolIn')) $('#petrolIn').value = S.petrol;

  compute();

  if (!keepOpen && overlay){
    closeAll(); overlay.classList.add('show'); document.documentElement.style.overflow='hidden';
  }
}

function closeAll(){
  ['overlay','compareOverlay','shareOverlay','toolsOverlay','infoOverlay'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.classList.remove('show');
  });
  document.documentElement.style.overflow='auto';
}

/* Compute & paint */
function removeLegend(container){
  const lg = container.querySelector('.legend');
  if (lg && lg.parentNode) lg.parentNode.removeChild(lg);
}
function compute(){
  if (!S.selected) return;
  const c = costFor(S.selected);

  if (perDayEv) perDayEv.textContent = inr(c.perDayE);
  if (perDayIce) perDayIce.textContent = inr(c.perDayI);
  if (kmNoteEv) kmNoteEv.textContent=`For ${c.km} km/day`;
  if (kmNoteIce) kmNoteIce.textContent=`For ${c.km} km/day`;

  if (monthlyPair) monthlyPair.textContent = `EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`;
  if (yearlyPair) yearlyPair.textContent = `EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;

  const totalM = Math.max(c.mEV,c.mICE,1);
  if (barEvM) barEvM.style.width=(c.mEV/totalM*100)+'%';
  if (barIceM) barIceM.style.width=(c.mICE/totalM*100)+'%';
  const totalY = Math.max(c.mEV*12,c.mICE*12,1);
  if (barEvY) barEvY.style.width=(c.mEV*12/totalY*100)+'%';
  if (barIceY) barIceY.style.width=(c.mICE*12/totalY*100)+'%';

  // legends
  const sm = $('#statMonthly'), sy = $('#statYearly');
  if (sm){
    removeLegend(sm);
    const lg=document.createElement('div'); lg.className='legend';
    lg.innerHTML = `<span class="dot" style="background:#16a34a"></span> EV  <span class="dot" style="background:#ea580c;margin-left:12px"></span> Petrol`;
    sm.insertBefore(lg, sm.firstChild);
  }
  if (sy){
    removeLegend(sy);
    const lg=document.createElement('div'); lg.className='legend';
    lg.innerHTML = `<span class="dot" style="background:#16a34a"></span> EV  <span class="dot" style="background:#ea580c;margin-left:12px"></span> Petrol`;
    sy.insertBefore(lg, sy.firstChild);
  }

  // gauge (no overlap)
  if (gProg && gLabel && gSub){
    const save = Math.max(0, c.mICE - c.mEV);
    const pct = (c.mICE>0)? Math.round((save/c.mICE)*100):0;
    const circ=2*Math.PI*50; const prog = clamp(pct,0,100)/100;
    gProg.setAttribute('stroke-dasharray', (circ*prog)+' '+(circ-circ*prog));
    gProg.setAttribute('stroke', pct<10? '#f59e0b' : '#16a34a');
    gLabel.setAttribute('y','64'); gLabel.textContent = pct+'%';
    gSub.setAttribute('y','90'); gSub.textContent = 'Savings vs petrol';
    if ($('#saveMonth')) $('#saveMonth').textContent = inr(save);
    if (goodFit) goodFit.style.display = (pct>=20 && save>1500)?'inline-flex':'none';
  }

  window.__calcCache = { ...c, monthlySavings: Math.max(0, c.mICE - c.mEV) };
}

/* ===== AI fallback (front-end only for now) ===== */
if ($('#aiBtn')) $('#aiBtn').addEventListener('click', ()=>{
  if(!S.selected) return;
  const panel = $('#aiPanel'); if (panel) panel.style.display='block';
  const c = window.__calcCache || costFor(S.selected);
  const reasons = [
    `In ${S.city}, EV/day ${inr(c.perDayE)} vs Petrol/day ${inr(c.perDayI)}.`,
    `Monthly savings ~ ${inr(c.mICE - c.mEV)} at ${S.kmPerDay} km/day, ${S.daysPerMonth} days/mo.`
  ];
  if ($('#aiVerdict')) $('#aiVerdict').textContent = '✅ Quick check';
  if ($('#aiReasons')) $('#aiReasons').innerHTML = '<ul class="small" style="margin:6px 0 0 18px">'+reasons.map(r=>`<li>${r}</li>`).join('')+'</ul>';
  if ($('#aiAlt')) $('#aiAlt').textContent = '';
  window.__aiShareLine = `In ${S.city}, EV saves ~ ${inr(c.mICE - c.mEV)}/mo at ${S.kmPerDay} km/day.`;
});

/* ===== Share modal ===== */
const shareOv=$('#shareOverlay'), shareCv=$('#shareCanvas'), sctx=shareCv?shareCv.getContext('2d'):null;
if ($('#shareBtn')) $('#shareBtn').onclick = ()=> openShare();
if ($('#openShare')) $('#openShare').onclick = ()=> openShare();
if ($('#shareClose')) $('#shareClose').onclick = closeAll;
if ($('#openNew')) $('#openNew').onclick = ()=> shareCv.toBlob(b=>{ if(!b)return; const u=URL.createObjectURL(b); window.open(u,'_blank'); setTimeout(()=>URL.revokeObjectURL(u),4000); },'image/png');
if ($('#dlPng')) $('#dlPng').onclick = ()=>{
  shareCv.toBlob(b=>{
    if(!b){alert('Could not render image');return;}
    const url=URL.createObjectURL(b); const a=document.createElement('a');
    a.href=url; a.download='EV-Cost-Card.png'; document.body.appendChild(a); a.click();
    setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},600);
  },'image/png');
};
if ($('#copyB64')) $('#copyB64').onclick = ()=>{ const b64=shareCv.toDataURL('image/png'); (navigator.clipboard?.writeText? navigator.clipboard.writeText(b64).then(()=>alert('Base64 copied ✅')) : (prompt('Copy this Base64:', b64))); };

function openShare(){
  if(!S.selected){alert('Pick a model first');return;}
  if (!shareOv) return;
  closeAll(); shareOv.classList.add('show'); document.documentElement.style.overflow='hidden';
  drawShare();
}

function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke(); }
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text||'').split(/\s+/); let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i>0) { ctx.fillText(line, x, y); y += lineHeight; line = words[i] + ' '; }
    else { line = test; }
  }
  if (line) ctx.fillText(line, x, y);
}
function drawShare(){
  if (!sctx) return;
  const m = S.selected; if(!m) return; const c = window.__calcCache || costFor(m);
  const W=1080,H=1920; sctx.clearRect(0,0,W,H);
  const g1=sctx.createLinearGradient(0,0,0,H); g1.addColorStop(0,'#0b1220'); g1.addColorStop(1,'#0a0f1a'); sctx.fillStyle=g1; sctx.fillRect(0,0,W,H);

  sctx.fillStyle='#e2e8f0'; sctx.font='700 26px Inter, system-ui'; sctx.fillText('EV Cost Advisor — India', 56, 80);

  sctx.fillStyle='#ffffff'; sctx.font='900 64px Inter, system-ui';
  const title = m.brand+' '+m.model; const tw=sctx.measureText(title).width;
  sctx.fillText(title, (W-tw)/2, 240);

  sctx.fillStyle='#93c5fd'; sctx.font='26px Inter, system-ui';
  const sub = `${m.segment} · ${S.kmPerDay} km/day · ${S.daysPerMonth} days/mo · Petrol ₹${Math.round(S.petrol)}/L · ${S.city}`;
  const sw=sctx.measureText(sub).width; sctx.fillText(sub,(W-sw)/2, 288);

  const tile=(y,color,label,value)=>{ sctx.save(); sctx.translate(56,y);
    sctx.fillStyle=color; roundRect(sctx,0,0,W-112,210,26,true,false);
    const sh=sctx.createLinearGradient(0,0,W-112,0); sh.addColorStop(0,'rgba(255,255,255,.06)'); sh.addColorStop(.3,'rgba(255,255,255,0)'); sctx.fillStyle=sh; roundRect(sctx,0,0,W-112,210,26,true,false);
    sctx.fillStyle='rgba(255,255,255,.9)'; sctx.font='18px Inter, system-ui'; sctx.fillText(label.toUpperCase(),24,48);
    sctx.fillStyle='#fff'; sctx.font='900 64px Inter, system-ui'; sctx.fillText(value,24,132); sctx.restore();
  };
  tile(360,'#059669','Cost per day (EV)', inr(c.perDayE));
  tile(610,'#ea580c','Cost per day (Petrol)', inr(c.perDayI));

  sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly running cost',56, 880);
  sctx.fillStyle='#a7f3d0'; sctx.font='700 36px Inter, system-ui'; sctx.fillText(`EV ${inr(c.mEV)}  •  Petrol ${inr(c.mICE)}`,56, 924);

  sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly savings',56, 980);
  sctx.fillStyle='#a7f3d0'; sctx.font='900 54px Inter, system-ui'; sctx.fillText(inr(c.mICE - c.mEV),56, 1036);

  const line = ($('#aiAddShare') && $('#aiAddShare').checked) ? (window.__aiShareLine||'') : '';
  if (line) { sctx.fillStyle='#d1fae5'; sctx.font='28px Inter, system-ui'; wrapText(sctx, line, 56, 1110, W-112, 34); }

  sctx.fillStyle='#94a3b8'; sctx.font='24px Inter, system-ui';
  sctx.fillText('evcost.in • shareable',56,H-72);
  sctx.fillText('© '+(new Date().getFullYear())+' EV Cost Advisor',W-56-420,H-72);
}

/* ===== Tools (EMI) ===== */
const toolsOv=$('#toolsOverlay');
if ($('#toolsClose')) $('#toolsClose').onclick = closeAll;
if ($('#toolsInfo')) $('#toolsInfo').onclick = ()=> openInfo('emi');
if ($('#shareEmi')) $('#shareEmi').onclick = ()=>{ closeAll(); openShare(); };

function openTools(){
  if(!S.selected){alert('Pick a model first');return;}
  if (!toolsOv) return;
  closeAll(); toolsOv.classList.add('show'); document.documentElement.style.overflow='hidden';
  fillTools();
}
function emiCalc(P, annualRatePct, months){ const r=(annualRatePct/100)/12; if(months<=0) return 0; if(r===0) return P/months; const a=Math.pow(1+r,months); return P*r*a/(a-1); }
function fillTools(){
  const c=window.__calcCache||costFor(S.selected);
  if ($('#lsKm')) $('#lsKm').textContent=Math.round((S.kmPerDay||0)*(S.daysPerMonth||0));
  if ($('#lsKmpl')) $('#lsKmpl').textContent=(KMPL(S.selected.segment)||15)+" km/L";
  const litres=(S.kmPerDay*S.daysPerMonth)/Math.max(1,KMPL(S.selected.segment));
  if ($('#lsLitres')) $('#lsLitres').textContent=(Math.round(litres*10)/10)+" L";

  const amt=$('#emiAmount'), rate=$('#emiRate'), mon=$('#emiMonths');
  if(amt && !amt.value) amt.value=500000; if(rate && !rate.value) rate.value='9.5'; if(mon && !mon.value) mon.value=60;
  const update=()=>{
    const emi=emiCalc(parseFloat(amt&&amt.value||0), parseFloat(rate&&rate.value||0), parseInt(mon&&mon.value||0));
    const cover=(c.monthlySavings>0&&emi>0)?Math.max(0,Math.min(100,Math.round(c.monthlySavings/emi*100))):0;
    if ($('#emiOut')) $('#emiOut').textContent=inr(emi);
    if ($('#savingsOut')) $('#savingsOut').textContent=inr(c.monthlySavings||0);
    const circ=2*Math.PI*50; const prog=cover/100; const arc=$('#emiProg'), lab=$('#emiLabel');
    if (arc) arc.setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog));
    if (lab) lab.textContent=cover+'%';
  };
  ['input','change'].forEach(ev=>{
    if(amt) amt.addEventListener(ev,update);
    if(rate) rate.addEventListener(ev,update);
    if(mon) mon.addEventListener(ev,update);
  });
  update();
}

/* ===== Info modal ===== */
const infoOv=$('#infoOverlay'), infoContent=$('#infoContent'), infoTitle=$('#infoTitle'), infoClose=$('#infoClose');
if (infoClose) infoClose.onclick = closeAll;
function openInfo(which){
  if(!infoOv) return;
  if(which==='emi'){
    if (infoTitle) infoTitle.textContent='EMI helper — What it means';
    if (infoContent) infoContent.innerHTML=`<div class="bold">What is EMI coverage?</div>
    <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV.</div>
    <ul class="small"><li>EMI uses standard amortization.</li><li>Fuel savings = Petrol monthly cost − EV monthly cost.</li></ul>`;
  } else {
    if (infoTitle) infoTitle.textContent='How costs are calculated';
    if (infoContent) infoContent.innerHTML=`<ul class="small"><li><b>EV ₹/km</b> = (kWh/100km ÷ 100) × tariff × 1.12.</li><li><b>Petrol ₹/km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li><li>Monthly = Per-day × days/month.</li></ul>`;
  }
  closeAll(); infoOv.classList.add('show'); document.documentElement.style.overflow='hidden';
}

/* ===== Compare modal ===== */
const cmpOv=$('#compareOverlay'), cmpTrack=$('#cmpTrack');
if ($('#compareBtn')) $('#compareBtn').onclick = ()=> openCompare();
if ($('#cmpClose')) $('#cmpClose').onclick = closeAll;
if ($('#cmpPrev')) $('#cmpPrev').onclick = ()=> cmpSlide(-1);
if ($('#cmpNext')) $('#cmpNext').onclick = ()=> cmpSlide(1);

function openCompare(){
  if(!S.selected){alert('Pick a model first');return;}
  if (!cmpOv) return;
  closeAll(); cmpOv.classList.add('show'); document.documentElement.style.overflow='hidden';
  renderCmpHead(); buildPeers(); renderCmp();
}

function renderCmpHead(){
  const head = cmpOv.querySelector('.modal-head'); if(!head) return;
  let row = head.querySelector('.cmpHeadRow');
  if (!row){
    row = document.createElement('div'); row.className='cmpHeadRow';
    const kmWrap=document.createElement('div'); kmWrap.className='cmpKmBtns'; kmWrap.id='cmpKmBtns';
    [20,40,60,80,150].forEach(v=>{
      const b=document.createElement('button'); b.className='btn'; b.textContent=`${v} km/day`; b.dataset.km=v;
      b.onclick=()=>{ S.cmpKm = v; highlightCmpKm(); renderCmp(); };
      kmWrap.appendChild(b);
    });
    const meta=document.createElement('div'); meta.className='cmpMeta'; meta.id='cmpMeta';
    meta.textContent = `Days/mo: ${S.daysPerMonth}`;
    row.appendChild(kmWrap); row.appendChild(meta);
    head.insertBefore(row, head.firstChild.nextSibling || null);
  }
  highlightCmpKm();
}
function highlightCmpKm(){ $$('#cmpKmBtns .btn').forEach(b=> b.classList.toggle('active', +b.dataset.km===S.cmpKm)); }

let peers = [];
function buildPeers(){
  const all = DATA(); const sel = S.selected; const band = sel.price_lakh||0;
  peers = all
    .filter(x=> x.id!==sel.id)                                     // not itself
    .filter(x=> (S.tab==='cars') ? (x.segment!=='Scooter') : (x.segment==='Scooter')) // car vs scooter
    .filter(x=> (x.segment===sel.segment))                         // same segment when possible
    .filter(x=> Math.abs((x.price_lakh||0)-band) <= band*0.2 )     // ±20% price
    .sort((a,b)=> costFor(a, S.cmpKm).mEV - costFor(b, S.cmpKm).mEV);

  // fallback if too strict
  if (peers.length<3){
    peers = all.filter(x=>x.id!==sel.id && ((S.tab==='cars') ? (x.segment!=='Scooter') : (x.segment==='Scooter')))
               .sort((a,b)=> costFor(a, S.cmpKm).mEV - costFor(b, S.cmpKm).mEV)
               .slice(0,8);
  }
  S.cmpIndex = 0;
}
function renderCmp(){
  if (!cmpTrack) return;
  cmpTrack.innerHTML='';
  const perView = window.innerWidth>=1024? 3 : 1;
  const cardW = Math.min(320, Math.max(280, Math.floor((window.innerWidth-200)/perView)));
  peers.forEach(p=>{
    const c = costFor(p, S.cmpKm);
    const el = document.createElement('div'); el.className='cmpCard'; el.style.minWidth=cardW+'px';
    el.innerHTML = `
      <img class="cmpImg" src="assets/img/${p.id}.jpg" onerror="this.style.display='none'">
      <h3>${p.brand} ${p.model}</h3>
      <div class="cmpTag">${p.segment} • ex-showroom ${inr((p.price_lakh||0)*100000)}</div>
      <div class="cmpRow"><span class="dot" style="background:#16a34a"></span> EV/day <b>${inr(c.perDayE)}</b></div>
      <div class="cmpRow"><span class="dot" style="background:#ea580c"></span> Petrol/day <b>${inr(c.perDayI)}</b></div>
      <div class="cmpRow cmpSave">Monthly savings ~ ${inr(c.mICE - c.mEV)}</div>
      <div class="cmpActions">
        <button class="button primary">Select</button>
      </div>
    `;
    el.querySelector('.button.primary').onclick = ()=>{ openCalc(p); };
    cmpTrack.appendChild(el);
  });
  applyCmpTransform();
}
function cmpSlide(dir){
  const perView = window.innerWidth>=1024? 3 : 1;
  const maxIndex = Math.max(0, peers.length - perView);
  S.cmpIndex = clamp(S.cmpIndex + dir, 0, maxIndex);
  applyCmpTransform();
}
function applyCmpTransform(){
  if (!cmpTrack) return;
  const card = cmpTrack.querySelector('.cmpCard');
  const perView = window.innerWidth>=1024? 3 : 1;
  const cardWidth = card ? card.getBoundingClientRect().width : 300;
  const gap = 16;
  const shift = (cardWidth+gap) * S.cmpIndex;
  cmpTrack.style.transform = `translateX(${-shift}px)`;
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  renderList();
  initCities();
});
