// Vercel serverless function: receives a brief from the contact form and
// forwards it to Diana's Telegram via her bot. Secrets live in
// Vercel → Project → Settings → Environment Variables (never in the browser):
//   TELEGRAM_BOT_TOKEN  (from @BotFather)
//   TELEGRAM_CHAT_ID    (your numeric id, e.g. from @userinfobot)
// Optional, for sequential numbers and repeat-sender counts:
//   an Upstash Redis store connected to the project (Vercel → Storage), which
//   adds KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) itself.
//   IPINFO_TOKEN (optional) raises the free limit of the provider lookup.

const crypto = require('crypto');
const MAX_BODY = 4.4 * 1024 * 1024; // Vercel's request limit is ~4.5 MB
function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Attachments are too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const LIMITS = { name: 120, contact: 200, project: 4000, budget: 120, timeline: 120 };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s || '').trim().slice(0, n);
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const ordinal = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); };
const flag = cc => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) : '';
const header = (req, name) => { const v = req.headers[name]; return Array.isArray(v) ? v[0] : (v || ''); };
const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };

// "iPhone · iOS 18 · Safari" from the User-Agent.
function deviceOf(ua) {
  if (!ua) return 'Unknown device';
  let device = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /Linux/.test(ua) ? 'Linux PC' : 'Unknown device';
  let os = '';
  let m;
  if ((m = ua.match(/OS (\d+)[_.](\d+)/)) && /iPhone|iPad/.test(ua)) os = `iOS ${m[1]}`;
  else if ((m = ua.match(/Android (\d+)/))) os = `Android ${m[1]}`;
  else if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if ((m = ua.match(/Mac OS X (\d+)[_.](\d+)/))) os = `macOS ${m[1]}.${m[2]}`;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /YaBrowser/.test(ua) ? 'Yandex Browser' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  if (/Telegram|Instagram|FBAN|FBAV/.test(ua)) device += ` (${/Telegram/.test(ua) ? 'Telegram' : /Instagram/.test(ua) ? 'Instagram' : 'Facebook'} in-app)`;
  return [device, os, browser].filter(Boolean).join(' · ');
}
const duration = sec => { sec = Math.max(0, Math.round(sec || 0)); if (sec < 60) return `${sec} s`; const m = Math.floor(sec / 60); return m < 60 ? `${m} min ${sec % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const plain = (v, n = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// Internet provider / organisation of the IP (ipinfo.io; optional IPINFO_TOKEN raises the free limit).
async function networkOf(ip) {
  if (!ip || ip === 'unknown' || /^(10\.|127\.|192\.168\.|::1)/.test(ip)) return '';
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const q = process.env.IPINFO_TOKEN ? `?token=${encodeURIComponent(process.env.IPINFO_TOKEN)}` : '';
    const r = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${q}`, { signal: ctrl.signal });
    if (!r.ok) return '';
    const j = await r.json();
    return plain((j.org || '').replace(/^AS\d+\s+/, ''), 80);
  } catch { return ''; } finally { clearTimeout(t); }
}

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

// ---------- references stored in Vercel Blob ----------
const MAX_REF = 50 * 1024 * 1024;
let blobSdk;
const sdk = () => (blobSdk ||= require('@vercel/blob'));
// Only files this site uploaded (refs/ in our own store) are accepted.
function blobList(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 10).map(m => {
    let url;
    try { url = new URL(String(m && m.url)); } catch { return null; }
    if (url.protocol !== 'https:' || !/\.blob\.vercel-storage\.com$/.test(url.hostname) || !url.pathname.startsWith('/refs/')) return null;
    return { url: url.href, name: plain(m.name, 120).replace(/[\\/]/g, ' '), type: plain(m.type, 80).toLowerCase() };
  }).filter(Boolean);
}
async function fetchBlobs(list) {
  return Promise.all(list.map(async (m, i) => {
    const got = await sdk().get(m.url, { access: 'private', useCache: false });
    if (!got || got.statusCode !== 200) throw new Error('Missing reference');
    if (got.blob.size > MAX_REF) throw new Error('Reference too large');
    const data = Buffer.from(await new Response(got.stream).arrayBuffer());
    return { name: m.name || got.blob.pathname.split('/').pop() || `reference-${i + 1}`, type: m.type || got.blob.contentType || 'application/octet-stream', data };
  }));
}
// Files are deleted once they reach Telegram; leftovers older than a day are swept too.
async function dropBlobs(list) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const urls = blobList(list).map(m => m.url);
    if (urls.length) await sdk().del(urls);
    const { blobs } = await sdk().list({ prefix: 'refs/', limit: 100 });
    const old = blobs.filter(b => Date.now() - new Date(b.uploadedAt).getTime() > 864e5).map(b => b.url);
    if (old.length) await sdk().del(old);
  } catch {}
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success: false, message: 'Method not allowed' }); }

  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ success: false, message: 'Telegram is not configured' });

  // Plain briefs arrive as JSON. Briefs with references arrive as one binary
  // body: [4-byte JSON length][JSON][file 1][file 2]…, so everything reaches
  // Telegram together (Vercel allows ~4.5 MB per request).
  let body = {}, files = [];
  if (/octet-stream/i.test(header(req, 'content-type'))) {
    let buf;
    try { buf = await readRaw(req); } catch (err) { return res.status(err.status || 400).json({ success: false, message: err.message }); }
    try {
      const len = buf.readUInt32BE(0);
      body = JSON.parse(buf.subarray(4, 4 + len).toString('utf8'));
      let at = 4 + len;
      for (const m of (Array.isArray(body.files) ? body.files : []).slice(0, 10)) {
        const size = Math.max(0, parseInt(m.size, 10) || 0);
        if (!size || at + size > buf.length) break;
        files.push({ name: plain(m.name, 120).replace(/[\\/]/g, ' ') || `reference-${files.length + 1}`, type: plain(m.type, 80).toLowerCase() || 'application/octet-stream', data: buf.subarray(at, at + size) });
        at += size;
      }
    } catch { return res.status(400).json({ success: false, message: 'Malformed request' }); }
  } else {
    body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
  }

  if (body.botcheck) { await dropBlobs(body.blobs); return res.status(200).json({ success: true }); } // honeypot: quietly drop bots

  const f = {};
  for (const key of Object.keys(LIMITS)) f[key] = clip(body[key], LIMITS[key]);
  if (Object.keys(LIMITS).some(key => !f[key])) { await dropBlobs(body.blobs); return res.status(400).json({ success: false, message: 'Please fill in every field' }); }

  // References uploaded by the browser straight to Vercel Blob (any size up to 50 MB each).
  const blobs = blobList(body.blobs);
  if (blobs.length) {
    try { files = await fetchBlobs(blobs); }
    catch (err) { await dropBlobs(blobs); return res.status(502).json({ success: false, message: 'Could not read the references' }); }
  }

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

  const [counts, network] = await Promise.all([counters(hash(`ip:${ip}`), device ? hash(`dev:${device}`) : ''), networkOf(ip)]);

  // Visit context sent by the page (insight.js) plus what the request itself tells.
  const v = body.insight && typeof body.insight === 'object' ? body.insight : {};
  const ua = header(req, 'user-agent');
  const languages = plain(v.languages, 60) || plain(header(req, 'accept-language').split(';')[0], 60);
  const tz = plain(v.timeZone, 50) || decode(header(req, 'x-vercel-ip-timezone'));
  const seen = Array.isArray(v.seen) ? v.seen.slice(0, 12).map(x => plain(x, 40)).filter(Boolean) : [];
  const visits = Math.max(1, Math.min(parseInt(v.visits, 10) || 1, 9999));
  const filling = Math.max(0, parseInt(v.filling, 10) || 0);
  const firstVisit = /^\d{4}-\d{2}-\d{2}/.test(String(v.firstVisit || '')) ? String(v.firstVisit).slice(0, 10) : '';
  const source = plain(v.source, 100) || 'direct';
  const firstSource = plain(v.firstSource, 100);
  const suspicious = filling > 0 && filling < 15;
  const refs = files.length;
  // Video call request (times shown in Diana's zone, plus the client's own).
  const callLines = [];
  const c = body.call && typeof body.call === 'object' ? body.call : null;
  const at = c && Date.parse(c.at);
  if (c && at && at > Date.now() - 864e5 && at < Date.now() + 120 * 864e5) {
    const when = (tz, withDay = true) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...(withDay ? { weekday: 'short', day: 'numeric', month: 'short' } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)); } catch { return ''; } };
    const ctz = plain(c.clientTz, 50);
    const platformName = /zoom/i.test(c.platform) ? 'Zoom' : 'Google Meet';
    const handle = plain(c.handle, 120);
    const viaName = c.via === 'telegram' ? 'Telegram' : 'email';
    callLines.push('', '📞 <b>Video call requested</b> · 25 min intro',
      `🗓 ${esc(when('Asia/Yekaterinburg'))} <i>(your time)</i>`,
      ...(ctz && ctz !== 'Asia/Yekaterinburg' ? [`🌍 ${esc(when(ctz))} for the client · ${esc(ctz)}`] : []),
      `💻 ${platformName} · invite via ${viaName}: ${viaName === 'email' ? esc(handle) : `<code>${esc(handle)}</code>`}`);
  }
  const now = new Date();
  // Without a store, the number is the date and time in Diana's time zone: #YYMMDD-HHMM.
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yekaterinburg', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  const number = counts ? `#${String(counts.seq).padStart(4, '0')}` : `#${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;

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
    ...(refs ? ['', `📎 <b>${refs} reference${refs === 1 ? '' : 's'}</b> attached`] : []),
    ...callLines,
    '',
    '<b>About the sender</b>',
    `${flag(country) || '🌍'} ${esc(place)}`,
    `🕒 Local time: ${esc(plain(v.localTime, 40) || '—')}${tz ? ` (${esc(tz)})` : ''}`,
    `🗣 Language: ${esc(languages || '—')}`,
    `📱 ${esc(deviceOf(ua))}${v.screen ? ` · screen ${esc(plain(v.screen, 20))}` : ''}`,
    `🌐 IP <code>${esc(ip)}</code>${network ? ` · ${esc(network)}` : ''}${ipNote}`,
    `💻 ${deviceNote}`,
    '',
    '<b>Visit</b>',
    `🔗 Came from: ${esc(source)}${firstSource && firstSource !== source ? ` (first time: ${esc(firstSource)})` : ''}`,
    `👀 Visit ${visits === 1 ? '1 (first)' : `${visits}`}${firstVisit && visits > 1 ? ` · first seen ${firstVisit}` : ''}`,
    `📖 Viewed: ${esc(seen.join(', ') || '—')}`,
    `⏱ On site ${duration(v.onSite)} · filled the brief in ${filling ? duration(filling) : '—'}${suspicious ? '  ⚠️ <i>very fast, could be spam</i>' : ''}`
  ].join('\n');

  const api = method => `https://api.telegram.org/bot${token}/${method}`;
  const call = async (method, payload) => {
    const r = await fetch(api(method), payload instanceof FormData ? { method: 'POST', body: payload } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) throw new Error(out.description || `Telegram HTTP ${r.status}`);
    return out.result;
  };

  try {
    if (!files.length) {
      await call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
      return res.status(200).json({ success: true, number });
    }
    // One album: the brief is the caption, so the files and the text arrive as one message.
    // Telegram groups photos/videos together, and documents only with documents.
    // Telegram takes photos up to 10 MB; bigger images travel as documents.
    const visual = f => /^image\/(jpeg|png|webp)$/.test(f.type) && f.data.length <= 10 * 1024 * 1024 ? 'photo' : /^video\/(mp4|quicktime)$/.test(f.type) ? 'video' : 'document';
    const mixed = files.some(f => visual(f) === 'document');
    const kind = f => (mixed ? 'document' : visual(f));
    const fits = text.replace(/<[^>]+>/g, '').length <= 1024; // caption limit
    let replyTo = null;
    if (!fits) {
      // Too long for a caption: the brief goes first and the album is attached to it as a reply.
      const msg = await call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
      replyTo = msg.message_id;
    }
    const caption = fits ? text : `📎 References for ${number}`;
    const form = new FormData();
    form.append('chat_id', chatId);
    if (replyTo) form.append('reply_parameters', JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
    if (files.length === 1) {
      const f = files[0], k = kind(f);
      form.append('caption', caption); form.append('parse_mode', 'HTML');
      form.append(k, new Blob([f.data], { type: f.type }), f.name);
      await call(k === 'photo' ? 'sendPhoto' : k === 'video' ? 'sendVideo' : 'sendDocument', form);
    } else {
      const media = files.map((f, i) => ({ type: kind(f), media: `attach://f${i}`, ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) }));
      form.append('media', JSON.stringify(media));
      files.forEach((f, i) => form.append(`f${i}`, new Blob([f.data], { type: f.type }), f.name));
      await call('sendMediaGroup', form);
    }
    await dropBlobs(blobs);
    return res.status(200).json({ success: true, number, refs: files.length });
  } catch (err) {
    await dropBlobs(blobs);
    return res.status(502).json({ success: false, message: err.message || 'Could not reach Telegram' });
  }
};
