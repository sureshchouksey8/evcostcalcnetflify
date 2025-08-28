(function(){
  // ---------- Helpers & State ----------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const inr = n => (!isFinite(n)||n===Infinity) ? "—" : new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n));

  const state = {
    tab: 'cars',                // 'cars' | 'scooters'
    q: '',                      // search text
    active: null,               // selected model for calculator
    cityId: 'gurugram',
    petrol: 100,
    tariff: 6.8,
    kmPerDay: 20,
    daysPerMonth: 26,

    // compare
    cmpIndex: 0,
    cmpPeers: [],
    touchStartX: 0
  };

  const DATASET = ()=> state.tab==='cars' ? MODELS_CARS : MODELS_SCOOTERS;

  function kmpl(seg){ return BENCH_KMPL[seg] ?? (state.tab==='scooters'?50:15); }
  function costFor(m){
    const km=state.kmPerDay, dpm=state.daysPerMonth;
    const evPerKm = (m.eff_kwh_per_100km/100) * state.tariff * 1.12;
    const icePerKm = state.petrol / Math.max(1, kmpl(m.segment));
    const perDayEV = evPerKm*km, perDayICE = icePerKm*km;
    return {
      perDayEV, perDayICE,
      mEV: perDayEV*dpm, mICE: perDayICE*dpm,
      evPerKm, icePerKm
    };
  }

  // ---------- List ----------
  function renderList(){
    const items = DATASET().filter(m=>{
      if(!state.q) return true;
      const s=(m.brand+" "+m.model+" "+m.segment).toLowerCase();
      return s.includes(state.q.toLowerCase());
    });
    $('#resultCount').textContent = `${items.length} result${items.length===1?'':'s'}`;

    const grid = $('#grid'); grid.innerHTML = '';
    items.forEach(m=>{
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `
        <div class="bold" style="font-size:18px">${m.brand} ${m.model}</div>
        <div class="small muted mt8">${m.segment} • ${m.range_km} km est. range</div>
        <div class="small mt8"><span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span></div>
      `;
      card.addEventListener('click',()=>openCalc(m));
      grid.appendChild(card);
    });
  }

  // ---------- Calculator ----------
  const overlay=$('#overlay');
  function openOverlay(el){ el.classList.add('show'); document.documentElement.style.overflow='hidden'; }
  function closeOverlay(el){ el.classList.remove('show'); document.documentElement.style.overflow='auto'; }

  function openCalc(m){
    state.active = m;
    // fill city
    const sel = $('#citySel'); sel.innerHTML = CITY_PRESETS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    sel.value = state.cityId;
    const city = CITY_PRESETS.find(c=>c.id===state.cityId) || CITY_PRESETS[0];
    state.petrol = city.petrol; state.tariff = city.tariff;
    $('#tariffView').textContent = state.tariff.toFixed(1);
    $('#petrolIn').value = state.petrol;

    // sliders
    $('#kmRange').value = state.kmPerDay; $('#kmVal').textContent = state.kmPerDay;
    $('#daysRange').value = state.daysPerMonth; $('#daysBadge').textContent = `${state.daysPerMonth} days`;

    // model info
    $('#modelName').textContent = `${m.brand} ${m.model}`;
    $('#modelInfo').textContent = `${m.segment} • ${m.range_km} km est. range`;

    // Photo (local optional)
    setPhoto('#modelPhoto', `assets/img/${m.id}.jpg`);

    buildModelSwitcher();
    compute();
    openOverlay(overlay);
  }

  function setPhoto(sel,src){
    const img=$(sel);
    img.style.display='none';
    img.removeAttribute('src');
    if(!src){return;}
    img.onerror=()=>{img.style.display='none';};
    img.onload=()=>{img.style.display='block';};
    img.src=src;
  }

  function compute(){
    if(!state.active) return;
    const m = state.active;
    const c = costFor(m);

    $('#perDayEv').textContent = inr(c.perDayEV);
    $('#perDayIce').textContent = inr(c.perDayICE);
    $('#kmNoteEv').textContent = `For ${state.kmPerDay} km/day`;
    $('#kmNoteIce').textContent = `For ${state.kmPerDay} km/day`;

    $('#monthlyPair').textContent = `EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`;
    $('#yearlyPair').textContent = `EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;

    const totalM=Math.max(c.mEV,c.mICE,1);
    $('#barEvM').style.width=(c.mEV/totalM*100)+'%';
    $('#barIceM').style.width=(c.mICE/totalM*100)+'%';
    const totalY=Math.max(c.mEV*12,c.mICE*12,1);
    $('#barEvY').style.width=(c.mEV*12/totalY*100)+'%';
    $('#barIceY').style.width=(c.mICE*12/totalY*100)+'%';

    const pct = c.perDayICE>0 ? Math.max(-100, Math.min(100, ((c.perDayICE-c.perDayEV)/c.perDayICE)*100)) : 0;
    const circ=2*Math.PI*50; const prog=Math.max(0,Math.min(1,pct/100)); const col=pct<0?'#ef4444':(pct<10?'#f59e0b':'#16a34a');
    $('#gProg').setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog)); $('#gProg').setAttribute('stroke',col);
    $('#gLabel').textContent = (isFinite(pct)?Math.round(pct):0)+'%';
    $('#saveMonth').textContent = inr(c.mICE - c.mEV);
    $('#goodFit').style.display = (pct>=20 && (c.mICE-c.mEV)>1500) ? 'inline-flex' : 'none';
  }

  // model switcher dropdown + prev/next
  function buildModelSwitcher(){
    const ds = DATASET();
    const sw = $('#modelSwitcher'); sw.innerHTML = ds.map(d=>`<option value="${d.id}">${d.brand} ${d.model}</option>`).join('');
    sw.value = state.active.id;
    sw.onchange = ()=>{ const m = ds.find(x=>x.id===sw.value); if(m){ state.active = m; $('#modelName').textContent = `${m.brand} ${m.model}`; $('#modelInfo').textContent = `${m.segment} • ${m.range_km} km est. range`; setPhoto('#modelPhoto',`assets/img/${m.id}.jpg`); compute(); }};
    $('#prevModel').onclick = ()=>{ const i = ds.findIndex(x=>x.id===state.active.id); const m = ds[(i-1+ds.length)%ds.length]; if(m){ sw.value=m.id; sw.onchange(); } };
    $('#nextModel').onclick = ()=>{ const i = ds.findIndex(x=>x.id===state.active.id); const m = ds[(i+1)%ds.length]; if(m){ sw.value=m.id; sw.onchange(); } };
  }

  // inputs wiring
  $('#tab-cars').onclick = ()=>{ state.tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList(); };
  $('#tab-scooters').onclick = ()=>{ state.tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList(); };
  $('#q').oninput = e=>{ state.q=e.target.value; renderList(); };

  $('#citySel').onchange = ()=>{ const c = CITY_PRESETS.find(x=>x.id===$('#citySel').value); if(c){ state.cityId=c.id; state.tariff=c.tariff; state.petrol=c.petrol; $('#tariffView').textContent=state.tariff.toFixed(1); $('#petrolIn').value=state.petrol; compute(); } };
  $('#petrolIn').oninput = e=>{ state.petrol = +e.target.value || 0; compute(); };
  $('#kmRange').oninput = e=>{ state.kmPerDay = +e.target.value || 0; $('#kmVal').textContent=state.kmPerDay; compute(); };
  $('#daysRange').oninput = e=>{ state.daysPerMonth = +e.target.value || 0; $('#daysBadge').textContent = `${state.daysPerMonth} days`; compute(); };

  // close handlers
  $('#closeBtn').onclick = ()=> closeOverlay(overlay);
  window.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeOverlay(overlay); closeOverlay($('#compareOverlay')); closeOverlay($('#infoOverlay')); }});
  overlay.addEventListener('click',e=>{ if(e.target===overlay) closeOverlay(overlay); });

  // info modal (minimal)
  $('#infoBtn').onclick = ()=>{
    $('#infoContent').innerHTML = `
      <div class="bold">Simple & transparent</div>
      <ul class="small">
        <li><b>EV ₹/km</b> = (kWh/100km ÷ 100) × tariff × 1.12 (GST approx).</li>
        <li><b>Petrol ₹/km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li>
        <li>Monthly = Per-day × days/month (<b>26</b> default, adjustable).</li>
        <li>City presets set tariff & petrol automatically (you can edit petrol).</li>
      </ul>`;
    openOverlay($('#infoOverlay'));
  };
  $('#infoClose').onclick = ()=> closeOverlay($('#infoOverlay'));
  $('#infoOverlay').addEventListener('click',e=>{ if(e.target===$('#infoOverlay')) closeOverlay($('#infoOverlay')); });

  // ---------- Compare ----------
  $('#compareBtn').onclick = ()=> openCompare();

  function peersFor(baseline){
    const all = DATASET().filter(x=>x.id!==baseline.id);
    // 1) same vehicle type auto (cars vs scooters – handled by DATASET)
    // 2) prefer same segment if we can get >=3
    const sameSeg = all.filter(x=>x.segment===baseline.segment);
    const segPool = (sameSeg.length>=3 ? sameSeg : all);
    // 3) price band ±20% if we can keep >=4
    const price = baseline.price_lakh || 0;
    let band = segPool;
    if(price>0){
      const tmp = segPool.filter(x=> Math.abs((x.price_lakh||0)-price) <= price*0.20 );
      if(tmp.length>=4) band = tmp;
    }
    // rank by monthly EV running cost (ascending)
    return band.map(p=>({p, cost: costFor(p)}))
      .sort((a,b)=> a.cost.mEV - b.cost.mEV)
      .map(x=>x.p)
      .slice(0,12);
  }

  function openCompare(){
    if(!state.active){ alert('Pick a model first'); return; }
    state.cmpPeers = peersFor(state.active);
    state.cmpIndex = 0;
    buildBaseline();
    buildSlides();
    bindCarousel();
    openOverlay($('#compareOverlay'));
  }

  function buildBaseline(){
    const m = state.active, c = costFor(m);
    const el = $('#cmpBaseline');
    el.innerHTML = `
      <div class="title">Baseline</div>
      <div class="mt8 bold" style="font-size:18px">${m.brand} ${m.model}</div>
      <div class="cmpMeta mt8">${m.segment} • ${m.range_km} km est. range</div>
      <img class="cmpPhoto mt8" id="cmpBasePhoto" alt="">
      <div class="cmpRow mt8">
        <div class="cmpTile ev"><div class="up small">Per-day (EV)</div><div class="fig tabnums">${inr(c.perDayEV)}</div></div>
        <div class="cmpTile ice"><div class="up small">Per-day (Petrol)</div><div class="fig tabnums">${inr(c.perDayICE)}</div></div>
      </div>
      <div class="stat mt8">
        <div class="row small muted"><span>Monthly running cost</span><span class="tabnums">EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}</span></div>
      </div>
      <div class="cmpActions">
        <button class="button" id="cmpOpenCalc">Open calculator</button>
      </div>
    `;
    setPhoto('#cmpBasePhoto', `assets/img/${m.id}.jpg`);
    $('#cmpOpenCalc').onclick = ()=>{ closeOverlay($('#compareOverlay')); openCalc(m); };
  }

  function slideHTML(p){
    const c = costFor(p);
    const base = costFor(state.active);
    const monthlySaveVsBase = (base.mEV - c.mEV);
    return `
      <div class="cmpCard">
        <div class="title">Peer</div>
        <div class="bold mt8" style="font-size:18px">${p.brand} ${p.model}</div>
        <div class="cmpMeta mt8">${p.segment} • ${p.range_km} km est. range</div>
        <img class="cmpPhoto mt8" alt="" onerror="this.style.display='none'" src="assets/img/${p.id}.jpg">
        <div class="cmpRow mt8">
          <div class="cmpTile ev"><div class="up small">Per-day (EV)</div><div class="fig tabnums">${inr(c.perDayEV)}</div></div>
          <div class="cmpTile ice"><div class="up small">Per-day (Petrol)</div><div class="fig tabnums">${inr(c.perDayICE)}</div></div>
        </div>
        <div class="stat mt8">
          <div class="row small muted"><span>Monthly running cost</span><span class="tabnums">EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}</span></div>
        </div>
        <div class="cmpSave small mt8">
          ${monthlySaveVsBase>0 ? `Saves ${inr(monthlySaveVsBase)} /mo vs baseline` : `Costs ${inr(-monthlySaveVsBase)} more /mo vs baseline`}
        </div>
        <div class="cmpActions">
          <button class="button primary" data-act="baseline">Set as baseline</button>
          <button class="button" data-act="open">Open calculator</button>
        </div>
      </div>
    `;
  }

  function buildSlides(){
    const track = $('#cmpTrack');
    track.innerHTML = state.cmpPeers.map(p=> `<div class="cmpSlide">${slideHTML(p)}</div>`).join('');
    // events for each slide
    state.cmpPeers.forEach((p, i)=>{
      const slide = track.children[i];
      slide.querySelector('[data-act="baseline"]').addEventListener('click', ()=>{
        state.active = p; buildBaseline();
        // Recompute peers for the new baseline & rebuild slides (stay in compare)
        state.cmpPeers = peersFor(state.active);
        state.cmpIndex = 0;
        buildSlides();
        updateTransform();
      });
      slide.querySelector('[data-act="open"]').addEventListener('click', ()=>{
        closeOverlay($('#compareOverlay'));
        openCalc(p);
      });
    });
    updateTransform();
  }

  function updateTransform(){
    const track = $('#cmpTrack');
    const slide = track.querySelector('.cmpSlide');
    if(!slide) return;
    const w = slide.getBoundingClientRect().width + 16; // include gap
    track.style.transform = `translateX(${-(state.cmpIndex * w)}px)`;
  }

  function bindCarousel(){
    $('#cmpPrev').onclick = ()=>{ state.cmpIndex = Math.max(0, state.cmpIndex-1); updateTransform(); };
    $('#cmpNext').onclick = ()=>{ state.cmpIndex = Math.min(state.cmpPeers.length-1, state.cmpIndex+1); updateTransform(); };
    const container = $('.cmpCarousel');
    container.ontouchstart = (e)=> { state.touchStartX = e.touches[0].clientX; };
    container.ontouchend = (e)=> {
      const dx = (e.changedTouches[0].clientX - state.touchStartX);
      if(Math.abs(dx) > 40){
        if(dx<0) $('#cmpNext').onclick();
        else $('#cmpPrev').onclick();
      }
    };

    // closing
    const cmpOv = $('#compareOverlay');
    $('#cmpClose').onclick = ()=> closeOverlay(cmpOv);
    cmpOv.addEventListener('click',e=>{ if(e.target===cmpOv) closeOverlay(cmpOv); });
  }

  // ---------- Boot ----------
  renderList();
})();
