// netlify/functions/ai-quick.js
import OpenAI from "openai";

const VERSION = "ai-quick/2025-08-17.4";
const hasKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

const BENCH_KMPL = {
  "City car": 20, Hatchback: 17, "Compact SUV": 16, Sedan: 16, SUV: 14, Crossover: 12, "MPV/SUV": 15, Scooter: 50
};

const ok = (json) => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(json),
});

function computePeersAndNumbers(input) {
  const scenario = input?.scenario || {};
  const models = Array.isArray(input?.models) ? input.models : [];
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  const selBase = byId[scenario.id];
  if (!selBase) return { selected: null, peers: [], numbers: null };

  const km = +scenario.kmPerDay || 0;
  const dpm = +scenario.daysPerMonth || 26;
  const petrol = +scenario.petrolPerL || 100;
  const tariff = +scenario.tariff || 7;

  const all = models.map((m) => {
    const kmpl = BENCH_KMPL[m.segment] ?? 15;
    const evPerKm = (m.eff_kwh_per_100km / 100) * tariff * 1.12;
    const icePerKm = petrol / Math.max(1, kmpl);
    const perDayEV = evPerKm * km;
    const perDayICE = icePerKm * km;
    return {
      id: m.id, brand: m.brand, model: m.model, price_lakh: +m.price_lakh || 0, segment: m.segment,
      perDayEV, perDayICE, monthlyEV: perDayEV * dpm, monthlyICE: perDayICE * dpm
    };
  });

  const selected = all.find((x) => x.id === selBase.id);
  const sameSeg = all.filter((x) =>
    x.id !== selected.id &&
    x.segment === selBase.segment &&
    Math.abs(x.price_lakh - selBase.price_lakh) <= selBase.price_lakh * 0.15
  );
  const peers = (sameSeg.length ? sameSeg
    : all.filter((x) => x.id !== selected.id)
        .sort((a, b) => Math.abs(a.price_lakh - selBase.price_lakh) - Math.abs(b.price_lakh - selBase.price_lakh))
        .slice(0, 3))
    .sort((a, b) => a.monthlyEV - b.monthlyEV)
    .slice(0, 3);

  const numbers = {
    per_day_ev: selected.perDayEV,
    per_day_petrol: selected.perDayICE,
    monthly_ev: selected.monthlyEV,
    monthly_petrol: selected.monthlyICE,
    monthly_savings: selected.monthlyICE - selected.monthlyEV,
    emi_coverage_pct: 0,
  };

  return { selected, peers, numbers };
}

function validateAndFill(ai, numbers) {
  const out = ai && typeof ai === "object" ? { ...ai } : {};
  if (!out.verdict) out.verdict = "best_pick";
  if (!Array.isArray(out.reasons)) out.reasons = [];
  if (!out.share_line) out.share_line = "Best pick based on monthly EV cost vs peers.";
  if (!out.alt_model_id) out.alt_model_id = "";
  out.key_numbers = {
    per_day_ev:       +(out.key_numbers?.per_day_ev       ?? numbers?.per_day_ev       ?? 0),
    per_day_petrol:   +(out.key_numbers?.per_day_petrol   ?? numbers?.per_day_petrol   ?? 0),
    monthly_ev:       +(out.key_numbers?.monthly_ev       ?? numbers?.monthly_ev       ?? 0),
    monthly_petrol:   +(out.key_numbers?.monthly_petrol   ?? numbers?.monthly_petrol   ?? 0),
    monthly_savings:  +(out.key_numbers?.monthly_savings  ?? numbers?.monthly_savings  ?? 0),
    emi_coverage_pct: +(out.key_numbers?.emi_coverage_pct ?? numbers?.emi_coverage_pct ?? 0),
  };
  return out;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};

  // In-browser diagnostics (no Netlify logs needed)
  if (event.httpMethod === "GET" && qs.diag === "version") {
    return ok({ ok: true, version: VERSION, hasKey, node: process.version });
  }

  try {
    const input = JSON.parse(event.body || "{}");
    const { selected, peers, numbers } = computePeersAndNumbers(input);

    if (!hasKey) {
      return ok({
        source: "fallback", why: "no_api_key",
        verdict: "best_pick", alt_model_id: "", reasons: ["No API key"],
        key_numbers: numbers, share_line: "Best pick based on monthly EV cost vs peers.",
      });
    }

    const sys = "You are EV Advisor for India. Use ONLY numbers and models provided. "
      + "Return STRICT JSON with fields: verdict, alt_model_id, reasons[], "
      + "key_numbers{per_day_ev,per_day_petrol,monthly_ev,monthly_petrol,monthly_savings,emi_coverage_pct}, share_line. "
      + "Be concise and friendly. If unsure, base on given numbers.";

    const user = { selected, peers, numbers, language: "en", add_hindi_tag: true };

    // Chat Completions → JSON mode (most reliable)
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 350,
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "{}";
    let ai; try { ai = JSON.parse(text); } catch (e) { ai = null; }
    if (!ai) throw new Error("json_parse_failed");

    const validated = validateAndFill(ai, numbers);
    return ok({ source: "openai", ...validated });
  } catch (err) {
    // Return the error string so you can see it in the browser (no logs needed)
    let numbers = null;
    try { numbers = computePeersAndNumbers(JSON.parse(event.body || "{}")).numbers; } catch {}
    return ok({
      source: "fallback", why: "error",
      error: (err && err.message) || String(err),
      verdict: "best_pick", alt_model_id: "", reasons: ["Deterministic fallback"],
      key_numbers: numbers, share_line: "Best pick based on monthly EV cost vs peers.",
    });
  }
}