// netlify/functions/ai-ping.js
import OpenAI from "openai";

const hasKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

const ok = (json) => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(json),
});

export async function handler(event) {
  const qs = event.queryStringParameters || {};

  // quick version info
  if (qs.diag === "version") {
    return ok({ ok: true, func: "ai-ping", node: process.version, hasKey });
  }

  if (!hasKey) return ok({ ok: false, error: "no_api_key" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return JSON {\"pong\":true} only." },
        { role: "user", content: "Ping" },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 20,
    });
    const txt = r?.choices?.[0]?.message?.content || "{}";
    return ok({ ok: true, json: JSON.parse(txt) });
  } catch (e) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
}