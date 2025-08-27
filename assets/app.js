(function(){
  /* ---------- Data (from assets/data.js) ---------- */
  if (!window.DATA) {
    console.warn('assets/data.js missing — using fallback dataset');
    window.DATA = {
      BENCH_KMPL: {"Hatchback":17,"SUV":14,"Scooter":50},
      MODELS_CARS: [{id:"tata-nexon-ev",brand:"Tata",model:"Nexon EV",price_lakh:12.49,segment:"SUV",eff_kwh_per_100km:16.0,range_km:489}],
      MODELS_SCOOTERS: [{id:"ola-s1-pro",brand:"Ola",model:"S1 Pro",price_lakh:1.36,segment:"Scooter",eff_kwh_per_100km:5.5,range_km:242}],
      CITY_PRESETS: [{id:"delhi",name:"Delhi",petrol:95,tariff:6.0}],
      IMG_MAP: {}
    };
  }
  const {BENCH_KMPL, MODELS_CARS, MODELS_SCOOTERS, CITY_PRESETS, IMG_MAP} = window.DATA;

  /* ---------- Utilities ---------- */
  const $    = s => document.querySelector(s);
  const $$   = (s, c=document) => Array.from(c.querySelectorAll(s));
  const INR  = n => (!isFinite(n)||n===Infinity)?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n||0));
  const clamp= (v,min,max)=>Math.max(min,Math.min(max,v));

  const state = {
    tab: 'cars',
    list: MODELS_CARS,
    q: '',
    active: null,
    dailyKm: 20,
    daysPerMonth: 26,
    petrol: 100,
    tariff: 7,
    cityId: (CITY_PRESETS[0]||{}).id || 'delhi',
    emiMonthly: 0,       // unified EMI/month for comparisons
    cmpIndex: 0,         // current slide index
    cmpPeers: []         // filled when opening Compare
  };

  function kmplBySeg(seg){ return BENCH_KMPL[seg] ?? 15; }
  function evPerKm(model){ return (model.eff_kwh_per_100km/100) * state.tariff * 1.12; }
  function icePerKm(model){ return state.petrol / Math.max(1, kmplBySeg(model.segment)); }
  function calcCost(model){
    const evkm = evPerKm(model);
    const icek = icePerKm(model);
    const perDayEV = evkm * state.dailyKm;
    const perDayICE= icek * state.dailyKm;
    const mEV = perDayEV * state.daysPerMonth;
    const mICE= perDayICE* state.daysPerMonth;
    return {perDayEV, perDayICE, mEV, mICE, save: Math.max(0, mICE - mEV), pct: (perDayICE>0)?((perDayICE-perDayEV)/perDayICE*100):0};
  }

  /* ---------- List (home) ---------- */
  const grid = $('#grid'), resultCount = $('#resultCount');
  function DATASET(){ return state.tab==='cars' ? MODELS_CARS : MODELS_SCOOTERS; }

  function renderList(){
    const items = DATASET().filter(m=>{
      if(!state.q) return true;
      const s = (m.brand+' '+m.model+' '+m.segment).toLowerCase();
      return s.includes(state.q.toLowerCase());
    });
    resultCount.textContent = `${items.length} result${items.length===1?'':'s'}`;
    grid.innerHTML = '';
    items.forEach(m=>{
      const card = document.createElement('button');
      card.className = 'card';
      const t1 = document.createElement('div'); t1.className='bold'; t1.style.fontSize='18px'; t1.textContent = `${m.brand} ${m.model}`;
      const t2 = document.createElement('div'); t2.className='small muted mt8'; t2.textContent = `${m.segment} • ${m.range_km} km est. range`;
      const t3 = document.createElement('div'); t3.className='small mt8'; t3.innerHTML = `<span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${INR((m.price_lakh||0)*100000)}</span>`;
      card.append(t1,t2,t3);
      card.addEventListener('click',()=>openCalc(m));
      grid.appendChild(card);
    });
  }

  /* ---------- Calculator overlay ---------- */
  const overlay = $('#overlay');
  function lockScroll(on){
    document.documentElement.style.overflow = on?'hidden':'auto';
  }
  function openOverlay(ov){
    $$('.overlay').forEach(o=>o.classList.remove('show'));
    ov.classList.add('show'); lockScroll(true);
  }
  function closeOverlay(){ $$('.overlay').forEach(o=>o.classList.remove('show')); lockScroll(false); }

  // ESC and backdrop close
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeOverlay(); });
  $$('.overlay').forEach(ov=>{
    ov.addEventListener('click', e=>{
      if(e.target===ov) closeOverlay();
    });
  });

  const citySel=$('#citySel'), tariffView=$('#tariffView'), petrolIn=$('#petrolIn'), kmR=$('#kmRange'), kmVal=$('#kmVal'), daysR=$('#daysRange'), daysBadge=$('#daysBadge');
  const perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'), kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce');
  const monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair'), saveMonth=$('#saveMonth');
  const barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY');
  const gProg=$('#gProg'), gLabel=$('#gLabel');
  const modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit');
  const modelPhoto=$('#modelPhoto');

  // model switcher inside calculator
  const modelSel=$('#modelSwitcher'), prevBtn=$('#prevModel'), nextBtn=$('#nextModel');

  function setCity(id){
    state.cityId=id;
    const c=CITY_PRESETS.find(x=>x.id===id); if(!c) return;
    state.tariff=c.tariff; state.petrol=c.petrol;
    tariffView.textContent=c.tariff.toFixed(1);
    petrolIn.value = Math.round(state.petrol);
    compute();
  }

  CITY_PRESETS.forEach(c=>{
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; citySel.appendChild(o);
  });

  function openCalc(m){
    state.active = m;
    state.list = DATASET();
    // default city
    const preferred = CITY_PRESETS.find(x=>x.id===state.cityId) || CITY_PRESETS[0];
    setCity(preferred.id);
    // sliders
    kmR.value=state.dailyKm; kmVal.textContent=String(state.dailyKm);
    daysR.value=state.daysPerMonth; daysBadge.textContent=state.daysPerMonth+' days';
    // model info
    modelName.textContent=`${m.brand} ${m.model}`;
    modelInfo.textContent=`${m.segment} • ${m.range_km} km est. range`;
    // photo (optional)
    const img = IMG_MAP[m.id];
    if(img){ modelPhoto.src = `assets/img/${img}`; modelPhoto.alt = `${m.brand} ${m.model}`; modelPhoto.style.display='block'; }
    else { modelPhoto.style.display='none'; }
    // switcher
    modelSel.innerHTML='';
    state.list.forEach(x=>{
      const o=document.createElement('option'); o.value=x.id; o.textContent=`${x.brand} ${x.model}`; modelSel.appendChild(o);
    });
    modelSel.value=m.id;
    openOverlay(overlay);
    compute();
  }

  $('#closeBtn').addEventListener('click',closeOverlay);
  $('#shareBtn').addEventListener('click',()=>openOverlay($('#shareOverlay')));
  $('#infoBtn').addEventListener('click',()=>openInfo('calc'));
  $('#emiBtn').addEventListener('click',()=>{ openOverlay($('#toolsOverlay')); fillTools(); });

  // Inputs
  citySel.addEventListener('change',()=>setCity(citySel.value));
  petrolIn.addEventListener('input',()=>{ state.petrol = +petrolIn.value||0; compute(); });
  kmR.addEventListener('input',()=>{ state.dailyKm=+kmR.value||0; kmVal.textContent=kmR.value; kmNoteEv.textContent=`For ${kmR.value} km/day`; kmNoteIce.textContent=`For ${kmR.value} km/day`; compute();});
  daysR.addEventListener('input',()=>{ state.daysPerMonth=+daysR.value||0; daysBadge.textContent=daysR.value+' days'; compute(); });

  // switch model
  modelSel.addEventListener('change',()=>{
    const m = state.list.find(x=>x.id===modelSel.value); if(m) openCalc(m);
  });
  function idxOfActive(){ return state.list.findIndex(x=>x.id===state.active.id); }
  prevBtn.addEventListener('click',()=>{
    const i = idxOfActive(); const j = (i-1+state.list.length)%state.list.length; openCalc(state.list[j]);
  });
  nextBtn.addEventListener('click',()=>{
    const i = idxOfActive(); const j = (i+1)%state.list.length; openCalc(state.list[j]);
  });

  function compute(){
    if(!state.active) return;
    // tile numbers
    const c = calcCost(state.active);
    perDayEv.textContent = INR(c.perDayEV);
    perDayIce.textContent= INR(c.perDayICE);
    monthlyPair.textContent= `EV ${INR(c.mEV)} • Petrol ${INR(c.mICE)}`;
    yearlyPair.textContent = `EV ${INR(c.mEV*12)} • Petrol ${INR(c.mICE*12)}`;
    const maxM = Math.max(c.mEV, c.mICE, 1);
    barEvM.style.width = (c.mEV/maxM*100)+'%';
    barIceM.style.width= (c.mICE/maxM*100)+'%';
    const maxY = Math.max(c.mEV*12, c.mICE*12, 1);
    barEvY.style.width = (c.mEV*12/maxY*100)+'%';
    barIceY.style.width= (c.mICE*12/maxY*100)+'%';
    saveMonth.textContent = INR(c.mICE - c.mEV);
    const pct = clamp(c.pct, -100, 100);
    const circ=2*Math.PI*50; const prog=Math.max(0,Math.min(1,pct/100));
    gProg.setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog));
    gProg.setAttribute('stroke', pct<0?'#ef4444':(pct<10?'#f59e0b':'#16a34a'));
    gLabel.textContent = (isFinite(pct)?Math.round(pct):0)+'%';
    goodFit.style.display = (c.pct>=20 && (c.mICE-c.mEV)>1500) ? 'inline-flex' : 'none';
    // cache for share/tools
    window.__calcCache = {...c, dailyKm:state.dailyKm, dpm:state.daysPerMonth, petrol:state.petrol, tariff:state.tariff, kmpl: kmplBySeg(state.active.segment), monthlySavings: (c.mICE-c.mEV) };
  }

  /* ---------- Compare modal: baseline + swipeable peers ---------- */
  const cmpOverlay = $('#compareOverlay'), cmpBase = $('#cmpBase'), cmpTrack = $('#cmpTrack'),
        cmpPrev=$('#cmpPrev'), cmpNext=$('#cmpNext'), cmpClose=$('#cmpClose'), cmpViewport=$('#cmpViewport'),
        cmpEmiIn=$('#cmpEmiIn');

  $('#compareBtn').addEventListener('click', openCompare);
  cmpClose.addEventListener('click', closeOverlay);
  cmpPrev.addEventListener('click', ()=>shiftSlide(-1));
  cmpNext.addEventListener('click', ()=>shiftSlide(1));
  cmpEmiIn.addEventListener('input', ()=>{
    state.emiMonthly = +cmpEmiIn.value||0;
    // update coverage bars
    $$('.cmpSlide').forEach(slide=>{
      const modelId = slide.getAttribute('data-id');
      const m = state.cmpPeers.find(x=>x.id===modelId);
      if(!m) return;
      updatePeerCoverage(slide, m);
    });
    updatePeerCoverage(cmpBase, state.active, true);
  });

  let startX=0, curX=0, isDown=false, currentOffset=0;
  cmpViewport.addEventListener('pointerdown', e=>{ isDown=true; startX=e.clientX; cmpViewport.setPointerCapture(e.pointerId); });
  cmpViewport.addEventListener('pointermove', e=>{
    if(!isDown) return; curX=e.clientX; const dx=curX-startX; cmpTrack.style.transform=`translateX(${currentOffset+dx}px)`;
  });
  cmpViewport.addEventListener('pointerup', e=>{
    if(!isDown) return; isDown=false; const dx=(curX||startX)-startX;
    if(Math.abs(dx)>80){ shiftSlide(dx<0?1:-1); } else { // snap back
      cmpTrack.style.transform=`translateX(${currentOffset}px)`;
    }
    try{cmpViewport.releasePointerCapture(e.pointerId);}catch{}
  });

  function openCompare(){
    if(!state.active){ alert('Pick a model first'); return; }
    // ensure EMI input prefilled from tools (if any)
    if(state.emiMonthly>0) cmpEmiIn.value = Math.round(state.emiMonthly);
    // peers selection:
    // - same type (car vs scooter) = we already operate within tab list
    // - prefer same segment; if too few, allow any segment
    // - within ±20% price band when possible
    // - rank by monthly EV cost ascending
    const candidates = [...DATASET()].filter(x=>x.id!==state.active.id);
    const price = state.active.price_lakh||0;
    const sameSeg = candidates.filter(x=>x.segment===state.active.segment);
    const pool = (sameSeg.length>=3 ? sameSeg : candidates);
    const band = pool.filter(x=> price ? (Math.abs((x.price_lakh||0)-price) <= price*0.20) : true);
    const cohort = (band.length>=3 ? band : pool);
    const ranked = cohort
      .map(m=>({m, cost: calcCost(m)}))
      .sort((a,b)=>a.cost.mEV - b.cost.mEV)
      .map(x=>x.m)
      .slice(0,8);

    state.cmpPeers = ranked;
    buildBaseline();
    buildSlides();
    state.cmpIndex = 0; currentOffset = 0; cmpTrack.style.transform='translateX(0px)';
    openOverlay(cmpOverlay);
  }

  function buildBaseline(){
    const m = state.active, c = calcCost(m);
    cmpBase.className = 'cmpCard baseline';
    cmpBase.setAttribute('data-id', m.id);
    cmpBase.innerHTML = `
      <div class="head">
        <img src="${imgFor(m)}" alt="">
        <div>
          <div class="title">${m.brand} ${m.model}</div>
          <div class="small muted">${m.segment} • ${m.range_km||'—'} km est. range</div>
        </div>
      </div>
      <div class="cmpStats">
        <div class="cmpStat"><div class="label">EV ₹/day</div><div class="val tabnums">${INR(c.perDayEV)}</div></div>
        <div class="cmpStat"><div class="label">Petrol ₹/day</div><div class="val tabnums">${INR(c.perDayICE)}</div></div>
        <div class="cmpStat"><div class="label">Monthly EV</div><div class="val tabnums">${INR(c.mEV)}</div></div>
        <div class="cmpStat"><div class="label">Monthly Petrol</div><div class="val tabnums">${INR(c.mICE)}</div></div>
      </div>
      <div class="cmpSave">
        <div class="pill tabnums">Savings/mo: ${INR(c.mICE-c.mEV)}</div>
        <div class="pill tabnums">vs petrol: ${Math.round(clamp(c.pct, -100, 100))}%</div>
      </div>
      <div class="cmpEMI" id="cmpBaseEmi"></div>
    `;
    updatePeerCoverage(cmpBase, m, true);
  }

  function buildSlides(){
    cmpTrack.innerHTML = '';
    state.cmpPeers.forEach((m,i)=>{
      const c = calcCost(m);
      const slide = document.createElement('div');
      slide.className = 'cmpSlide';
      slide.setAttribute('data-id', m.id);
      slide.innerHTML = `
        <div class="head">
          <img src="${imgFor(m)}" alt="">
          <div>
            <div class="title">${m.brand} ${m.model}</div>
            <div class="small muted">${m.segment} • ${m.range_km||'—'} km</div>
          </div>
        </div>
        <div class="cmpStats">
          <div class="cmpStat"><div class="label">EV ₹/day</div><div class="val tabnums">${INR(c.perDayEV)}</div></div>
          <div class="cmpStat"><div class="label">Petrol ₹/day</div><div class="val tabnums">${INR(c.perDayICE)}</div></div>
          <div class="cmpStat"><div class="label">Monthly EV</div><div class="val tabnums">${INR(c.mEV)}</div></div>
          <div class="cmpStat"><div class="label">Monthly Petrol</div><div class="val tabnums">${INR(c.mICE)}</div></div>
        </div>
        <div class="small muted mt8">Savings/mo</div>
        <div class="val tabnums">${INR(c.mICE - c.mEV)}</div>
        <div class="small muted mt8">EMI coverage</div>
        <div class="cmpPct" id="cov_${m.id}"><div style="width:0%"></div></div>
        <div class="cmpActions">
          <button class="button primary" data-act="select">Set as selection</button>
          <button class="button" data-act="open">Open calculator</button>
        </div>
      `;
      // preload next/prev image
      if(IMG_MAP[m.id]){ const im=new Image(); im.src=`assets/img/${IMG_MAP[m.id]}`; }
      slide.querySelector('[data-act="select"]').addEventListener('click',()=>{ openCalc(m); closeOverlay(); });
      slide.querySelector('[data-act="open"]').addEventListener('click',()=>{ openCalc(m); });
      cmpTrack.appendChild(slide);
      updatePeerCoverage(slide, m);
    });
  }

  function updatePeerCoverage(slide, m, isBase){
    const c = calcCost(m);
    const emi = state.emiMonthly || (+cmpEmiIn.value||0);
    const pct = emi>0 ? clamp(Math.round((c.mICE-c.mEV)/emi*100), 0, 100) : 0;
    if(isBase){
      const el = $('#cmpBaseEmi');
      el.textContent = emi>0 ? `EMI coverage: ${pct}% of ₹${INR(emi).replace('₹','')}` : 'Enter EMI to view coverage';
    } else {
      const bar = slide.querySelector(`#cov_${m.id}>div`);
      if(bar) bar.style.width = pct+'%';
      const wrap = slide.querySelector(`#cov_${m.id}`);
      if(wrap) wrap.classList.toggle('bad', pct<50 && emi>0);
    }
  }

  function slideWidth(){
    const slide = cmpTrack.querySelector('.cmpSlide');
    return slide ? (slide.getBoundingClientRect().width + 12) : 300;
  }
  function shiftSlide(dir){
    const max = Math.max(0, state.cmpPeers.length-1);
    state.cmpIndex = clamp(state.cmpIndex + dir, 0, max);
    currentOffset = -slideWidth()*state.cmpIndex;
    cmpTrack.style.transform = `translateX(${currentOffset}px)`;
  }

  function imgFor(m){
    const f = IMG_MAP[m.id];
    return f ? `assets/img/${f}` : 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="110"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="52%" font-family="Arial" font-size="12" fill="#64748b" text-anchor="middle">${m.brand} ${m.model}</text></svg>`);
  }

  /* ---------- Tools (EMI/Litres) ---------- */
  const toolsOv=$('#toolsOverlay'), emiAmount=$('#emiAmount'), emiRate=$('#emiRate'), emiMonths=$('#emiMonths'), emiOut=$('#emiOut'), savingsOut=$('#savingsOut');
  $('#toolsClose').addEventListener('click', closeOverlay);
  $('#shareEmi').addEventListener('click',()=>openOverlay($('#shareOverlay')));
  $('#toolsInfo').addEventListener('click',()=>openInfo('emi'));

  function emiCalc(P, annualRatePct, months){
    const r=(annualRatePct/100)/12;
    if(months<=0) return 0; if(r===0) return P/months;
    const a=Math.pow(1+r,months); return P*r*a/(a-1);
  }
  function fillTools(){
    const c=window.__calcCache||{};
    $('#lsKm').textContent = Math.round((c.dailyKm||0)*(c.dpm||0));
    $('#lsKmpl').textContent = (c.kmpl||15) + ' km/L';
    const litres = (c.kmpl>0) ? (((c.dailyKm||0)*(c.dpm||0))/(c.kmpl||1)) : 0;
    $('#lsLitres').textContent = (Math.round(litres*10)/10) + ' L';

    if(!emiAmount.value) emiAmount.value = 500000;
    if(!emiRate.value)   emiRate.value   = 9.5;
    if(!emiMonths.value) emiMonths.value = 60;

    const update=()=>{
      const emi = emiCalc(+emiAmount.value||0, +emiRate.value||0, +emiMonths.value||0);
      emiOut.textContent = INR(emi);
      state.emiMonthly = emi;
      savingsOut.textContent = INR(c.monthlySavings||0);
      // also update compare if open
      cmpEmiIn.value = Math.round(emi||0) || '';
      $$('.cmpSlide').forEach(slide=>{
        const id=slide.getAttribute('data-id');
        const m=[...MODELS_CARS, ...MODELS_SCOOTERS].find(x=>x.id===id);
        if(m) updatePeerCoverage(slide, m);
      });
      updatePeerCoverage(cmpBase, state.active, true);
    };
    ['input','change'].forEach(ev=>{
      emiAmount.addEventListener(ev,update);
      emiRate.addEventListener(ev,update);
      emiMonths.addEventListener(ev,update);
    });
    update();
  }

  /* ---------- Info overlay ---------- */
  const infoOv=$('#infoOverlay'), infoContent=$('#infoContent'), infoTitle=$('#infoTitle');
  $('#infoClose').addEventListener('click', closeOverlay);
  function openInfo(which){
    if(which==='emi'){
      infoTitle.textContent='EMI helper — What it means';
      infoContent.innerHTML=`<div class="bold">What is EMI coverage?</div>
      <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV.</div>
      <div class="mt16 bold">How we compute</div>
      <ul class="small"><li>Standard EMI formula with your Amount, Interest %, and Months.</li><li>Fuel savings = Petrol monthly − EV monthly.</li></ul>`;
    } else {
      infoTitle.textContent='How costs are calculated';
      infoContent.innerHTML=`<ul class="small">
        <li><b>EV ₹/km</b> = (kWh/100km ÷ 100) × tariff × 1.12</li>
        <li><b>Petrol ₹/km</b> = Petrol ₹/L ÷ segment km/L benchmark</li>
        <li>Monthly = Per-day × days/month (<b>26</b> default)</li>
      </ul>`;
    }
    openOverlay(infoOv);
  }

  /* ---------- Home UI events ---------- */
  $('#tab-cars').addEventListener('click',()=>{ state.tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList(); });
  $('#tab-scooters').addEventListener('click',()=>{ state.tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList(); });
  $('#q').addEventListener('input',e=>{ state.q=e.target.value; renderList(); });

  /* ---------- Boot ---------- */
  renderList();
})();
