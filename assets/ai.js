/* AI logic only: on-road estimate + local recommendation (deterministic) */
(function(){
  const ONROAD_RULES = {
    "Delhi":{roadTax:0.00, reg:0.01, ins:0.025},
    "Maharashtra":{roadTax:0.07, reg:0.01, ins:0.03},
    "Karnataka":{roadTax:0.06, reg:0.01, ins:0.03},
    "Tamil Nadu":{roadTax:0.05, reg:0.01, ins:0.03},
    "West Bengal":{roadTax:0.06, reg:0.01, ins:0.03},
    "Telangana":{roadTax:0.06, reg:0.01, ins:0.03},
    "Kerala":{roadTax:0.06, reg:0.01, ins:0.03},
    "Gujarat":{roadTax:0.04, reg:0.01, ins:0.03},
    "Rajasthan":{roadTax:0.06, reg:0.01, ins:0.03},
    "Punjab":{roadTax:0.05, reg:0.01, ins:0.03},
    "Haryana":{roadTax:0.00, reg:0.01, ins:0.03},
    "Uttar Pradesh":{roadTax:0.03, reg:0.01, ins:0.03},
    "Madhya Pradesh":{roadTax:0.05, reg:0.01, ins:0.03},
    "Bihar":{roadTax:0.05, reg:0.01, ins:0.03},
    "Jharkhand":{roadTax:0.05, reg:0.01, ins:0.03},
    "Odisha":{roadTax:0.05, reg:0.01, ins:0.03},
    "Andhra Pradesh":{roadTax:0.06, reg:0.01, ins:0.03},
    "Assam":{roadTax:0.05, reg:0.01, ins:0.03},
    "Uttarakhand":{roadTax:0.04, reg:0.01, ins:0.03},
    "Chandigarh":{roadTax:0.00, reg:0.01, ins:0.03},
    "_default":{roadTax:0.05, reg:0.01, ins:0.03}
  };

  function estimateOnRoad(model, cityName){
    const ex = (model.price_lakh||0)*100000;
    const state = (window.CITY_TO_STATE||{})[cityName] || '—';
    const rule = ONROAD_RULES[state] || ONROAD_RULES._default;
    const onroad = Math.round(ex + ex*rule.roadTax + ex*rule.reg + ex*rule.ins);
    return {onroad, ex, rule, state};
  }

  function localAi(scenario, pool, computeCosts){
    const byId = Object.fromEntries(pool.map(m=>[m.id,m]));
    const sel = byId[scenario.id] || pool[0];
    const selectedCosts = computeCosts(sel, scenario);

    // peers: same segment & ±20% price if possible
    const band=[sel.price_lakh*0.8, sel.price_lakh*1.2];
    const peersRaw = pool.filter(x=>x.id!==sel.id && x.segment===sel.segment && x.price_lakh>=band[0] && x.price_lakh<=band[1]);
    const peers = (peersRaw.length?peersRaw:pool.filter(x=>x.id!==sel.id))
      .map(m=>({ id:m.id, item:m, mEV:computeCosts(m,scenario).mEV }))
      .sort((a,b)=>a.mEV-b.mEV);

    const better = peers.find(p=>p.mEV < selectedCosts.mEV);
    const or = estimateOnRoad(sel, scenario.cityName);

    const kmpl = (window.BENCH_KMPL||{})[sel.segment]||15;
    const perDaySave = Math.max(0, selectedCosts.perDayICE - selectedCosts.perDayEV);

    return {
      verdict: better ? 'try_alternative' : 'best_pick',
      alt_model_id: better?.id || '',
      reasons: [
        `~₹${Math.round(perDaySave)} per-day fuel saving at your inputs`,
        `${scenario.kmPerDay} km/day × ${scenario.daysPerMonth} days → EV ${fmt(selectedCosts.mEV)} / Petrol ${fmt(selectedCosts.mICE)}`,
        `Petrol calc uses ${kmpl} km/L for ${sel.segment}`
      ],
      onroad: or,
      share_line: better
        ? `Try ${better.item.brand} ${better.item.model}: lower monthly EV cost vs your pick`
        : `${sel.brand} ${sel.model}: est. on-road in ${scenario.cityName} ${fmt(or.onroad)}; strong fuel savings vs petrol`
    };
  }

  function fmt(n){ return (!isFinite(n)||n===Infinity)?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(n)); }

  window.AI = { estimateOnRoad, localAi, ONROAD_RULES };
})();
