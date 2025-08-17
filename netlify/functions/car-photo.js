// Car photo resolver via Wikipedia thumbnail (no extra API key)
// Usage: /.netlify/functions/car-photo?brand=Tata&model=Nexon%20EV
export async function handler(event) {
  const ok = (b, s=200)=>({ statusCode:s, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify(b) });
  try {
    const qs = event.queryStringParameters || {};
    const brand = (qs.brand||'').trim();
    const model = (qs.model||'').trim();
    if (!brand || !model) return ok({error:'missing brand/model'}, 400);

    const q = encodeURIComponent(`${brand} ${model} electric`);
    const searchURL = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${q}&limit=1`;
    const s = await fetch(searchURL, { headers:{'User-Agent':'ev-cost-advisor/1.0'} });
    const sj = await s.json();

    let page = sj?.pages?.[0];
    if (!page) return ok({url:'', source:'none'});

    // get summary for thumbnail if search didn’t include it
    let thumb = page?.thumbnail?.url;
    if (!thumb) {
      const slug = encodeURIComponent(page.title);
      const sumURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;
      const r = await fetch(sumURL, { headers:{'User-Agent':'ev-cost-advisor/1.0'} });
      const j = await r.json();
      thumb = j?.thumbnail?.source || j?.originalimage?.source || '';
    }
    return ok({ url: thumb || '', source: 'wikipedia', title: page?.title || '' });
  } catch (e) {
    return ok({ url:'', error:(e && e.message)||String(e) }, 200);
  }
}