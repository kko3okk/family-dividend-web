/* trip-kit/backend/worker.js — 旅途手帳的 Claude 後端（Cloudflare Worker）
 *
 * 手帳頁（journal.html）把照片和指令送到這裡，這裡加上 Claude API 金鑰再轉給 Claude，
 * 結果回傳給手帳頁。金鑰只存在 Cloudflare 的 secret 裡，不會出現在網頁或 GitHub。
 *
 * 需要的 secret（用 wrangler secret put 設定）：
 *   ANTHROPIC_API_KEY  Claude API 金鑰
 *   TRIP_PASS          通行碼（手帳頁「⚙️ AI 設定」要填一樣的）
 * 可選的變數（wrangler.toml [vars]）：
 *   ALLOWED_ORIGINS    允許呼叫的網站，逗號分隔
 */
const MODELS = ['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-5-5'];
const MAX_TOKENS = 3000;
const MAX_BODY = 8 * 1024 * 1024; // 8 MB，夠放一張壓縮過的照片

function cors(origin, allowed) {
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-trip-pass',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
}
function same(a, b) { // 固定時間比較，避免從回應時間猜通行碼
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://kko3okk.github.io').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin, allowed);
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/' && req.method === 'GET') return json({ ok: true, service: 'trip-claude' }, 200, h);
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') return json({ error: { message: 'not found' } }, 404, h);
    if (!allowed.includes(origin)) return json({ error: { message: 'origin not allowed' } }, 403, h);
    if (!env.ANTHROPIC_API_KEY || !env.TRIP_PASS) return json({ error: { message: '後端還沒設定金鑰或通行碼' } }, 500, h);
    if (!same(req.headers.get('x-trip-pass') || '', env.TRIP_PASS)) return json({ error: { message: '通行碼不對' } }, 401, h);

    const len = +(req.headers.get('content-length') || 0);
    if (len > MAX_BODY) return json({ error: { message: '照片太大' } }, 413, h);
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: { message: '格式錯誤' } }, 400, h); }

    // 只放行手帳需要的欄位，避免被拿去做別的事
    const out = {
      model: MODELS.includes(body.model) ? body.model : MODELS[0],
      max_tokens: Math.min(Math.max(+body.max_tokens || 1000, 1), MAX_TOKENS),
      messages: Array.isArray(body.messages) ? body.messages.slice(0, 4) : [],
    };
    if (!out.messages.length) return json({ error: { message: '沒有內容' } }, 400, h);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(out),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...h, 'content-type': 'application/json; charset=utf-8' } });
  },
};
