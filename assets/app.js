(function(){
  const {BENCH_KMPL, MODELS_CARS, MODELS_SCOOTERS, CITY_PRESETS, IMG_MAP} = window.DATA;

  // -------- helpers
  const $=s=>document.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const inr=n=>(!isFinite(n)||n===Infinity)?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n));
  function lockScroll(){ document.documentElement.style.overflow='hidden'; }
  function unlockScroll(){ document.documentElement.style.overflow='auto'; }

  // -------- state
  let tab='cars', q='', active=null;
  const DATA=()=> tab==='cars'?MODELS_CARS:MODELS_SCOOTERS;

  // -------- list render
  function renderList(){
    const items=DATA().filter(m=>{
      if(!q)return true; const s=(m.brand+" "+m.model+" "+m.segment).toLowerCase();
      return s.includes(q.toLowerCase());
    });
    $('#resultCount').textContent = `${items.length} result${items.length===1?'':'s'}`;
    const grid=$('#grid'); grid.innerHTML='';
    items.forEach(m=>{
      const card=document.createElement('button'); card.className='card';
      const t1=document.createElement('div'); t1.textContent=`${m.brand} ${m.model}`; t1.className='bold'; t1.style.fontSize='18px';
      const t2=document.createElement('div'); t2.textContent=`${m.segment} • ${m.range_km} km est. range`; t2.className='small muted mt8';
      const t3=document.createElement('div'); t3.className='small mt8'; t3.innerHTML = `<span class="muted">Ex-showroom:</span> <span class="bold" style="color:#15803d">${inr((m.price_lakh||0)*100000)}</span>`;
      card.append(t1,t2,t3);
      card.addEventListener('click',()=>openCalc(m));
      grid.appendChild(card);
    });
  }

  // -------- cost calc helpers
  function costFor(m, dailyKm, dpm, petrol, tariff){
    const kmpl = BENCH_KMPL[m.segment] ?? 15;
    const evPerKm = (m.eff_kwh_per_100km/100) * tariff * 1.12;
    const icePerKm = petrol / Math.max(1,kmpl);
    const perDayEV=evPerKm*dailyKm, perDayICE=icePerKm*dailyKm;
    return {
      kmpl, perDayEV, perDayICE,
      mEV: perDayEV*dpm,
      mICE: perDayICE*dpm,
      evPerKm, icePerKm, dailyKm, dpm, petrol, tariff
    };
  }

  // -------- overlay helpers
  function show(id){ $(id).classList.add('show'); lockScroll(); }
  function hide(id){ $(id).classList.remove('show'); unlockScroll(); }
  function hookOverlayClose(overlaySel, closeSel){
    $(closeSel).addEventListener('click',()=>hide(overlaySel));
    $(overlaySel).addEventListener('click', (e)=>{ if(e.target===e.currentTarget) hide(overlaySel); });
    document.addEventListener('keydown', (e)=>{ if($(overlaySel).classList.contains('show') && e.key==='Escape') hide(overlaySel); });
  }

  // -------- calculator wiring
  const overlay=$('#overlay'),
        citySel=$('#citySel'), tariffView=$('#tariffView'), petrolIn=$('#petrolIn'),
        kmR=$('#kmRange'), kmVal=$('#kmVal'),
        daysR=$('#daysRange'), daysBadge=$('#daysBadge'),
        perDayEv=$('#perDayEv'), perDayIce=$('#perDayIce'),
        kmNoteEv=$('#kmNoteEv'), kmNoteIce=$('#kmNoteIce'),
        monthlyPair=$('#monthlyPair'), yearlyPair=$('#yearlyPair'),
        barEvM=$('#barEvM'), barIceM=$('#barIceM'), barEvY=$('#barEvY'), barIceY=$('#barIceY'),
        gProg=$('#gProg'), gLabel=$('#gLabel'), modelName=$('#modelName'), modelInfo=$('#modelInfo'), goodFit=$('#goodFit'),
        modelPhoto=$('#modelPhoto'),
        aiPanel=$('#aiPanel'), aiVerdict=$('#aiVerdict'), aiReasons=$('#aiReasons'), aiAlt=$('#aiAlt'), aiAddShare=$('#aiAddShare'),
        modelSwitcher=$('#modelSwitcher'), prevModel=$('#prevModel'), nextModel=$('#nextModel');

  CITY_PRESETS.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; citySel.appendChild(o); });

  function openCalc(m){
    active=m;
    // Default city Gurugram if available
    const c = CITY_PRESETS.find(x=>x.id==='gurugram') || CITY_PRESETS[0] || {tariff:7,petrol:100};
    citySel.value=c.id; tariffView.textContent=c.tariff.toFixed(1); petrolIn.value=c.petrol;
    kmR.value=20; kmVal.textContent='20';
    daysR.value=26; daysBadge.textContent='26 days';
    modelName.textContent=`${m.brand} ${m.model}`;
    modelInfo.textContent=`${m.segment} • ${m.range_km} km est. range`;
    // photo
    const file = IMG_MAP[m.id];
    if(file){ modelPhoto.src = `assets/img/${file}`; modelPhoto.style.display='block'; } else { modelPhoto.removeAttribute('src'); modelPhoto.style.display='none'; }
    // model switcher list
    modelSwitcher.innerHTML = '';
    DATA().forEach(x=>{ const o=document.createElement('option'); o.value=x.id; o.textContent=`${x.brand} ${x.model}`; modelSwitcher.appendChild(o); });
    modelSwitcher.value=m.id;
    aiPanel.style.display='none'; aiPanel.className=''; aiAddShare.checked=false; aiVerdict.textContent='AI analysis'; aiReasons.textContent=''; aiAlt.textContent='';
    show('#overlay'); compute();
  }

  // switching
  modelSwitcher.addEventListener('change',()=>{
    const m = DATA().find(x=>x.id===modelSwitcher.value);
    if(m) openCalc(m);
  });
  function moveModel(delta){
    const list=DATA(); const idx=list.findIndex(x=>x.id===active?.id);
    const next = list[(idx + delta + list.length) % list.length];
    if(next) openCalc(next);
  }
  prevModel.addEventListener('click',()=>moveModel(-1));
  nextModel.addEventListener('click',()=>moveModel(1));

  function compute(){
    if(!active) return;
    const tariff = parseFloat(tariffView.textContent)||0;
    const petrol = parseFloat(petrolIn.value)||0;
    const dailyKm = parseInt(kmR.value,10)||0;
    const dpm = parseInt(daysR.value,10)||0;

    const c=costFor(active,dailyKm,dpm,petrol,tariff);
    perDayEv.textContent=inr(c.perDayEV);
    perDayIce.textContent=inr(c.perDayICE);
    kmNoteEv.textContent=`For ${c.dailyKm} km/day`;
    kmNoteIce.textContent=`For ${c.dailyKm} km/day`;

    monthlyPair.textContent=`EV ${inr(c.mEV)} • Petrol ${inr(c.mICE)}`;
    yearlyPair.textContent=`EV ${inr(c.mEV*12)} • Petrol ${inr(c.mICE*12)}`;
    const totalM=Math.max(c.mEV,c.mICE,1); barEvM.style.width=(c.mEV/totalM*100)+'%'; barIceM.style.width=(c.mICE/totalM*100)+'%';
    const totalY=Math.max(c.mEV*12,c.mICE*12,1); barEvY.style.width=(c.mEV*12/totalY*100)+'%'; barIceY.style.width=(c.mICE*12/totalY*100)+'%';

    let pct = (c.perDayICE>0)?((c.perDayICE-c.perDayEV)/c.perDayICE)*100:0;
    pct=Math.max(-100,Math.min(100,pct));
    const circ=2*Math.PI*50, prog=Math.max(0,Math.min(1,pct/100));
    gProg.setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog));
    gProg.setAttribute('stroke', pct<0 ? '#ef4444' : (pct<10 ? '#f59e0b' : '#16a34a'));
    gLabel.textContent=(isFinite(pct)?Math.round(pct):0)+'%';
    $('#gSub').textContent='Savings vs petrol';

    $('#saveMonth').textContent=inr(c.mICE-c.mEV);
    goodFit.style.display=(pct>=20 && (c.mICE-c.mEV)>1500)?'inline-flex':'none';

    window.__calcCache={...c, monthlySavings:(c.mICE-c.mEV)};
  }

  // Inputs
  citySel.addEventListener('change',()=>{ const c=CITY_PRESETS.find(x=>x.id===citySel.value); if(c){ tariffView.textContent=c.tariff.toFixed(1); petrolIn.value=c.petrol; compute(); }});
  petrolIn.addEventListener('input',compute);
  kmR.addEventListener('input',()=>{ kmVal.textContent=kmR.value; compute(); });
  daysR.addEventListener('input',()=>{ daysBadge.textContent=daysR.value+' days'; compute(); });

  // open/close handlers
  $('#shareBtn').addEventListener('click',()=>$('#openShare').click());
  $('#closeBtn').addEventListener('click',()=>hide('#overlay'));
  hookOverlayClose('#overlay','#closeBtn');

  // Tabs & search
  $('#tab-cars').addEventListener('click',()=>{ tab='cars'; $('#tab-cars').classList.add('active'); $('#tab-scooters').classList.remove('active'); renderList(); });
  $('#tab-scooters').addEventListener('click',()=>{ tab='scooters'; $('#tab-scooters').classList.add('active'); $('#tab-cars').classList.remove('active'); renderList(); });
  $('#q').addEventListener('input',e=>{ q=e.target.value; renderList(); });

  // ----- Compare modal (carousel)
  const cmpOv=$('#compareOverlay'), cmpTrack=$('#cmpTrack');
  function peersFor(m){
    const list = tab==='cars'? MODELS_CARS : MODELS_SCOOTERS;
    const price=+m.price_lakh||0;
    const band=list.filter(x=>x.segment===m.segment && x.id!==m.id && Math.abs(x.price_lakh-price)<=price*0.20);
    const fallback=list.filter(x=>x.id!==m.id);
    const set=(band.length?band:fallback).slice().sort((a,b)=>{
      // rank by monthly EV cost for current scenario
      const c1=costFor(a, (+kmR.value||20), (+daysR.value||26), (+petrolIn.value||100), (+tariffView.textContent||7));
      const c2=costFor(b, (+kmR.value||20), (+daysR.value||26), (+petrolIn.value||100), (+tariffView.textContent||7));
      return c1.mEV - c2.mEV;
    });
    return set.slice(0,8);
  }
  function buildCmp(){
    cmpTrack.innerHTML='';
    const list=peersFor(active);
    list.forEach(p=>{
      const card=document.createElement('div'); card.className='cmpCard';
      const img=document.createElement('img');
      const file=IMG_MAP[p.id]; if(file){ img.src=`assets/img/${file}`; } else { img.style.display='none'; }
      const nm=document.createElement('div'); nm.className='nm'; nm.textContent = `${p.brand} ${p.model}`;
      const meta=document.createElement('div'); meta.className='small muted'; meta.textContent = `${p.segment} • ₹${(p.price_lakh||0).toFixed(2)}L`;
      const c=costFor(p, (+kmR.value||20), (+daysR.value||26), (+petrolIn.value||100), (+tariffView.textContent||7));
      const runs=document.createElement('div'); runs.className='small mt8'; runs.innerHTML = `EV <b>${inr(c.mEV)}</b> • Petrol <b>${inr(c.mICE)}</b>`;
      const setBtn=document.createElement('button'); setBtn.className='button primary mt8'; setBtn.textContent='Set as selection';
      setBtn.addEventListener('click',()=>{ hide('#compareOverlay'); openCalc(p); });
      card.append(img,nm,meta,runs,setBtn);
      cmpTrack.appendChild(card);
    });
  }
  $('#compareBtn').addEventListener('click',()=>{ if(!active){alert('Pick a model first');return;} buildCmp(); show('#compareOverlay'); });
  hookOverlayClose('#compareOverlay','#cmpClose');
  $('#cmpPrev').addEventListener('click',()=>cmpTrack.scrollBy({left:-340,behavior:'smooth'}));
  $('#cmpNext').addEventListener('click',()=>cmpTrack.scrollBy({left:340,behavior:'smooth'}));

  // ----- AI (with sanity filters + deterministic fallback)
  $('#aiBtn').addEventListener('click', runAiQuick);
  function priceBand(id){
    const all=[...MODELS_CARS, ...MODELS_SCOOTERS];
    const m=all.find(x=>x.id===id); if(!m) return {min:0,max:Infinity,type:'car'};
    const type = MODELS_CARS.includes(m) ? 'car' : 'scooter';
    const price=(+m.price_lakh||0);
    const band = price<=10? {min:0,max:12} :
                 price<=20? {min:12,max:24} :
                 price<=35? {min:20,max:40} :
                 {min:35,max:Infinity};
    return {...band,type};
  }
  async function runAiQuick(){
    if(!active){alert('Pick a model first');return;}
    const c=window.__calcCache||{}; const scenario={
      id: active.id,
      kmPerDay:c.dailyKm||(+kmR.value||0),
      daysPerMonth:c.dpm||(+daysR.value||26),
      petrolPerL:c.petrol||(+petrolIn.value||100),
      tariff:c.tariff||(+tariffView.textContent||7)
    };
    aiPanel.style.display='block'; aiPanel.className=''; aiVerdict.textContent='Analyzing…'; aiReasons.textContent=''; aiAlt.textContent=''; window.__aiShareLine='';
    try{
      // Hard filters before calling backend
      const band=priceBand(scenario.id);
      const sameType = (tab==='cars') ? MODELS_CARS : MODELS_SCOOTERS;
      const peers = sameType.filter(x=>{
        const p=+x.price_lakh||0;
        return p>=band.min && p<=band.max;
      });
      const body={scenario,models:peers};
      const r = await fetch('/api/ai/quick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok) throw new Error('no backend');
      const ai=await r.json(); applyAi(ai,peers);
    }catch{
      const peers = tab==='cars' ? MODELS_CARS : MODELS_SCOOTERS;
      const ai=localAi(scenario,peers);
      applyAi(ai,peers);
    }
  }
  function applyAi(ai, models){
    // never suggest scooters when tab is cars and vice versa
    const validList = tab==='cars' ? MODELS_CARS : MODELS_SCOOTERS;
    if(ai.alt_model_id && !validList.find(m=>m.id===ai.alt_model_id)){
      ai.alt_model_id = ''; // drop cross-type suggestion
    }
    aiVerdict.textContent = (ai.verdict==='try_alternative') ? '👉 Try an alternative' : '✅ Best pick';
    aiPanel.className = (ai.verdict==='try_alternative') ? 'try' : 'good';
    aiPanel.style.display='block';
    const reasons=(ai.reasons||[]).slice(0,3);
    aiReasons.innerHTML = '<ul class="small" style="margin:6px 0 0 18px">'+reasons.map(r=>`<li>${r}</li>`).join('')+'</ul>';
    aiAlt.textContent = ai.alt_model_id ? (()=>{ const m=models.find(x=>x.id===ai.alt_model_id); return m?`Suggestion: ${m.brand} ${m.model}`:''; })() : '';
    // share line must not mention scooters for cars
    window.__aiShareLine = (tab==='cars' && /scooter/i.test(ai.share_line||'')) ? '' : (ai.share_line||'');
  }
  function localAi(scenario, models){
    const byId=Object.fromEntries(models.map(m=>[m.id,m])); const sel=byId[scenario.id];
    const km=+scenario.kmPerDay||0, dpm=+scenario.daysPerMonth||26, petrol=+scenario.petrolPerL||100, tariff=+scenario.tariff||7;
    function calc(m){ const kmpl=BENCH_KMPL[m.segment]??15; const evPerKm=(m.eff_kwh_per_100km/100)*tariff*1.12; const icePerKm=petrol/Math.max(1,kmpl); const perDayEV=evPerKm*km; const perDayICE=icePerKm*km; return { id:m.id, monthlyEV:perDayEV*dpm, brand:m.brand, model:m.model, price_lakh:m.price_lakh, segment:m.segment }; }
    const all=models.map(calc); const selected=all.find(x=>x.id===sel.id);
    // price-banded peers (±15%)
    const peers1=all.filter(x=>x.id!==sel.id && Math.abs(x.price_lakh-sel.price_lakh)<=sel.price_lakh*0.15);
    const peers=(peers1.length?peers1:all.filter(x=>x.id!==sel.id)).sort((a,b)=>a.monthlyEV-b.monthlyEV).slice(0,3);
    const best=peers[0] && (peers[0].monthlyEV < selected.monthlyEV ? peers[0] : null);
    return {
      verdict: best? 'try_alternative' : 'best_pick',
      alt_model_id: best? best.id : '',
      reasons: best? ['Lower monthly EV cost'] : ['Your pick has one of the lowest monthly EV costs'],
      share_line: best? `Try ${best.brand} ${best.model}: lower monthly EV cost` : `Best pick: strong monthly savings vs petrol`
    };
  }

  // ----- Share
  const shareOv=$('#shareOverlay'), shareCv=$('#shareCanvas'), sctx=shareCv.getContext('2d'); let shareMode='cost';
  function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill)ctx.fill(); if(stroke)ctx.stroke(); }
  function badge(x,y,text){ sctx.save(); const pad=14; sctx.font='20px Inter, system-ui'; const w=sctx.measureText(text).width+pad*2; sctx.fillStyle='rgba(203,213,225,.25)'; roundRect(sctx,x,y,w,42,21,true,false); sctx.fillStyle='#e5e7eb'; sctx.fillText(text,x+pad,y+28); sctx.restore(); }
  function drawShare(){
    if(!active) return;
    const c=window.__calcCache||{}; const city=($('#citySel option:checked')||{}).textContent||'—';
    const w=1080,h=1920; sctx.clearRect(0,0,w,h);
    const g1=sctx.createLinearGradient(0,0,0,h); g1.addColorStop(0,'#0b1220'); g1.addColorStop(.6,'#0a0f1a'); g1.addColorStop(1,'#080c15'); sctx.fillStyle=g1; sctx.fillRect(0,0,w,h);
    function logo(x,y){ const lg=sctx.createLinearGradient(x,y,x+40,y+40); lg.addColorStop(0,'#34d399'); lg.addColorStop(1,'#22d3ee'); sctx.strokeStyle=lg; sctx.fillStyle='rgba(52,211,153,.18)'; sctx.lineWidth=3; sctx.beginPath(); sctx.arc(x+20,y+20,20,0,Math.PI*2); sctx.fill(); sctx.stroke(); sctx.fillStyle=lg; sctx.beginPath(); sctx.moveTo(x+28,y+4); sctx.lineTo(x+16,y+28); sctx.lineTo(x+26,y+28); sctx.lineTo(x+14,y+48); sctx.lineTo(x+40,y+22); sctx.lineTo(x+28,y+22); sctx.closePath(); sctx.fill(); }
    sctx.save(); sctx.translate(56,56); logo(0,0); sctx.fillStyle='#e2e8f0'; sctx.font='700 26px Inter, system-ui'; sctx.fillText('EV Cost Advisor', 64, 28); sctx.restore();

    // Header chips
    sctx.fillStyle='#d1fae5'; sctx.font='20px Inter, system-ui';
    const cText = city;
    const cityW=sctx.measureText(cText).width+36; roundRect(sctx,1080-56-cityW,56,cityW,44,22,true,true);
    sctx.fillStyle='#0f172a'; sctx.font='700 18px Inter, system-ui'; sctx.fillText(cText,1080-56-cityW+18,56+28);

    const modelLine=`${active.brand} ${active.model}`;
    sctx.fillStyle='#ffffff'; sctx.font='900 72px Inter, system-ui';
    const tw=sctx.measureText(modelLine).width; sctx.fillText(modelLine,(1080-tw)/2,360);

    const cpet=+((window.__calcCache?.petrol)||(+$('#petrolIn').value||0));
    sctx.fillStyle='#93c5fd'; sctx.font='26px Inter, system-ui';
    const sub=`${active.segment} · ${window.__calcCache?.dailyKm||0} km/day · Petrol ₹${Math.round(cpet||0)}/L`;
    const sw=sctx.measureText(sub).width; sctx.fillText(sub,(1080-sw)/2,406);

    const tile=(y,color,label,value)=>{ sctx.save(); sctx.translate(56,y); sctx.fillStyle=color; roundRect(sctx,0,0,1080-112,210,26,true,false);
      const sh=sctx.createLinearGradient(0,0,1080-112,0); sh.addColorStop(0,'rgba(255,255,255,.06)'); sh.addColorStop(.3,'rgba(255,255,255,0)'); sh.addColorStop(1,'rgba(255,255,255,0)');
      sctx.fillStyle=sh; roundRect(sctx,0,0,1080-112,210,26,true,false);
      sctx.fillStyle='rgba(255,255,255,.9)'; sctx.font='18px Inter, system-ui'; sctx.fillText(label.toUpperCase(),24,48);
      sctx.fillStyle='#fff'; sctx.font='900 64px Inter, system-ui'; sctx.fillText(value,24,132);
      sctx.restore();
    };
    const cc=window.__calcCache||{};
    tile(460,'#059669','Cost per day (EV)', inr(cc.perDayEV||0));
    tile(710,'#dc2626','Cost per day (Petrol)', inr(cc.perDayICE||0));

    sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly running cost',56,960);
    sctx.fillStyle='#a7f3d0'; sctx.font='700 36px Inter, system-ui';
    sctx.fillText(`EV ${inr(cc.mEV||0)}  •  Petrol ${inr(cc.mICE||0)}`,56,1008);

    sctx.fillStyle='#cbd5e1'; sctx.font='28px Inter, system-ui'; sctx.fillText('Monthly savings',56,1068);
    sctx.fillStyle='#a7f3d0'; sctx.font='900 54px Inter, system-ui'; sctx.fillText(inr((cc.mICE-cc.mEV)||0),56,1128);

    if($('#aiAddShare').checked && window.__aiShareLine){
      sctx.fillStyle='#d1fae5'; sctx.font='28px Inter, system-ui'; sctx.fillText(window.__aiShareLine,56,1200);
    }

    badge(56,1260,`${cc.dailyKm||0} km/day`);
    badge(300,1260,`${cc.dpm||0} days/mo`);
    badge(520,1260,`Petrol ₹${Math.round(cc.petrol||0)}/L`);

    sctx.fillStyle='#94a3b8'; sctx.font='24px Inter, system-ui';
    sctx.fillText('evcost.in • shareable',56,1920-72);
    sctx.fillText('© '+(new Date().getFullYear())+' EV Cost Advisor',1080-56-460,1920-72);
  }
  function openShareModal(mode){ shareMode=mode||'cost'; show('#shareOverlay'); drawShare(); }
  $('#openShare').addEventListener('click',()=>openShareModal('cost'));
  $('#shareClose').addEventListener('click',()=>hide('#shareOverlay'));
  hookOverlayClose('#shareOverlay','#shareClose');

  $('#dlPng').addEventListener('click',()=>{
    shareCv.toBlob(b=>{
      if(!b){alert('Could not render image');return;}
      const url=URL.createObjectURL(b);
      const a=document.createElement('a'); a.href=url; a.download=(shareMode==='emi'?"EV-EMI-Card":"EV-Cost-Card")+"-Mobile.png";
      document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},600);
    },'image/png');
  });
  $('#openNew').addEventListener('click',()=>{ shareCv.toBlob(b=>{ if(!b)return; const url=URL.createObjectURL(b); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),4000);},'image/png'); });
  $('#copyB64').addEventListener('click',()=>{ const b64=shareCv.toDataURL('image/png'); (navigator.clipboard&&navigator.clipboard.writeText)?navigator.clipboard.writeText(b64).then(()=>alert('Base64 copied ✅')).catch(()=>{ prompt('Copy this Base64:', b64); }):prompt('Copy this Base64:', b64); });

  // ----- Tools (EMI & Litres)
  const toolsOv=$('#toolsOverlay');
  $('#emiBtn').addEventListener('click',()=>{ if(!active){alert('Pick a model first');return;} show('#toolsOverlay'); fillTools(); });
  $('#toolsClose').addEventListener('click',()=>hide('#toolsOverlay'));
  hookOverlayClose('#toolsOverlay','#toolsClose');
  $('#shareEmi').addEventListener('click',()=>{ hide('#toolsOverlay'); openShareModal('emi'); });
  $('#toolsInfo').addEventListener('click',()=>openInfo('emi'));

  function emiCalc(P, annualRatePct, months){ const r=(annualRatePct/100)/12; if(months<=0) return 0; if(r===0) return P/months; const a=Math.pow(1+r,months); return P*r*a/(a-1); }
  function fillTools(){
    const c=window.__calcCache||{}; const monthlyKm=c.dailyKm*c.dpm||0; const kmpl=c.kmpl||15;
    $('#lsKm').textContent=Math.round(monthlyKm);
    $('#lsKmpl').textContent=kmpl+" km/L";
    const litres=kmpl>0?(monthlyKm/kmpl):0;
    $('#lsLitres').textContent=(Math.round(litres*10)/10)+" L";

    const amt=$('#emiAmount'), rate=$('#emiRate'), mon=$('#emiMonths');
    if(!amt.value) amt.value=500000; if(!rate.value) rate.value='9.5'; if(!mon.value) mon.value=60;
    const update=()=>{
      const emi=emiCalc(parseFloat(amt.value||0), parseFloat(rate.value||0), parseInt(mon.value||0));
      const cover = (c.monthlySavings>0 && emi>0) ? Math.max(0, Math.min(100, Math.round(c.monthlySavings/emi*100))) : 0;
      $('#emiOut').textContent=inr(emi);
      $('#savingsOut').textContent=inr(c.monthlySavings||0);
      window.__emiLast={emi:emi};
      const circ=2*Math.PI*50; const prog=cover/100; $('#emiProg').setAttribute('stroke-dasharray',(circ*prog)+' '+(circ-circ*prog)); $('#emiLabel').textContent=cover+'%';
    };
    ['input','change'].forEach(ev=>{ amt.addEventListener(ev,update); rate.addEventListener(ev,update); mon.addEventListener(ev,update); });
    update();
  }

  // ----- Info
  const infoOv=$('#infoOverlay'), infoContent=$('#infoContent');
  function openInfo(which){
    if(which==='emi'){
      $('#infoTitle').textContent='EMI helper — What it means';
      infoContent.innerHTML=`<div class="bold">What is EMI coverage?</div>
      <div class="small mt8">We estimate how much of your monthly EMI can be covered by <b>fuel savings</b> from switching to EV. If your monthly savings are ₹8,000 and EMI is ₹12,000, coverage ≈ 67%.</div>
      <div class="mt16 bold">How we compute</div>
      <ul class="small">
        <li>EMI uses standard amortization with your Amount, Interest %, and Months.</li>
        <li>Fuel savings = Petrol monthly cost − EV monthly cost (from the main calculator).</li>
      </ul>`;
    } else {
      $('#infoTitle').textContent='How costs are calculated';
      infoContent.innerHTML=`<div class="bold">Simple & transparent</div>
      <ul class="small">
        <li><b>EV cost per km</b> = (kWh/100km ÷ 100) × tariff × 1.12 (GST approx).</li>
        <li><b>Petrol cost per km</b> = Petrol ₹/L ÷ segment km/L benchmark.</li>
        <li>Monthly = Per-day × days/month (<b>26</b> default, adjustable).</li>
        <li>City presets set tariff & petrol automatically (you can edit petrol).</li>
      </ul>
      <div class="small mt12">Benchmarks are typical figures; your results may vary with driving style, AC usage, traffic, etc.</div>`;
    }
    show('#infoOverlay');
  }
  $('#infoBtn').addEventListener('click',()=>openInfo('calc'));
  $('#infoClose').addEventListener('click',()=>hide('#infoOverlay'));
  hookOverlayClose('#infoOverlay','#infoClose');

  // ----- Init
  renderList();

})();
