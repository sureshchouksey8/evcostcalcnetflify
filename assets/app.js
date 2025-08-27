(() => {
  // ---------- Shortcuts
  const $=s=>document.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const inr=n=>(!isFinite(n)||n===Infinity)?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n||0));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const BODY=document.body;

  // ---------- App state
  let tab='cars', q='', active=null, list=[], peers=[], peerIndex=0;

  // ---------- Image helper (local-first)
  function imgFor(id){
    const name=(window.IMG_MAP && window.IMG_MAP[id]) || (id + '.jpg');
    return `assets/img/${name}`;
  }

  // ---------- Price bands for AI + compare
  function priceBand(lakh){
    if (lakh <= 10) return '≤10';
    if (lakh <= 20) return '10-20';
    if (lakh <= 35) return '20-35';
    if (lakh <= 60) return '35-60';
    return '60+';
  }

  // ---------- Render list
  function DATA(){ return tab==='cars' ? window.MODELS_CARS : window.MODELS_SCOOTERS; }

  function renderList(){
    list = DATA().filter(m=>{
      if(!q) return true;
      const s=(m.brand+" "+m.model+" "+m.segment).toLowerCase();
      return s.includes(q.toLowerCase());
    });
    $('#resultCount').textContent = `${list.length} result${list.length===1?'':'s'}`;
    const grid=$('#grid'); grid.innerHTML='';
    list.forEach(m=>{
      const card=document.createElement('button');
      card.className='card';
      card.innerHTML = `
        <div class="bold" style="font-size:18px">${m.brand} ${m.model}</div>
        <div class="small muted mt8">${m.segment} • ${m.range_km||'—'} km est. range</div>
        <div class="small mt8"><span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span></div>
      `;
      card.addEventListener('click',()=>openCalc(m));
      grid.appendChild(card);
    });
  }

  // ---------- Modal plumbing
  const overlay=$('#overlay'), sheet=$('#sheet');
  const shareOv=$('#shareOverlay'), shareCv=$('#shareCanvas'), sctx=shareCv.getContext('2d');
  const cmpOv=$('#compareOverlay'), cmpTrack=$('#cmpTrack');

  function openOverlay(ov){ ov.classList.add('show'); BODY.classList.add('no-scroll'); }
  function closeOverlay(ov){ ov.classList.remove('show'); BODY.classList.remove('no-scroll'); }

  // backdrop click
  [$,null].forEach; // no-op to keep bundlers quiet
  [overlay, shareOv, cmpOv, $('#infoOverlay')].forEach(ov=>{
    ov.addEventListener('click', (e)=>{ if(e.target===ov) closeOverlay(ov); });
  });
  // ESC
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ [overlay,shareOv,cmpOv,$('#infoOverlay')].forEach(closeOverlay); } });

  // Simple swipe-down close for sheet (mobile)
  let startY=0, dragging=false;
  sheet.addEventListener('touchstart',e=>{ if(window.innerWidth<900){ dragging=true; startY=e.touches[0].clientY; }},{passive:true});
  sheet.addEventListener('touchmove',e=>{ if(!dragging) return; const dy=e.touches[0].clientY-startY; if(dy>18){ sheet.style.transform=`translateY(${dy}px)`; }},{passive:true});
  sheet.addEventListener('touchend',()=>{ if(!dragging) return; dragging=false; const cur=parseFloat((sheet.style.transform||'').match(/translateY\(([-\d.]+)px\)/)?.[1]||'0'); if(cur>120){ closeOverlay(overlay);} sheet.style.transform=''; });

  // ---------- Calculator elements
  const citySel=$('#citySel'), tariffView=$('#tariffView'), petrolIn=$('#petrolIn'),
        kmR=$('#kmRange'), kmVal=$('#kmVal'), daysR=$('#daysRange'), daysBadge=$('#daysBadge'),
        perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'), kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce'),
        monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair'), saveMonth=$('#saveMonth'),
        barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY'),
        gProg=$('#gProg'), gLabel=$('#gLabel'), modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit'),
        modelPhoto=$('#modelPhoto'), switcher=$('#switcher');

  // City presets
  window.CITY_PRESETS.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; citySel.appendChild(o); });

  function setDefaultCity(){
    const g=window.CITY_PRESETS.find(x=>x.name==="Gurugram")||window.CITY_PRESETS[0]||{id:'delhi',tariff:7,petrol:100,name:'Delhi'};
    citySel.value=g.id; tariffView.textContent=(g.tariff||7).toFixed(1); petrolIn.value=g.petrol||100;
  }

  function openCalc(m){
    active=m;
    // fill switcher with current list
    switcher.innerHTML=''; list.forEach(x=>{ const o=document.createElement('option'); o.value=x.id; o.textContent=`${x.brand} ${x.model}`; if(x.id===m.id) o.selected=true; switcher.appendChild(o); });
    // set city defaults if not set
    if(!tariffView.textContent || tariffView.textContent==='—') setDefaultCity();

    // reset sliders (keeps last if already adjusted)
    if(!window.__calcCache){ kmR.value=20; kmVal.textContent='20'; daysR.value=26; daysBadge.textContent='26 days'; }

    modelName.textContent=`${m.brand} ${m.model}`;
    modelInfo.textContent=`${m.segment} • ${m.range_km||'—'} km est. range`;
    goodFit.style.display='none';
    // photo (local-first)
    const src = imgFor(m.id);
    modelPhoto.src = src; modelPhoto.onload=()=>{ modelPhoto.style.display='block'; }; modelPhoto.onerror=()=>{ modelPhoto.style.display='none'; };

    compute();
    openOverlay(overlay);
  }

  // Switcher & nav
  switcher.addEventListener('change', ()=>{
    const id=switcher.value; const m=list.find(x=>x.id===id); if(m) openCalc(m);
  });
  $('#prevModel').addEventListener('click',()=>{
    const idx=list.findIndex(x=>x.id===active.id);
    const n=(idx-1+list.length)%list.length; openCalc(list[n]);
  });
  $('#nextModel').addEventListener('click',()=>{
    const idx=list.findIndex(x=>x.id===active.id);
    const n=(idx+1)%list.length; openCalc(list[n]);
  });

  // Interactions
  citySel.addEventListener('change',()=>{
    const c=window.CITY_PRESETS.find(x=>x.id===citySel.value);
    if(c){ tariffView.textContent=c.tariff.toFixed(1); petrolIn.value=c.petrol; compute(); }
  });
  petrolIn.addEventListener('input',compute);
  kmR.addEventListener('input',()=>{ kmVal.textContent=kmR.value; kmNoteEv.textContent=`For ${kmR.value} km/day`; kmNoteIce.textContent=`For ${kmR.value} km/day`; compute(); });
  daysR.addEventListener('input',()=>{ daysBadge.textContent=daysR.value+' days'; compute(); });

  $('#closeBtn').addEventListener('click',()=>closeOverlay(overlay));

  // ---------- Cost math
  function costFor(m){
    const kmpl = window.BENCH_KMPL[m.segment] ?? 15;
    const tariff = parseFloat(tariffView.textContent)||0; const petrol = parseFloat(petrolIn.value)||0;
    const dailyKm = parseInt(kmR.value,10)||0; const dpm = parseInt(daysR.value,10)||0;
    const kwhPerKm = (m.eff_kwh_per_100km||0)/100; const evCostPerKm = kwhPerKm*tariff*1.12; const iceCostPerKm = petrol/Math.max(kmpl,1);
    const perDayEV=evCostPerKm*dailyKm, perDayICE=iceCostPerKm*dailyKm; const mEV=perDayEV*dpm, mICE=perDayICE*dpm;
    return {kmpl,tariff,petrol,dailyKm,dpm,perDayEV,perDayICE,mEV,mICE,evCostPerKm,iceCostPerKm};
  }

  function compute(){
    if(!active) return;
    const c=costFor(active);
    perDayEv.textContent=inr(c.perDayEV); perDayIce.textContent=inr(c.perDayICE);
    monthlyPair.textContent=`EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`; yearlyPair.textContent=`EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;
    const totalM=Math.max(c.mEV,c.mICE,1); barEvM.style.width=(c.mEV/totalM*100)+'%'; barIceM.style.width=(c.mICE/totalM*100)+'%';
    const totalY=Math.max(c.mEV*12,c.mICE*12,1); barEvY.style.width=(c.mEV*12/totalY*100)+'%'; barIceY.style.width=(c.mICE*12/totalY*100)+'%';
    let pct = (c.perDayICE>0)?((c.perDayICE-c.perDayEV)/c.perDayICE)*100:0; pct=clamp(pct,-100,100);
    const circ=2*Math.PI*50; const prog=clamp(pct/100,0,1);
    gProg.setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog));
    gLabel.textContent=(isFinite(pct)?Math.round(pct):0)+'%';
    saveMonth.textContent=inr(c.mICE-c.mEV);
    goodFit.style.display=(pct>=20 && (c.mICE-c.mEV)>1500)?'inline-flex':'none';
    window.__calcCache={...c,monthlySavings:(c.mICE-c.mEV)};
  }

  // ---------- Compare carousel (Phase B)
  $('#compareBtn').addEventListener('click', ()=>{
    if(!active){ alert('Pick a model first'); return; }
    peers = buildPeers(active);
    peerIndex = 0;
    renderCompare();
    openOverlay(cmpOv);
  });

  function buildPeers(sel){
    const pool = (sel.segment==='Scooter' ? window.MODELS_SCOOTERS : window.MODELS_CARS)
      .filter(x=>x.id!==sel.id);
    const band = priceBand(sel.price_lakh||0);
    const sameBand = pool.filter(x=>priceBand(x.price_lakh||0)===band && x.segment===sel.segment);
    const byCost = (arr)=>arr.map(m=>({m, c: costFor(m)})).sort((a,b)=>a.c.mEV-b.c.mEV).map(x=>x.m);
    let candidates = sameBand.length ? sameBand : pool.filter(x=>x.segment===sel.segment);
    if (!candidates.length) candidates = pool;
    return byCost(candidates).slice(0,8);
  }

  function renderCompare(){
    cmpTrack.innerHTML='';
    peers.forEach(p=>{
      const div=document.createElement('div');
      div.className='cmp-card';
      const src=imgFor(p.id);
      div.innerHTML=`
        <img class="cmp-photo" src="${src}" onerror="this.style.display='none'">
        <div class="cmp-body">
          <div class="title">${p.brand} ${p.model}</div>
          <div class="muted">${p.segment} • ${p.range_km||'—'} km est. range</div>
          <div class="row mt8">
            <div class="small">EV per day:</div><div class="bold" id="c-ev-${p.id}">—</div>
          </div>
          <div class="row">
            <div class="small">Monthly EV:</div><div class="bold" id="c-mev-${p.id}">—</div>
          </div>
          <button class="button" data-id="${p.id}">Set as selection</button>
        </div>
      `;
      cmpTrack.appendChild(div);
      // fill numbers
      const c=costFor(p);
      div.querySelector(`#c-ev-${p.id}`).textContent=inr(c.perDayEV);
      div.querySelector(`#c-mev-${p.id}`).textContent=inr(c.mEV);
      div.querySelector('button').addEventListener('click',()=>{ openCalc(p); closeOverlay(cmpOv); });
    });
    gotoPeer(peerIndex, false);
  }

  function gotoPeer(i, animate=true){
    peerIndex = clamp(i, 0, Math.max(0, peers.length-1));
    cmpTrack.style.transition = animate? 'transform .25s ease' : 'none';
    const card = cmpTrack.querySelector('.cmp-card');
    const w = card ? card.getBoundingClientRect().width + 16 : 0;
    cmpTrack.style.transform = `translateX(${-(w*peerIndex)}px)`;
  }
  $('#cmpPrev').addEventListener('click', ()=> gotoPeer(peerIndex-1));
  $('#cmpNext').addEventListener('click', ()=> gotoPeer(peerIndex+1));
  $('#cmpClose').addEventListener('click', ()=> closeOverlay(cmpOv));

  // touch swipe on track
  let sx=0, swiping=false;
  cmpTrack.addEventListener('touchstart',e=>{ swiping=true; sx=e.touches[0].clientX; },{passive:true});
  cmpTrack.addEventListener('touchend',e=>{ if(!swiping) return; swiping=false; const dx=(e.changedTouches[0].clientX - sx); if(Math.abs(dx)>40){ gotoPeer(peerIndex + (dx<0?1:-1)); }},{passive:true});

  // ---------- EMI modal (re-using existing UI from previous build)
  const toolsOv=$('#toolsOverlay'); // (present in HTML)
  $('#emiBtn').addEventListener('click',()=>{
    if(!active){ alert('Pick a model first'); return; }
    // Reuse "EMI & Litres" UI from previous index — or skip if you want later.
    alert('EMI helper opens in the next iteration (UI preserved). For now use Share → EMI mode if present in your older branch.');
  });

  // ---------- Info modal
  $('#infoBtn').addEventListener('click',()=>openInfo('calc'));
  $('#infoClose').addEventListener('click',()=>closeOverlay($('#infoOverlay')));
  function openInfo(which){
    const content=$('#infoContent'), title=$('#infoTitle');
    if(which==='emi'){
      title.textContent='EMI helper — What it means';
      content.innerHTML = `
        <div class="bold">What is EMI coverage?</div>
        <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV. If your monthly savings are ₹8,000 and EMI is ₹12,000, coverage ≈ 67%.</div>
        <div class="mt16 bold">How we compute</div>
        <ul class="small">
          <li>EMI uses standard amortization with your Amount, Interest %, and Months.</li>
          <li>Fuel savings = Petrol monthly cost − EV monthly cost (from the main calculator).</li>
        </ul>`;
    } else {
      title.textContent='How costs are calculated';
      content.innerHTML=`<div class="bold">Simple & transparent</div>
        <ul class="small">
          <li><b>EV cost per km</b> = (kWh/100km ÷ 100) × tariff × 1.12 (GST approx).</li>
          <li><b>Petrol cost per km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li>
          <li>Monthly = Per-day × days/month (<b>26</b> default, adjustable).</li>
          <li>City presets set tariff & petrol automatically (you can edit petrol).</li>
        </ul>
        <div class="small mt12">Benchmarks are typical real-world figures; your results may vary with driving style, AC usage, traffic, etc.</div>`;
    }
    openOverlay($('#infoOverlay'));
  }

  // ---------- AI with sanity (Phase C)
  $('#aiBtn').addEventListener('click', runAiQuick);

  function aiGuards(scenario, models){
    const sel = models.find(m=>m.id===scenario.id);
    const sameType = (sel.segment==='Scooter') ? window.MODELS_SCOOTERS : window.MODELS_CARS;
    const band = priceBand(sel.price_lakh||0);
    const filtered = sameType.filter(m=>{
      const okBand = priceBand(m.price_lakh||0)===band;
      return okBand;
    });
    return filtered.length ? filtered : sameType;
  }

  function localAi(scenario, models){
    const byId=Object.fromEntries(models.map(m=>[m.id,m])); const sel=byId[scenario.id];
    const km=+scenario.kmPerDay||0, dpm=+scenario.daysPerMonth||26, petrol=+scenario.petrolPerL||100, tariff=+scenario.tariff||7;
    const pool=aiGuards(scenario, models);
    function calc(m){
      const kmpl=window.BENCH_KMPL[m.segment]??15;
      const evPerKm=(m.eff_kwh_per_100km/100)*tariff*1.12;
      const icePerKm=petrol/Math.max(1,kmpl);
      const perDayEV=evPerKm*km;
      return { id:m.id, monthlyEV:perDayEV*dpm, brand:m.brand, model:m.model, price_lakh:m.price_lakh, segment:m.segment };
    }
    const all=pool.map(calc);
    const selected=all.find(x=>x.id===sel.id);
    const peers=(all.filter(x=>x.id!==sel.id)).sort((a,b)=>a.monthlyEV-b.monthlyEV);
    const best=peers[0] && (peers[0].monthlyEV < selected.monthlyEV ? peers[0] : null);

    const shareLine = (sel.segment==='Scooter')
      ? (best ? `Try ${best.brand} ${best.model}: lower monthly EV cost` : `Best pick for this price band`)
      : (best ? `Try ${best.brand} ${best.model}: lower monthly EV cost` : `Best pick: strong monthly savings vs petrol`);

    return {
      verdict: best? 'try_alternative' : 'best_pick',
      alt_model_id: best? best.id : '',
      reasons: best? ['Lower monthly EV cost in same price band'] : ['Your pick has the lowest monthly EV cost among band peers'],
      share_line: shareLine
    };
  }

  function getScenario(){
    const c=window.__calcCache||{};
    return {
      id: active.id,
      kmPerDay:c.dailyKm||parseInt(kmR.value,10)||0,
      daysPerMonth:c.dpm||parseInt(daysR.value,10)||26,
      petrolPerL:c.petrol||parseFloat(petrolIn.value)||100,
      tariff:c.tariff||parseFloat(tariffView.textContent)||7
    };
  }

  function applyAi(ai, models){
    const aiPanel=$('#aiPanel'), aiVerdict=$('#aiVerdict'), aiReasons=$('#aiReasons'), aiAlt=$('#aiAlt');
    aiVerdict.textContent = ai.verdict==='best_pick' ? '✅ Best pick' : '👉 Try an alternative';
    aiPanel.className = (ai.verdict==='best_pick') ? 'ai-panel good' : 'ai-panel try';
    aiPanel.style.display='block';
    aiReasons.innerHTML = '<ul class="small" style="margin:6px 0 0 18px">'+(ai.reasons||[]).slice(0,3).map(r=>`<li>${r}</li>`).join('')+'</ul>';
    if(ai.verdict==='try_alternative' && ai.alt_model_id){
      const alt=[...window.MODELS_CARS,...window.MODELS_SCOOTERS].find(m=>m.id===ai.alt_model_id);
      aiAlt.textContent = alt ? `Suggestion: ${alt.brand} ${alt.model}` : '';
    } else { aiAlt.textContent=''; }
    window.__aiShareLine = ai.share_line || '';
  }

  async function runAiQuick(){
    if (!active){ alert('Pick a model first'); return; }
    const scenario=getScenario(); const models=[...DATA()]; // same-type models only
    const ai = localAi(scenario, models); // deterministic, guarded
    applyAi(ai, models);
  }

  // ---------- Share card (same as earlier build)
  $('#shareBtn').addEventListener('click',()=>openShare('cost'));
  $('#openShare').addEventListener('click',()=>openShare('cost'));
  $('#shareClose').addEventListener('click',()=>closeOverlay(shareOv));
  $('#dlPng').addEventListener('click',()=>{
    shareCv.toBlob(b=>{
      if(!b){alert('Could not render image');return;}
      const url=URL.createObjectURL(b);
      const a=document.createElement('a'); a.href=url; a.download="EV-Cost-Card-Mobile.png";
      document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},600);
    },'image/png');
  });
  $('#openNew').addEventListener('click',()=>{ shareCv.toBlob(b=>{ if(!b)return; const url=URL.createObjectURL(b); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),4000);},'image/png'); });
  $('#copyB64').addEventListener('click',()=>{ const b64=shareCv.toDataURL('image/png'); (navigator.clipboard&&navigator.clipboard.writeText)?navigator.clipboard.writeText(b64).then(()=>alert('Base64 copied ✅')).catch(()=>{ prompt('Copy this Base64:', b64); }):prompt('Copy this Base64:', b64); });

  function openShare(mode){
    // very-light share template (re-using numbers)
    drawShare();
    openOverlay(shareOv);
  }

  function drawShare(){
    if(!active) return;
    const c=window.__calcCache||{}; const city=($('#citySel option:checked')||{}).textContent||'—';
    const w=1080,h=1920; sctx.clearRect(0,0,w,h);
    const g1=sctx.createLinearGradient(0,0,0,h); g1.addColorStop(0,'#0b1220'); g1.addColorStop(.6,'#0a0f1a'); g1.addColorStop(1,'#080c15'); sctx.fillStyle=g1; sctx.fillRect(0,0,w,h);
    sctx.fillStyle='#e2e8f0'; sctx.font='700 28px Inter, system-ui'; sctx.fillText('EV Cost Advisor — India',56,72);
    sctx.fillStyle='#ffffff'; sctx.font='900 64px Inter, system-ui'; sctx.fillText(`${active.brand} ${active.model}`,56,160);
    sctx.fillStyle='#93c5fd'; sctx.font='26px Inter, system-ui'; sctx.fillText(`${active.segment} • ${c.dailyKm||0} km/day • Petrol ₹${Math.round(c.petrol||0)}/L • ${city}`,56,210);
    const tile=(y,color,label,value)=>{ sctx.save(); sctx.translate(56,y); sctx.fillStyle=color; roundRect(sctx,0,0,1080-112,210,26,true,false);
      const sh=sctx.createLinearGradient(0,0,1080-112,0); sh.addColorStop(0,'rgba(255,255,255,.06)'); sh.addColorStop(.3,'rgba(255,255,255,0)'); sh.addColorStop(1,'rgba(255,255,255,0)');
      sctx.fillStyle=sh; roundRect(sctx,0,0,1080-112,210,26,true,false);
      sctx.fillStyle='rgba(255,255,255,.9)'; sctx.font='18px Inter, system-ui'; sctx.fillText(label.toUpperCase(),24,48);
      sctx.fillStyle='#fff'; sctx.font='900 64px Inter, system-ui'; sctx.fillText(value,24,132);
      sctx.restore();
    };
    tile(260,'#059669','Cost per day (EV)', inr(c.perDayEV||0));
    tile(510,'#dc2626','Cost per day (Petrol)', inr(c.perDayICE||0));
    sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly running cost',56,780);
    sctx.fillStyle='#a7f3d0'; sctx.font='700 36px Inter, system-ui';
    sctx.fillText(`EV ${inr(c.mEV||0)}  •  Petrol ${inr(c.mICE||0)}`,56,828);
    sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly savings',56,888);
    sctx.fillStyle='#a7f3d0'; sctx.font='900 54px Inter, system-ui'; sctx.fillText(inr((c.mICE-c.mEV)||0),56,948);
    if(window.__aiShareLine && $('#aiAddShare').checked){
      sctx.fillStyle='#d1fae5'; sctx.font='26px Inter, system-ui'; sctx.fillText(window.__aiShareLine,56,1010);
    }
    sctx.fillStyle='#94a3b8'; sctx.font='24px Inter, system-ui'; sctx.fillText('evcost.in • shareable',56,1920-72);
  }
  function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke(); }

  // ---------- Search + Tabs
  $('#tab-cars').addEventListener('click',()=>{tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList();});
  $('#tab-scooters').addEventListener('click',()=>{tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList();});
  $('#q').addEventListener('input',e=>{q=e.target.value; renderList();});

  // ---------- Boot
  renderList();
})();
