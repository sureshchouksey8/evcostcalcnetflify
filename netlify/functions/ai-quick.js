// netlify/functions/ai-quick.js
import OpenAI from "openai";

const hasKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
const client = new OpenAI({ apiKey: hasKey ? process.env.OPENAI_API_KEY : "" });

const BENCH_KMPL = { "City car":20,Hatchback:17,"Compact SUV":16,Sedan:16,SUV:14,Crossover:12,"MPV/SUV":15,Scooter:50 };

function computePeersAndNumbers(input){
  const scenario = input?.scenario || {}; const models = Array.isArray(input?.models) ? input.models : [];
  const byId = Object.fromEntries(models.map(m=>[m.id,m])); const rawSel = byId[scenario.id]; if(!rawSel) return {selected:null,peers:[],numbers:null};
  const km=+scenario.kmPerDay||0, dpm=+scenario.daysPerMonth||26, petrol=+scenario.petrolPerL||100, tariff=+scenario.tariff||7;
  const all=models.map(m=>{ const kmpl=BENCH_KMPL[m.segment]??15;
    const evPerKm=(m.eff_kwh_per_100km/100)*tariff*1.12; const icePerKm=petrol/Math.max(1,kmpl);
    const perDayEV=evPerKm*km, perDayICE=icePerKm*km;
    return {id:m.id,brand:m.brand,model:m.model,price_lakh:+m.price_lakh||0,segment:m.segment,
      perDayEV,perDayICE,monthlyEV:perDayEV*dpm,monthlyICE:perDayICE*dpm};});
  const selected=all.find(x=>x.id===rawSel.id);
  const sameSeg=all.filter(x=>x.id!==selected.id&&x.segment===rawSel.segment&&Math.abs(x.price_lakh-rawSel.price_lakh)<=rawSel.price_lakh*0.15);
  const peers=(sameSeg.length?sameSeg:all.filter(x=>x.id!==selected.id)).sort((a,b)=>a.monthlyEV-b.monthlyEV).slice(0,3);
  const numbers={per_day_ev:selected.perDayEV,per_day_petrol:selected.perDayICE,monthly_ev:selected.monthlyEV,monthly_petrol:selected.monthlyICE,monthly_savings:selected.monthlyICE-selected.monthlyEV,emi_coverage_pct:0};
  return {selected,peers,numbers};
}

const ok = (json)=>({statusCode:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(json)});

export async function handler(event){
  // --- quick diagnostic: GET /.netlify/functions/ai-quick?diag=1
  const q = event.queryStringParameters || {};
  if (event.httpMethod === "GET" && q.diag === "1") {
    return ok({ ok:true, hasKey, node: process.version, site: process.env.URL || null });
  }

  try{
    const input = JSON.parse(event.body||"{}");
    const { selected, peers, numbers } = computePeersAndNumbers(input);

    if (!hasKey) {
      return ok({ source:"fallback", why:"no_api_key", verdict:"best_pick", alt_model_id:"", reasons:["No API key at runtime"], key_numbers:numbers, share_line:"Best pick based on monthly EV cost vs peers." });
    }

    // Strict schema for structured output
    const schema = {
      type:"object",
      properties:{
        verdict:{ enum:["best_pick","try_alternative"] },
        alt_model_id:{ type:"string" },
        reasons:{ type:"array", items:{ type:"string" }, maxItems:3 },
        key_numbers:{ type:"object", properties:{
          per_day_ev:{type:"number"}, per_day_petrol:{type:"number"}, monthly_ev:{type:"number"},
          monthly_petrol:{type:"number"}, monthly_savings:{type:"number"}, emi_coverage_pct:{type:"number"}
        }, required:["per_day_ev","per_day_petrol","monthly_ev","monthly_petrol","monthly_savings"] },
        share_line:{ type:"string", maxLength:120 }
      },
      required:["verdict","reasons","key_numbers","share_line"]
    };

    const sys="You are EV Advisor for India. Use ONLY numbers and models provided. Return STRICT JSON per schema. Be concise.";
    const user={selected,peers,numbers,language:"en",add_hindi_tag:true};

    const resp = await client.responses.create({
      model:"gpt-4o-mini",
      input:[{role:"system",content:sys},{role:"user",content:JSON.stringify(user)}],
      response_format:{type:"json_schema",json_schema:{name:"AiQuick",schema}}
    });

    // Robust extraction
    let ai=null; const c0=resp?.output?.[0]?.content?.[0];
    if (c0?.type==="output_json" && c0?.json) ai=c0.json;
    else if (typeof c0?.text==="string") ai=JSON.parse(c0.text);
    else if (typeof resp?.output_text==="string") ai=JSON.parse(resp.output_text);

    if(!ai||!ai.verdict) throw new Error("AI parse failed");
    return ok({ source:"openai", ...ai });
  }catch(err){
    console.error("ai-quick error:", err?.message||String(err));
    return ok({ source:"fallback", why:"error", verdict:"best_pick", alt_model_id:"", reasons:["Deterministic fallback"], key_numbers:null, share_line:"Best pick based on monthly EV cost vs peers." });
  }
}
