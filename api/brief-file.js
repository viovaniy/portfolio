// Vercel serverless function: pins one reference file to a brief that was just
// sent to Telegram (as a reply to that message). The page calls it once per
// file, with the signed ticket /api/brief returned, so nobody else can use it.
// The raw file is the request body; details travel in headers.

const crypto = require('crypto');
const MAX = 4.3 * 1024 * 1024; // Vercel's request limit is ~4.5 MB
const PHOTO = /^image\/(jpeg|png|webp)$/;
const sign = (text, secret) => crypto.createHmac('sha256', secret).update(text).digest('hex');
const header = (req, name) => { const v = req.headers[name]; return Array.isArray(v) ? v[0] : (v || ''); };
const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX) { reject(Object.assign(new Error('File is too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success: false, message: 'Method not allowed' }); }
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ success: false, message: 'Telegram is not configured' });

  // Check the ticket from /api/brief.
  const messageId = parseInt(header(req, 'x-brief-message'), 10);
  const exp = parseInt(header(req, 'x-brief-exp'), 10);
  const refs = parseInt(header(req, 'x-brief-refs'), 10);
  const index = parseInt(header(req, 'x-file-index'), 10);
  const sig = header(req, 'x-brief-sig');
  const expected = sign(`${messageId}.${exp}.${refs}`, token);
  const valid = messageId > 0 && exp > Date.now() && refs >= 1 && refs <= 10 && index >= 1 && index <= refs &&
    sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) return res.status(403).json({ success: false, message: 'Upload ticket is not valid' });

  let file;
  try { file = await readBody(req); } catch (err) { return res.status(err.status || 400).json({ success: false, message: err.message }); }
  if (!file.length) return res.status(400).json({ success: false, message: 'Empty file' });

  const type = (header(req, 'content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const name = decode(header(req, 'x-file-name')).replace(/[\u0000-\u001f\\/]/g, ' ').trim().slice(0, 120) || `reference-${index}`;
  const number = header(req, 'x-brief-number').replace(/[^#\w-]/g, '').slice(0, 20);
  const asPhoto = PHOTO.test(type) && file.length < 9.5 * 1024 * 1024;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', `📎 ${index}/${refs}${number ? ` · ${number}` : ''} · ${name}`);
  form.append('reply_parameters', JSON.stringify({ message_id: messageId, allow_sending_without_reply: true }));
  form.append(asPhoto ? 'photo' : 'document', new Blob([file], { type }), name);

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/${asPhoto ? 'sendPhoto' : 'sendDocument'}`, { method: 'POST', body: form });
    const out = await tg.json().catch(() => ({}));
    if (!tg.ok || !out.ok) return res.status(502).json({ success: false, message: out.description || `Telegram HTTP ${tg.status}` });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(502).json({ success: false, message: 'Could not reach Telegram' });
  }
};
