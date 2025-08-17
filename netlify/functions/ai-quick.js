// netlify/functions/ai-quick.js
// ESM module; Netlify will bundle with esbuild.
// Returns strict JSON and never throws (UI always gets a valid JSON shape).

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

const INR = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
      }).format(Math.round(n))
    : "—";

/** Deterministic core numbers for peers & selected model */
function computePeersAndNumbers(input) {
  const scenario = input?.scenario || {};
  const models = Array.isArray(input?.models) ? input.models : [];

  const BENCH_KMPL = {
    "City car": 20,
    Hatchback: 17,
    "Compact SUV": 16,
    Sedan: 16,
    SUV: 14,
    Crossover: 12,
    "MPV/SUV": 15,
    Scooter: 50
  };

  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  const selected = byId[scenario.id];
  if (!selected) {
    return {
      selected: null,
      peers: [],
      numbers: null
    };
  }

  const km = +scenario.kmPerDay || 0;
  const dpm = +scenario.daysPerMonth || 26;
  const petrol = +scenario.petrolPerL || 100;
  const tariff = +scenario.tariff || 7;

  function calc(m) {
    const kmpl = BENCH_KMPL[m.segment] ?? 15;
    const evPerKm = (m.eff_kwh_per_100km / 100) * tariff * 1.12; // GST approx
    const icePerKm = petrol / Math.max(1, kmpl);
    const perDayEV = evPerKm * km;
    const perDayICE = icePerKm * km;
    return {
      id: m.id,
      brand: m.brand,
      model: m.model,
      price_lakh: +m.price_lakh || 0,
      segment: m.segment,
      perDayEV,
      perDayICE,
      monthlyEV: perDayEV * dpm,
      monthlyICE: perDayICE * dpm
    };
  }

  const all = models.map(calc);
  const sel = all.find((x) => x.id === selected.id);

  // Peer rule: same segment & ±15% price; else nearest 3 by price overall
  const sameSeg = all.filter(
    (x) =>
      x.id !== sel.id &&
      x.segment === selected.segment &&
      Math.abs(x.price_lakh - selected.price_lakh) <= selected.price_lakh * 0.15
  );
  const peers =
    sameSeg.length > 0
      ? sameSeg.sort((a, b) => a.monthlyEV - b.monthlyEV).slice(0, 3)
      : all
          .filter((x) => x.id !== sel.id)
          .sort(
            (a, b) => Math.abs(a.price_lakh - selected.price_lakh) - Math.abs(b.price_lakh - selected.price_lakh)
          )
          .slice(0, 3);

  const numbers = {
    per_day_ev: sel.perDayEV,
    per_day_petrol: sel.perDayICE,
    monthly_ev: sel.monthlyEV,
    monthly_petrol: sel.monthlyICE,
    monthly_savings: sel.monthlyICE - sel.monthlyEV,
    emi_coverage_pct: 0 // UI can overwrite after EMI calc
  };

  return { selected: sel, peers, numbers };
}

// --------- Netlify function (named export!) ----------
export async function handler(event) {
  try {
    const input = JSON.parse(event.body || "{}");
    const { selected, peers, numbers } = computePeersAndNumbers(input);

    // If no OpenAI key, return deterministic fallback immediately
    if (!client.apiKey) {
      return ok({
        source: "fallback",
        verdict: "best_pick",
        alt_model_id: "",
        reasons: ["Deterministic mode (no API key)"],
        key_numbers: numbers,
        share_line: "Best pick based on monthly EV cost vs peers."
      });
    }

    // Prepare strict JSON schema for Structured Outputs
    const schema = {
      type: "object",
      properties: {
        verdict: { enum: ["best_pick", "try_alternative"] },
        alt_model_id: { type: "string" },
        reasons: { type: "array", items: { type: "string" }, maxItems: 3 },
        key_numbers: {
          type: "object",
          properties: {
            per_day_ev: { type: "number" },
            per_day_petrol: { type: "number" },
            monthly_ev: { type: "number" },
            monthly_petrol: { type: "number" },
            monthly_savings: { type: "number" },
            emi_coverage_pct: { type: "number" }
          },
          required: ["per_day_ev", "per_day_petrol", "monthly_ev", "monthly_petrol", "monthly_savings"]
        },
        share_line: { type: "string", maxLength: 120 }
      },
      required: ["verdict", "reasons", "key_numbers", "share_line"]
    };

    const sys =
      "You are EV Advisor for India. Use ONLY numbers and models provided by the user. " +
      "Return STRICT JSON per the schema. Be concise and friendly.";

    const user = {
      selected,
      peers,
      numbers,
      language: "en",
      add_hindi_tag: true
    };

    // Call OpenAI Responses API
    const start = Date.now();
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) }
      ],
      response_format: { type: "json_schema", json_schema: { name: "AiQuick", schema } }
    });

    // Responses API returns a content array; extract the JSON text safely
    const text =
      resp.output?.[0]?.content?.[0]?.text ||
      resp.choices?.[0]?.message?.content || // fallback shape (just in case)
      "{}";

    const ai = JSON.parse(text);
    const elapsed = Date.now() - start;
    console.log(`ai-quick: openai ok (${elapsed} ms)`);

    return ok({ source: "openai", ...ai });
  } catch (err) {
    console.error("ai-quick error:", err?.message || err);
    // Never fail the UI
    return ok({
      source: "fallback",
      verdict: "best_pick",
      alt_model_id: "",
      reasons: ["Deterministic fallback"],
      key_numbers: null,
      share_line: "Best pick based on monthly EV cost vs peers."
    });
  }
}

function ok(json) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(json)
  };
}
