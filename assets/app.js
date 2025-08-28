/* Utilities */
const $=s=>document.querySelector(s);
const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const inr=n=>(!isFinite(n)||n===Infinity)?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n));
function disableScroll(on){ document.documentElement.style.overflow = on ? "hidden" : "auto"; }

function openOverlay(id){ closeAll(); $(id).classList.add('show'); disableScroll(true); }
function closeOverlay(id){ $(id).classList.remove('show'); disableScroll(false); }
function closeAll(){ ['overlay','compareOverlay','shareOverlay','toolsOverlay','infoOverlay'].forEach(id=>$( '#'+id ).classList.remove('show')); disableScroll(false); }

/* State */
let tab='cars', q='', active=null, cmpIndex=0;

/* Scenario getters */
const getCity = ()=> CITY_PRESETS.find(x=>x.id === $('#citySel').value) || CITY_PRESETS[0];
function getScenario(){
  const city=getCity();
  return {
    id: active?.id || '',
    kmPerDay: parseInt($('#kmRange').value||'20',10),
    daysPerMonth: parseInt($('#daysRange').value||'26',10),
    petrolPerL: parseFloat($('#petrolIn').value||'100'),
    tariff: parseFloat(city?.tariff||7),
    segment: active?.segment || '',
    type: tab === 'cars' ? 'car' : 'scooter'
  };
}

/* Costs */
function evPerKm(model, tariff){ return (model.eff_kwh_per_100km/100)*tariff*1.12; }
function icePerKm(model, petrol){ const kmpl = BENCH_KMPL[model.segment] ?? 15; return petrol/Math.max(1,kmpl); }
function computeCosts(model, scenario){
  const evKm = evPerKm(model, scenario.tariff);
  const iceKm = icePerKm(model, scenario.petrolPerL);
  const perDayEV = evKm * scenario.kmPerDay;
  const perDayICE = iceKm * scenario.kmPerDay;
  const mEV = perDayEV * scenario.daysPerMonth;
  const mICE = perDayICE * scenario.daysPerMonth;
  return {evKm,iceKm,perDayEV,perDayICE,mEV,mICE};
}

/* List rendering */
function DATA(){ return tab==='cars'?MODELS_CARS:MODELS_SCOOTERS; }
function renderList(){
  const items=DATA().filter(m=>{
    if(!q)return true; const s=(m.brand+" "+m.model+" "+m.segment).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  $('#resultCount').textContent = `${items.length} result${items.length===1?'':'s'}`;

  const grid=$('#grid'); grid.innerHTML='';
  items.forEach(m=>{
    const card=document.createElement('button'); card.className='card';
    const t1=document.createElement('div'); t1.className='bold'; t1.style.fontSize='18px'; t1.textContent=`${m.brand} ${m.model}`;
    const t2=document.createElement('div'); t2.className='small muted mt8'; t2.textContent=`${m.segment} • ${m.range_km} km est. range`;
    const t3=document.createElement('div'); t3.className='small mt8'; t3.innerHTML=`<span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span>`;
    card.append(t1,t2,t3);
    card.addEventListener('click',()=>openCalc(m));
    grid.appendChild(card);
  });
}

/* Calculator modal */
const overlay=$('#overlay');
const citySel=$('#citySel'), tariffView=$('#tariffView'), petrolIn=$('#petrolIn'),
      kmR=$('#kmRange'), kmVal=$('#kmVal'), daysR=$('#daysRange'), daysBadge=$('#daysBadge');

const perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'), kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce');
const monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair'), saveMonth=$('#saveMonth');
const barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY');
const gProg=$('#gProg'), gLabel=$('#gLabel');
const modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit');
const modelSwitcher=$('#modelSwitcher');

function initCities(){
  citySel.innerHTML = CITY_PRESETS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const ggn = CITY_PRESETS.find(x=>x.name==="Gurugram")?.id || CITY_PRESETS[0].id;
  citySel.value = ggn;
  tariffView.textContent = (getCity().tariff||7).toFixed(1);
}
function fillSwitcher(list, selectedId){
  modelSwitcher.innerHTML = list.map(m=>`<option value="${m.id}">${m.brand} ${m.model}</option>`).join('');
  modelSwitcher.value = selectedId;
}

function openCalc(m){
  active=m;
  const list = DATA(); fillSwitcher(list, m.id);
  modelName.textContent=`${m.brand} ${m.model}`;
  modelInfo.textContent=`${m.segment} • ${m.range_km} km est. range`;

  // defaults
  tariffView.textContent=(getCity().tariff||7).toFixed(1);
  petrolIn.value=petrolIn.value||100;
  kmR.value=kmR.value||20; kmVal.textContent=kmR.value;
  daysR.value=daysR.value||26; daysBadge.textContent=daysR.value+' days';

  computeAndRender();
  openOverlay('#overlay');
}

function computeAndRender(){
  if(!active) return;
  const sc = getScenario();
  const c = computeCosts(active, sc);

  perDayEv.textContent = inr(c.perDayEV); perDayIce.textContent = inr(c.perDayICE);
  kmNoteEv.textContent=`For ${sc.kmPerDay} km/day`; kmNoteIce.textContent=`For ${sc.kmPerDay} km/day`;

  monthlyPair.textContent=`EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`;
  yearlyPair.textContent=`EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;

  const totalM=Math.max(c.mEV,c.mICE,1);
  barEvM.style.width=(c.mEV/totalM*100)+'%'; barIceM.style.width=(c.mICE/totalM*100)+'%';
  const totalY=Math.max(c.mEV*12,c.mICE*12,1);
  barEvY.style.width=(c.mEV*12/totalY*100)+'%'; barIceY.style.width=(c.mICE*12/totalY*100)+'%';

  let pct = (c.perDayICE>0)?((c.perDayICE-c.perDayEV)/c.perDayICE)*100:0;
  pct = Math.round(Math.max(-100,Math.min(100,pct)));

  // Donut sweep (circumference r=46 => 2πr ≈ 289)
  const circ = 2*Math.PI*46;
  const prog = Math.max(0, Math.min(1, pct/100));
  gProg.style.transition = 'stroke-dasharray .6s ease';
  gProg.setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog));
  gLabel.textContent = (isFinite(pct)?pct:0)+'%';

  const monthlySavings = Math.max(0, c.mICE - c.mEV);
  saveMonth.textContent = inr(monthlySavings);
  goodFit.style.display = (pct>=20 && monthlySavings>1500)?'inline-flex':'none';

  // cache for EMI/share/compare
  window.__calcCache = {...sc, ...c, monthlySavings};
}

/* Events wiring */
$('#tab-cars').addEventListener('click',()=>{tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList();});
$('#tab-scooters').addEventListener('click',()=>{tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList();});
$('#q').addEventListener('input',e=>{q=e.target.value; renderList();});

$('#closeBtn').addEventListener('click',()=>closeOverlay('#overlay'));
$('#infoBtn').addEventListener('click',()=>openInfo('calc'));
$('#shareBtn').addEventListener('click',()=>openShare('cost'));
$('#shareClose').addEventListener('click',()=>closeOverlay('#shareOverlay'));
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAll(); });

citySel.addEventListener('change',()=>{tariffView.textContent=(getCity().tariff||7).toFixed(1); computeAndRender();});
petrolIn.addEventListener('input',computeAndRender);
kmR.addEventListener('input',()=>{kmVal.textContent=kmR.value; computeAndRender();});
daysR.addEventListener('input',()=>{daysBadge.textContent=daysR.value+' days'; computeAndRender();});

$('#prevModel').addEventListener('click',()=>{
  const list=DATA(); let i=list.findIndex(x=>x.id===active.id); i=(i-1+list.length)%list.length; openCalc(list[i]);
});
$('#nextModel').addEventListener('click',()=>{
  const list=DATA(); let i=list.findIndex(x=>x.id===active.id); i=(i+1)%list.length; openCalc(list[i]);
});
modelSwitcher.addEventListener('change',()=>{
  const list=DATA(); const m=list.find(x=>x.id===modelSwitcher.value); if(m) openCalc(m);
});

/* Info modal */
function openInfo(which){
  const infoOv=$('#infoOverlay'), infoContent=$('#infoContent'), title=$('#infoTitle');
  if(which==='emi'){
    title.textContent='EMI helper — What it means';
    infoContent.innerHTML=`<div class="bold">What is EMI coverage?</div>
      <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV. If savings are ₹8,000 and EMI is ₹12,000, coverage ≈ 67%.</div>
      <div class="mt16 bold">How we compute</div>
      <ul class="small"><li>EMI uses standard amortization with Amount, Interest %, Months.</li><li>Savings = Petrol monthly cost − EV monthly cost.</li></ul>`;
  } else {
    title.textContent='How costs are calculated';
    infoContent.innerHTML=`<div class="bold">Simple & transparent</div>
      <ul class="small">
        <li><b>EV ₹/km</b> = (kWh/100km ÷ 100) × tariff × 1.12 (GST approx).</li>
        <li><b>Petrol ₹/km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li>
        <li>Monthly = Per-day × days/month (<b>26</b> default, adjustable).</li>
        <li>City presets set tariff & petrol automatically (you can edit petrol).</li>
      </ul>`;
  }
  openOverlay('#infoOverlay');
}
$('#infoClose').addEventListener('click',()=>closeOverlay('#infoOverlay'));

/* Share (kept minimal – same as before, uses cached numbers) */
function openShare(mode){ openOverlay('#shareOverlay'); drawShare(mode||'cost'); }
$('#openNew').addEventListener('click',()=>{ const cv=$('#shareCanvas'); cv.toBlob(b=>{ if(!b)return; const url=URL.createObjectURL(b); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),4000);},'image/png');});
$('#copyB64').addEventListener('click',()=>{ const b64=$('#shareCanvas').toDataURL('image/png'); (navigator.clipboard?.writeText?navigator.clipboard.writeText(b64):Promise.reject()).catch(()=>{});});
$('#dlPng').addEventListener('click',()=>{
  const cv=$('#shareCanvas'); cv.toBlob(b=>{ if(!b){alert('Could not render image');return;}
    const url=URL.createObjectURL(b); const a=document.createElement('a'); a.href=url; a.download="EV-Cost-Card-Mobile.png";
    document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},600);
  },'image/png');
});
function drawShare(){ const s=window.__calcCache||{}; const ctx=$('#shareCanvas').getContext('2d'); const W=1080,H=1920; ctx.clearRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0b1220'); g.addColorStop(1,'#0a0f1a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#d1fae5'; ctx.font='bold 58px Inter, system-ui'; const title=(active?`${active.brand} ${active.model}`:'EV Cost'); const tw=ctx.measureText(title).width; ctx.fillText(title,(W-tw)/2,240);
  ctx.fillStyle='#a7f3d0'; ctx.font='28px Inter, system-ui'; ctx.fillText(`${s.kmPerDay||0} km/day • ${s.daysPerMonth||0} days/mo • Petrol ₹${Math.round(s.petrolPerL||0)}/L`,(W-760)/2,300);
  const tile=(y,color,label,val)=>{ ctx.save(); ctx.translate(80,y); ctx.fillStyle=color; roundRect(ctx,0,0,W-160,210,26,true,false);
    ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='18px Inter'; ctx.fillText(label.toUpperCase(),26,46); ctx.fillStyle='#fff'; ctx.font='900 64px Inter'; ctx.fillText(val,26,130); ctx.restore();};
  function roundRect(ctx,x,y,w,h,r,fill){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); }
  tile(380,'#059669','Per-day (EV)', inr(s.perDayEV||0)); tile(630,'#dc2626','Per-day (Petrol)', inr(s.perDayICE||0));
  ctx.fillStyle='#cbd5e1'; ctx.font='28px Inter'; ctx.fillText('Monthly running cost',80,900);
  ctx.fillStyle='#a7f3d0'; ctx.font='700 40px Inter'; ctx.fillText(`EV ${inr(s.mEV||0)}  •  Petrol ${inr(s.mICE||0)}`,80,950);
}

/* EMI tools */
$('#toolsClose').addEventListener('click',()=>closeOverlay('#toolsOverlay'));
$('#toolsInfo').addEventListener('click',()=>openInfo('emi'));
$('#emiBtn').addEventListener('click',()=>{
  if(!active){alert('Pick a model first');return;}
  fillEMI(); openOverlay('#toolsOverlay');
});
$('#shareEmi').addEventListener('click',()=>{ closeOverlay('#toolsOverlay'); openShare('emi'); });

function emiCalc(P, annualRatePct, months){ const r=(annualRatePct/100)/12; if(months<=0) return 0; if(r===0) return P/months; const a=Math.pow(1+r,months); return P*r*a/(a-1); }
function fillEMI(){
  const c=window.__calcCache||{}; const monthlyKm=c.kmPerDay*c.daysPerMonth||0; const kmpl=BENCH_KMPL[active.segment]||15;
  $('#lsKm').textContent=Math.round(monthlyKm); $('#lsKmpl').textContent=kmpl+" km/L"; $('#lsLitres').textContent=(Math.round((monthlyKm/kmpl)*10)/10)+" L";

  const amt=$('#emiAmount'), rate=$('#emiRate'), mon=$('#emiMonths');
  if(!amt.value) amt.value=500000; if(!rate.value) rate.value='9.5'; if(!mon.value) mon.value=60;
  const update=()=>{
    const emi=emiCalc(parseFloat(amt.value||0), parseFloat(rate.value||0), parseInt(mon.value||0));
    const cover = (c.monthlySavings>0 && emi>0) ? Math.max(0, Math.min(100, Math.round(c.monthlySavings/emi*100))) : 0;
    $('#emiOut').textContent=inr(emi); $('#savingsOut').textContent=inr(c.monthlySavings||0);
    const circ=2*Math.PI*50; const prog=cover/100; $('#emiProg').setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog)); $('#emiLabel').textContent=cover+'%';
  };
  ['input','change'].forEach(ev=>{ amt.addEventListener(ev,update); rate.addEventListener(ev,update); mon.addEventListener(ev,update); });
  update();
}

/* AI — deterministic, with sanity guards (no cars↔scooters, ±20% price, same segment pref) */
$('#aiBtn').addEventListener('click', runAiQuick);
function runAiQuick(){
  if(!active){alert('Pick a model first');return;}
  const sc=getScenario(); const models=[...MODELS_CARS, ...MODELS_SCOOTERS];
  const ai=localAi(sc,models); applyAi(ai,models);
}
function applyAi(ai, models){
  const verdict=ai.verdict||'best_pick'; const reasons=(ai.reasons||[]).slice(0,3); const altId=ai.alt_model_id||'';
  const aiPanel=$('#aiPanel'); const aiVerdict=$('#aiVerdict'), aiReasons=$('#aiReasons'), aiAlt=$('#aiAlt');
  aiVerdict.textContent = verdict==='best_pick' ? '✅ Best pick' : '👉 Try an alternative';
  aiPanel.className = verdict==='best_pick' ? 'good stat' : 'stat try';
  aiPanel.style.display='block';
  aiReasons.innerHTML = '<ul class="small" style="margin:6px 0 0 18px">'+reasons.map(r=>`<li>${r}</li>`).join('')+'</ul>';
  aiAlt.textContent = '';
  if(verdict==='try_alternative' && altId){
    const alt=models.find(m=>m.id===altId); aiAlt.textContent = alt ? `Suggestion: ${alt.brand} ${alt.model}` : '';
  }
}

function localAi(scenario, models){
  const pool = scenario.type==='car' ? MODELS_CARS : MODELS_SCOOTERS; // no mixing
  const sel = pool.find(m=>m.id===scenario.id) || pool[0];
  const priceBand = [sel.price_lakh*0.8, sel.price_lakh*1.2];
  const peers1 = pool.filter(x=>x.id!==sel.id && x.segment===sel.segment && x.price_lakh>=priceBand[0] && x.price_lakh<=priceBand[1]);
  const peers = (peers1.length?peers1:pool.filter(x=>x.id!==sel.id)).map(m=>{
    const cost=computeCosts(m, scenario); return {id:m.id, monthlyEV:cost.mEV, brand:m.brand, model:m.model};
  }).sort((a,b)=>a.monthlyEV-b.monthlyEV);
  const selectedCost = computeCosts(sel, scenario).mEV;
  const better = peers.find(p=>p.monthlyEV < selectedCost);
  return {
    verdict: better? 'try_alternative' : 'best_pick',
    alt_model_id: better? better.id : '',
    reasons: better? ['Lower monthly EV cost in same price band/segment'] : ['Your pick has strong monthly savings vs petrol'],
    share_line: better? `Try ${better.brand} ${better.model}: lower monthly EV cost` : `Best pick: good monthly savings`
  };
}

/* Compare modal */
$('#compareBtn').addEventListener('click', openCompare);
$('#cmpClose').addEventListener('click',()=>closeOverlay('#compareOverlay'));
$('#cmpPrev').addEventListener('click',()=>shiftCompare(-1));
$('#cmpNext').addEventListener('click',()=>shiftCompare(1));

function openCompare(){
  if(!active){alert('Pick a model first');return;}
  const sc=getScenario();
  $('#cmpScenario').textContent = `${sc.kmPerDay} km/day • ${sc.daysPerMonth} days/mo • Petrol ₹${Math.round(sc.petrolPerL)} /L • Tariff ₹${sc.tariff.toFixed(1)}/kWh`;
  buildCompare(sc); openOverlay('#compareOverlay');
  cmpIndex=0;
}

function buildCompare(sc){
  const track=$('#cmpTrack'); track.innerHTML='';
  const base = active;
  const typePool = (tab==='cars'?MODELS_CARS:MODELS_SCOOTERS);
  const priceBand=[base.price_lakh*0.8, base.price_lakh*1.2];
  let peers = typePool.filter(x=>x.id!==base.id && x.segment===base.segment && x.price_lakh>=priceBand[0] && x.price_lakh<=priceBand[1]);
  if(!peers.length) peers = typePool.filter(x=>x.id!==base.id);
  peers = peers
    .map(m=>({model:m, cost:computeCosts(m,sc)}))
    .sort((a,b)=>a.cost.mEV - b.cost.mEV)
    .slice(0,6);

  // First card = baseline
  track.appendChild(makeCmpCard(base, computeCosts(base, sc), true, sc));
  // Peer cards
  peers.forEach((p,i)=>track.appendChild(makeCmpCard(p.model, p.cost, false, sc, i)));
}

function makeCmpCard(m, c, isBase, sc, idx=0){
  const card=document.createElement('div'); card.className='cmpCard'; card.style.animationDelay=(idx*60)+'ms';
  const head=document.createElement('div'); head.innerHTML=`
    <div class="small muted">${isBase?'Baseline':'Peer'}</div>
    <div class="title">${m.brand} ${m.model}</div>
    <div class="small muted">${m.segment} • ${m.range_km} km est. range</div>
  `;

  const pills=document.createElement('div'); pills.className='cmpPills';
  const pillEv=document.createElement('div'); pillEv.className='cmpPill ev'; pillEv.innerHTML=`PER-DAY (EV)<br><span class="tabnums" style="font-size:28px">${inr(c.perDayEV)}</span>`;
  const pillIce=document.createElement('div'); pillIce.className='cmpPill ice'; pillIce.innerHTML=`PER-DAY (PETROL)<br><span class="tabnums" style="font-size:28px">${inr(c.perDayICE)}</span>`;
  pills.append(pillEv,pillIce);

  const month=document.createElement('div'); month.className='cmpStat small'; month.innerHTML=`<div class="row"><span>Monthly running cost</span><span class="tabnums">EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}</span></div>`;
  const saveLine=document.createElement('div'); saveLine.className='cmpStat small'; const baseCost=computeCosts(active, sc);
  const delta = (isBase)?0:(baseCost.mEV - c.mEV);
  saveLine.textContent = isBase ? '' : (delta>0 ? `Saves ${inr(delta)} /mo vs baseline` : `—`);

  const btns=document.createElement('div'); btns.className='cmpBtns';
  const setBtn=document.createElement('button'); setBtn.className='button'; setBtn.textContent=isBase?'Open calculator':'Set as baseline';
  setBtn.addEventListener('click',()=>{
    if(isBase){ openCalc(m); closeOverlay('#compareOverlay'); }
    else{ active = m; openCompare(); } // re-open with new baseline
  });
  const openBtn=document.createElement('button'); openBtn.className='button'; openBtn.textContent='Open calculator';
  openBtn.addEventListener('click',()=>{ openCalc(m); closeOverlay('#compareOverlay'); });
  btns.append(setBtn, openBtn);

  card.append(head,pills,month,saveLine,btns);
  return card;
}

function shiftCompare(dir){
  const track=$('#cmpTrack'); const cards=$$('.cmpCard', track); if(!cards.length) return;
  const perRow = Math.max(1, Math.floor(track.clientWidth / (cards[0].clientWidth+20)));
  const step = perRow; cmpIndex = Math.max(0, Math.min(cmpIndex + dir*step, Math.max(0, cards.length - perRow)));
  // simple scroll snap simulation
  const targetRow = cards[0].clientHeight + 20;
  track.scrollTo({left:0, top: Math.floor(cmpIndex/perRow)*targetRow, behavior:'smooth'});
}

/* Boot */
(function boot(){
  initCities(); renderList();
})();
