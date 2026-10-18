// Vercel serverless function: receives a brief from the contact form and
// forwards it to Diana's Telegram via her bot. Secrets live in
// Vercel → Project → Settings → Environment Variables (never in the browser):
//   TELEGRAM_BOT_TOKEN  (from @BotFather)
//   TELEGRAM_CHAT_ID    (your numeric id, e.g. from @userinfobot)
// Optional, for sequential numbers and repeat-sender counts:
//   an Upstash Redis store connected to the project (Vercel → Storage), which
//   adds KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) itself.

const crypto = require('crypto');

const LIMITS = { name: 120, contact: 200, project: 4000, budget: 120, timeline: 120 };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s || '').trim().slice(0, n);
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const ordinal = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); };
const flag = cc => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) : '';
const header = (req, name) => { const v = req.headers[name]; return Array.isArray(v) ? v[0] : (v || ''); };
const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };

// Counters in Upstash Redis (REST). Returns null when no store is connected.
async function counters(ipKey, deviceKey) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const keep = String(60 * 60 * 24 * 180); // repeat counts remember senders for ~6 months
  const cmds = [['INCR', 'brief:seq'], ['INCR', `brief:ip:${ipKey}`], ['EXPIRE', `brief:ip:${ipKey}`, keep]];
  if (deviceKey) cmds.push(['INCR', `brief:dev:${deviceKey}`], ['EXPIRE', `brief:dev:${deviceKey}`, keep]);
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
    if (!r.ok) return null;
    const out = await r.json();
    return { seq: out[0].result, ip: out[1].result, device: deviceKey ? out[3].result : null };
  } catch { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success: false, message: 'Method not allowed' }); }

  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ success: false, message: 'Telegram is not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (body.botcheck) return res.status(200).json({ success: true }); // honeypot: quietly drop bots

  const f = {};
  for (const key of Object.keys(LIMITS)) f[key] = clip(body[key], LIMITS[key]);
  if (!f.name || !f.contact || !f.project) return res.status(400).json({ success: false, message: 'Missing fields' });

  // Where it came from (Vercel adds these headers on every request).
  const ip = (header(req, 'x-forwarded-for').split(',')[0] || header(req, 'x-real-ip') || '').trim() || 'unknown';
  const country = header(req, 'x-vercel-ip-country').toUpperCase();
  const city = decode(header(req, 'x-vercel-ip-city'));
  let countryName = country;
  try { if (country) countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch {}
  const place = [city, countryName].filter(Boolean).join(', ') || 'Unknown location';

  // A random id the browser keeps for this site: tells "same browser" even on another network.
  const device = /^[a-z0-9-]{8,64}$/i.test(String(body.device || '')) ? String(body.device) : '';
  const localCount = Math.min(Math.max(parseInt(body.sentBefore, 10) || 0, 0), 999) + 1;

  const counts = await counters(hash(`ip:${ip}`), device ? hash(`dev:${device}`) : '');
  const now = new Date();
  const number = counts ? `#${String(counts.seq).padStart(4, '0')}` : `#${now.toISOString().slice(2, 10).replace(/-/g, '')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;

  const ipNote = counts && counts.ip > 1 ? ` · ${ordinal(counts.ip)} brief from this IP` : '';
  const deviceCount = counts && counts.device ? counts.device : localCount;
  const deviceNote = deviceCount > 1 ? `${ordinal(deviceCount)} brief from this browser` : 'First brief from this browser';
  const repeat = (counts && counts.ip > 1) || deviceCount > 1;

  const text = [
    `📩 <b>New project brief ${number}</b>${repeat ? '  ⚠️ <i>repeat sender</i>' : ''}`,
    '',
    `<b>Name:</b> ${esc(f.name)}`,
    `<b>Contact:</b> ${esc(f.contact)}`,
    `<b>Budget:</b> ${esc(f.budget || 'To be discussed')}`,
    `<b>Timeline:</b> ${esc(f.timeline || 'Flexible')}`,
    '',
    `<b>Project:</b>\n${esc(f.project)}`,
    '',
    `${flag(country) || '🌍'} ${esc(place)}`,
    `🌐 IP <code>${esc(ip)}</code>${ipNote}`,
    `💻 ${deviceNote}`
  ].join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const out = await tg.json().catch(() => ({}));
    if (!tg.ok || !out.ok) return res.status(502).json({ success: false, message: out.description || `Telegram HTTP ${tg.status}` });
    return res.status(200).json({ success: true, number });
  } catch (err) {
    return res.status(502).json({ success: false, message: 'Could not reach Telegram' });
  }
};
