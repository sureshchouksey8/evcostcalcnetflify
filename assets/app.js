/* ===== Helpers ===== */
const $=s=>document.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const inr=n=> new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n||0));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

/* text wrap for share card */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text||'').split(/\s+/); let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i>0) {
      ctx.fillText(line, x, y); y += lineHeight; line = words[i] + ' ';
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x, y);
}

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
  aiReqId: 0,
  cmpIndex: 0,
  cmpKm: 20
};

/* ===== Data Access ===== */
function DATA(){ return S.tab==='cars' ? window.MODELS_CARS : window.MODELS_SCOOTERS; }
function KMPL(seg){ return window.BENCH_KMPL[seg] ?? 15; }
function evPerKm(m){ return ((m.eff_kwh_per_100km||15)/100) * S.tariff * 1.12; }
function icePerKm(m){ return S.petrol / Math.max(1, KMPL(m.segment)); }

/* ===== Render List ===== */
function renderList(){
  S.list = DATA();
  const q = $('#q').value?.toLowerCase() || '';
  const items = S.list.filter(m => !q || (m.brand+' '+m.model+' '+m.segment).toLowerCase().includes(q));
  $('#resultCount').textContent = `${items.length} result${items.length===1?'':'s'}`;

  const grid = $('#grid'); grid.innerHTML='';
  items.forEach(m=>{
    const b = document.createElement('button'); b.className='card';
    const t1 = document.createElement('div'); t1.className='bold'; t1.style.fontSize='18px'; t1.textContent=`${m.brand} ${m.model}`;
    const t2 = document.createElement('div'); t2.className='small muted mt8'; t2.textContent=`${m.segment} • est. range ${m.range_km||'—'} km`;
    const t3 = document.createElement('div'); t3.className='small mt8'; t3.innerHTML = `<span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span>`;
    b.append(t1,t2,t3);
    b.onclick = ()=> openCalc(m);
    grid.appendChild(b);
  });
}

/* ===== Cities & header ===== */
function initCities(){
  const sel = $('#citySel'); sel.innerHTML='';
  window.CITY_PRESETS.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
  const def = window.CITY_PRESETS.find(x=>x.name==='Gurugram') || window.CITY_PRESETS[0];
  if (def){ sel.value=def.id; S.city=def.name; S.tariff=def.tariff; S.petrol=def.petrol; $('#tariffView').textContent=S.tariff.toFixed(1); }
  sel.onchange = ()=>{
    const pick = window.CITY_PRESETS.find(x=>x.id===sel.value);
    if (pick){ S.city=pick.name; S.tariff=pick.tariff; S.petrol=pick.petrol; $('#tariffView').textContent=S.tariff.toFixed(1); $('#petrolIn').value=S.petrol; compute(); }
  };
  $('#petrolIn').value = S.petrol;
  $('#petrolIn').oninput = ()=>{ S.petrol = +$('#petrolIn').value || 0; compute(); };
}

/* ===== Calculator wiring ===== */
const overlay=$('#overlay'); const aiPanel=$('#aiPanel');
const perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'), kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce');
const monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair');
const barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY');
const gProg=$('#gProg'), gLabel=$('#gLabel'), gSub=$('#gSub'), modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit');

$('#tab-cars').onclick = ()=>{ S.tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList(); };
$('#tab-scooters').onclick = ()=>{ S.tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList(); };
$('#q').oninput = renderList;

$('#kmRange').oninput = ()=>{
  S.kmPerDay = +$('#kmRange').value; $('#kmVal').textContent = S.kmPerDay;
  kmNoteEv.textContent=`For ${S.kmPerDay} km/day`; kmNoteIce.textContent=`For ${S.kmPerDay} km/day`; compute();
};
$('#daysRange').oninput = ()=>{
  S.daysPerMonth = +$('#daysRange').value; $('#daysBadge').textContent = `${S.daysPerMonth} days`; compute();
};

$('#infoBtn').onclick = ()=> openInfo('calc');
$('#emiBtn').onclick = ()=> openTools();
$('#closeBtn').onclick = closeAll;
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAll(); });
overlay.addEventListener('click',e=>{ if(e.target===overlay) closeAll(); });

/* Model switcher in calc */
$('#prevModel').onclick = ()=> switchRel(-1);
$('#nextModel').onclick = ()=> switchRel(1);
$('#modelSwitcher').onchange = ()=>{
  const id = $('#modelSwitcher').value;
  const m = S.list.find(x=>x.id===id) || DATA().find(x=>x.id===id);
  if (m) openCalc(m,true);
};

function switchRel(dir){
  if (!S.selected) return;
  const L = DATA(); const i = L.findIndex(x=>x.id===S.selected.id);
  const j = (i+dir+L.length)%L.length; openCalc(L[j], true);
}

function openCalc(m, keepOpen=false){
  S.selected = m;
  // header model indicator & selector list
  $('#headerModel').textContent = `${m.brand} ${m.model}`;
  const listForSwitch = DATA();
  const ms = $('#modelSwitcher'); ms.innerHTML = listForSwitch.map(x=>`<option value="${x.id}">${x.brand} ${x.model}</option>`).join('');
  ms.value = m.id;

  // right rail
  modelName.textContent = `${m.brand} ${m.model}`;
  modelInfo.textContent = `${m.segment} • est. range ${m.range_km||'—'} km`;

  // reset AI panel for new model
  aiPanel.style.display='none'; aiPanel.className=''; $('#aiVerdict').textContent='AI analysis'; $('#aiReasons').innerHTML=''; $('#aiAlt').textContent=''; window.__aiShareLine='';

  // defaults in controls
  $('#kmRange').value = S.kmPerDay; $('#kmVal').textContent = S.kmPerDay;
  $('#daysRange').value = S.daysPerMonth; $('#daysBadge').textContent = `${S.daysPerMonth} days`;
  $('#tariffView').textContent = S.tariff.toFixed(1);
  $('#petrolIn').value = S.petrol;

  compute();

  if (!keepOpen){
    closeAll(); overlay.classList.add('show'); document.documentElement.style.overflow='hidden';
  }
}

function closeAll(){
  ['overlay','compareOverlay','shareOverlay','toolsOverlay','infoOverlay'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.classList.remove('show');
  });
  document.documentElement.style.overflow='auto';
}

/* Compute & update UI */
function costFor(m, kmOverride){
  const km = kmOverride ?? S.kmPerDay;
  const evkm = ((m.eff_kwh_per_100km||15)/100)*(S.tariff)*1.12;
  const icekm = S.petrol / Math.max(1, KMPL(m.segment));
  const perDayE = evkm * km, perDayI = icekm * km;
  const mEV = perDayE * S.daysPerMonth, mICE = perDayI * S.daysPerMonth;
  return { km, perDayE, perDayI, mEV, mICE, evkm, icekm };
}

function compute(){
  if (!S.selected) return;
  const c = costFor(S.selected);
  perDayEv.textContent = inr(c.perDayE);
  perDayIce.textContent = inr(c.perDayI);
  kmNoteEv.textContent=`For ${c.km} km/day`; kmNoteIce.textContent=`For ${c.km} km/day`;

  monthlyPair.textContent = `EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`;
  yearlyPair.textContent = `EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;

  const totalM = Math.max(c.mEV,c.mICE,1); barEvM.style.width=(c.mEV/totalM*100)+'%'; barIceM.style.width=(c.mICE/totalM*100)+'%';
  const totalY = Math.max(c.mEV*12,c.mICE*12,1); barEvY.style.width=(c.mEV*12/totalY*100)+'%'; barIceY.style.width=(c.mICE*12/totalY*100)+'%';

  // legends for clarity
  $('#statMonthly .legend')?.remove();
  $('#statYearly .legend')?.remove();
  const lgM = document.createElement('div'); lgM.className='legend';
  lgM.innerHTML = `<span class="dot" style="background:#16a34a"></span> EV  <span class="dot" style="background:#ea580c;margin-left:12px"></span> Petrol`;
  $('#statMonthly').insertBefore(lgM, $('#statMonthly').firstChild);
  const lgY = lgM.cloneNode(true); $('#statYearly').insertBefore(lgY, $('#statYearly').firstChild);

  // gauge
  const save = Math.max(0, c.mICE - c.mEV); const pct = (c.mICE>0)? Math.round((save/c.mICE)*100):0;
  const circ=2*Math.PI*50; const prog = clamp(pct,0,100)/100;
  gProg.setAttribute('stroke-dasharray', (circ*prog)+' '+(circ-circ*prog));
  gProg.setAttribute('stroke', pct<10? '#f59e0b' : '#16a34a');
  gLabel.setAttribute('y','64'); gLabel.textContent = pct+'%';
  gSub.setAttribute('y','90'); gSub.textContent = 'Savings vs petrol';
  $('#saveMonth').textContent = inr(save);
  goodFit.style.display = (pct>=20 && save>1500)?'inline-flex':'none';

  // cache for share & EMI
  window.__calcCache = { ...c, monthlySavings: save };
}

/* ===== AI (frontend fallback only for now; backend later) ===== */
$('#aiBtn').addEventListener('click', runAiQuick);
function runAiQuick(){
  if(!S.selected) return;
  aiPanel.style.display='block'; aiPanel.className=''; $('#aiVerdict').textContent='Analyzing…'; $('#aiReasons').innerHTML=''; $('#aiAlt').textContent='';
  const c = window.__calcCache || costFor(S.selected);
  // Deterministic, so button isn't “dead” even before we add the server
  const reasons = [
    `In ${S.city}, EV/day ${inr(c.perDayE)} vs Petrol/day ${inr(c.perDayI)}.`,
    `Monthly savings ~ ${inr(c.mICE - c.mEV)} at ${S.kmPerDay} km/day, ${S.daysPerMonth} days/mo.`
  ];
  $('#aiVerdict').textContent = '✅ Quick check';
  $('#aiReasons').innerHTML = '<ul class="small" style="margin:6px 0 0 18px">'+reasons.map(r=>`<li>${r}</li>`).join('')+'</ul>';
  $('#aiAlt').textContent = '';
  window.__aiShareLine = `In ${S.city}, EV saves ~ ${inr(c.mICE - c.mEV)}/mo at ${S.kmPerDay} km/day.`;
}

/* ===== Share modal ===== */
const shareOv=$('#shareOverlay'), shareCv=$('#shareCanvas'), sctx=shareCv.getContext('2d');
$('#shareBtn').onclick = ()=> openShare();
$('#openShare').onclick = ()=> openShare();
$('#shareClose').onclick = closeAll;
$('#openNew').onclick = ()=> shareCv.toBlob(b=>{ if(!b)return; const u=URL.createObjectURL(b); window.open(u,'_blank'); setTimeout(()=>URL.revokeObjectURL(u),4000); },'image/png');
$('#dlPng').onclick = ()=>{
  shareCv.toBlob(b=>{
    if(!b){alert('Could not render image');return;}
    const url=URL.createObjectURL(b); const a=document.createElement('a');
    a.href=url; a.download='EV-Cost-Card.png'; document.body.appendChild(a); a.click();
    setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},600);
  },'image/png');
};
$('#copyB64').onclick = ()=>{ const b64=shareCv.toDataURL('image/png'); (navigator.clipboard?.writeText? navigator.clipboard.writeText(b64).then(()=>alert('Base64 copied ✅')) : (prompt('Copy this Base64:', b64))); };

function openShare(){ if(!S.selected){alert('Pick a model first');return;} closeAll(); shareOv.classList.add('show'); document.documentElement.style.overflow='hidden'; drawShare(); }

function drawShare(){
  const m = S.selected; if(!m) return; const c = window.__calcCache || costFor(m);
  const W=1080,H=1920; sctx.clearRect(0,0,W,H);
  // bg
  const g1=sctx.createLinearGradient(0,0,0,H); g1.addColorStop(0,'#0b1220'); g1.addColorStop(1,'#0a0f1a'); sctx.fillStyle=g1; sctx.fillRect(0,0,W,H);

  // header
  sctx.fillStyle='#e2e8f0'; sctx.font='700 26px Inter, system-ui'; sctx.fillText('EV Cost Advisor — India', 56, 80);

  // model
  sctx.fillStyle='#ffffff'; sctx.font='900 64px Inter, system-ui';
  const title = `${m.brand} ${m.model}`; const tw=sctx.measureText(title).width;
  sctx.fillText(title, (W-tw)/2, 240);

  // subline
  sctx.fillStyle='#93c5fd'; sctx.font='26px Inter, system-ui';
  const sub=`${m.segment} · ${S.kmPerDay} km/day · ${S.daysPerMonth} days/mo · Petrol ₹${Math.round(S.petrol)}/L · ${S.city}`;
  const sw=sctx.measureText(sub).width; sctx.fillText(sub,(W-sw)/2, 288);

  // tiles
  const tile=(y,color,label,value)=>{ sctx.save(); sctx.translate(56,y);
    sctx.fillStyle=color; roundRect(sctx,0,0,W-112,210,26,true,false);
    const sh=sctx.createLinearGradient(0,0,W-112,0); sh.addColorStop(0,'rgba(255,255,255,.06)'); sh.addColorStop(.3,'rgba(255,255,255,0)'); sctx.fillStyle=sh; roundRect(sctx,0,0,W-112,210,26,true,false);
    sctx.fillStyle='rgba(255,255,255,.9)'; sctx.font='18px Inter, system-ui'; sctx.fillText(label.toUpperCase(),24,48);
    sctx.fillStyle='#fff'; sctx.font='900 64px Inter, system-ui'; sctx.fillText(value,24,132); sctx.restore();
  };
  function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke(); }

  tile(360,'#059669','Cost per day (EV)', inr(c.perDayE));
  tile(610,'#ea580c','Cost per day (Petrol)', inr(c.perDayI));

  // monthly lines
  sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly running cost',56, 880);
  sctx.fillStyle='#a7f3d0'; sctx.font='700 36px Inter, system-ui'; sctx.fillText(`EV ${inr(c.mEV)}  •  Petrol ${inr(c.mICE)}`,56, 924);

  sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly savings',56, 980);
  sctx.fillStyle='#a7f3d0'; sctx.font='900 54px Inter, system-ui'; sctx.fillText(inr(c.mICE - c.mEV),56, 1036);

  // AI share line (wrapped)
  const line = $('#aiAddShare').checked ? (window.__aiShareLine||'') : '';
  if (line) {
    sctx.fillStyle='#d1fae5'; sctx.font='28px Inter, system-ui';
    const maxW = W-112; wrapText(sctx, line, 56, 1110, maxW, 34);
  }

  sctx.fillStyle='#94a3b8'; sctx.font='24px Inter, system-ui';
  sctx.fillText('evcost.in • shareable',56,H-72);
  sctx.fillText('© '+(new Date().getFullYear())+' EV Cost Advisor',W-56-420,H-72);
}

/* ===== EMI / Tools modal ===== */
const toolsOv=$('#toolsOverlay');
$('#toolsClose').onclick = closeAll;
$('#toolsInfo').onclick = ()=> openInfo('emi');
$('#shareEmi').onclick = ()=>{ closeAll(); openShare(); };

function openTools(){
  if(!S.selected){alert('Pick a model first');return;}
  closeAll(); toolsOv.classList.add('show'); document.documentElement.style.overflow='hidden';
  fillTools();
}

function emiCalc(P, annualRatePct, months){ const r=(annualRatePct/100)/12; if(months<=0) return 0; if(r===0) return P/months; const a=Math.pow(1+r,months); return P*r*a/(a-1); }
function fillTools(){
  const c=window.__calcCache||costFor(S.selected);
  $('#lsKm').textContent=Math.round((S.kmPerDay||0)*(S.daysPerMonth||0));
  $('#lsKmpl').textContent=(KMPL(S.selected.segment)||15)+" km/L";
  const litres=(S.kmPerDay*S.daysPerMonth)/Math.max(1,KMPL(S.selected.segment));
  $('#lsLitres').textContent=(Math.round(litres*10)/10)+" L";

  const amt=$('#emiAmount'), rate=$('#emiRate'), mon=$('#emiMonths');
  if(!amt.value) amt.value=500000; if(!rate.value) rate.value='9.5'; if(!mon.value) mon.value=60;
  const update=()=>{
    const emi=emiCalc(parseFloat(amt.value||0), parseFloat(rate.value||0), parseInt(mon.value||0));
    const cover=(c.monthlySavings>0&&emi>0)?Math.max(0,Math.min(100,Math.round(c.monthlySavings/emi*100))):0;
    $('#emiOut').textContent=inr(emi); $('#savingsOut').textContent=inr(c.monthlySavings||0);
    const circ=2*Math.PI*50; const prog=cover/100; $('#emiProg').setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog)); $('#emiLabel').textContent=cover+'%';
  };
  ['input','change'].forEach(ev=>{ amt.addEventListener(ev,update); rate.addEventListener(ev,update); mon.addEventListener(ev,update); });
  update();
}

/* ===== Info modal ===== */
const infoOv=$('#infoOverlay'), infoContent=$('#infoContent'), infoTitle=$('#infoTitle'), infoClose=$('#infoClose');
infoClose.onclick = closeAll;
function openInfo(which){
  if(which==='emi'){
    infoTitle.textContent='EMI helper — What it means';
    infoContent.innerHTML=`<div class="bold">What is EMI coverage?</div>
    <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV.</div>
    <ul class="small"><li>EMI uses standard amortization.</li><li>Fuel savings = Petrol monthly cost − EV monthly cost.</li></ul>`;
  } else {
    infoTitle.textContent='How costs are calculated';
    infoContent.innerHTML=`<ul class="small"><li><b>EV ₹/km</b> = (kWh/100km ÷ 100) × tariff × 1.12.</li><li><b>Petrol ₹/km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li><li>Monthly = Per-day × days/month.</li></ul>`;
  }
  closeAll(); infoOv.classList.add('show'); document.documentElement.style.overflow='hidden';
}

/* ===== Compare modal ===== */
const cmpOv=$('#compareOverlay'), cmpTrack=$('#cmpTrack');
$('#compareBtn').onclick = ()=> openCompare();
$('#cmpClose').onclick = closeAll;
$('#cmpPrev').onclick = ()=> cmpSlide(-1);
$('#cmpNext').onclick = ()=> cmpSlide(1);

function openCompare(){
  if(!S.selected){alert('Pick a model first');return;}
  closeAll(); cmpOv.classList.add('show'); document.documentElement.style.overflow='hidden';
  // km/day buttons
  renderCmpHead();
  buildPeers();
  renderCmp();
}

function renderCmpHead(){
  // Build header KM buttons dynamically
  const head = cmpOv.querySelector('.modal-head');
  let row = head.querySelector('.cmpHeadRow');
  if (!row){
    row = document.createElement('div'); row.className='cmpHeadRow';
    const kmWrap=document.createElement('div'); kmWrap.className='cmpKmBtns';
    kmWrap.id='cmpKmBtns';
    [20,40,60,80,150].forEach(v=>{
      const b=document.createElement('button'); b.className='btn'; b.textContent=`${v} km/day`; b.dataset.km=v;
      b.onclick=()=>{ S.cmpKm = v; highlightCmpKm(); renderCmp(); };
      kmWrap.appendChild(b);
    });
    const meta=document.createElement('div'); meta.className='cmpMeta'; meta.id='cmpMeta';
    meta.textContent = `Days/mo: ${S.daysPerMonth}`;
    row.appendChild(kmWrap); row.appendChild(meta);
    head.insertBefore(row, head.firstChild.nextSibling);
  }
  highlightCmpKm();
}

function highlightCmpKm(){
  $$('#cmpKmBtns .btn').forEach(b=> b.classList.toggle('active', +b.dataset.km===S.cmpKm));
}

let peers = [];
function buildPeers(){
  const all = DATA();
  const sel = S.selected;
  const band = sel.price_lakh;
  peers = all
    .filter(x=> x.id!==sel.id && (S.tab==='cars' ? x.segment!== 'Scooter' : x.segment==='Scooter'))
    .filter(x=> x.segment===sel.segment || true)
    .filter(x=> Math.abs((x.price_lakh||0)-(band||0)) <= (band||0)*0.2 )
    .sort((a,b)=>{
      const ca = costFor(a, S.cmpKm), cb = costFor(b, S.cmpKm);
      return (ca.mEV - cb.mEV);
    });
  if (!peers.length) peers = all.filter(x=>x.id!==sel.id).slice(0,6);
  S.cmpIndex = 0;
}

function renderCmp(){
  cmpTrack.innerHTML='';
  const cardW = Math.min(320, Math.max(280, Math.floor((window.innerWidth-200)/3)));
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
  // show 3 on desktop, 1 on mobile
  const perView = window.innerWidth>=1024? 3 : 1;
  const maxIndex = Math.max(0, peers.length - perView);
  S.cmpIndex = clamp(S.cmpIndex + dir, 0, maxIndex);
  applyCmpTransform();
}
function applyCmpTransform(){
  const card = cmpTrack.querySelector('.cmpCard');
  const perView = window.innerWidth>=1024? 3 : 1;
  const cardWidth = card ? card.getBoundingClientRect().width : 300;
  const gap = 16;
  const shift = (cardWidth+gap) * S.cmpIndex;
  cmpTrack.style.transform = `translateX(${-shift}px)`;
}

/* ===== Boot ===== */
(function boot(){
  renderList();
  initCities();
})();
