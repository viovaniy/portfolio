// Vercel serverless function: receives a brief from the contact form and
// forwards it to Diana's Telegram via her bot. The bot token never reaches
// the browser — it lives in Vercel → Project → Settings → Environment Variables:
//   TELEGRAM_BOT_TOKEN  (from @BotFather)
//   TELEGRAM_CHAT_ID    (your numeric id, e.g. from @userinfobot)

const LIMITS = { name: 120, contact: 200, project: 4000, budget: 120, timeline: 120 };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s || '').trim().slice(0, n);

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

  const text = [
    '📩 <b>New project brief</b>',
    '',
    `<b>Name:</b> ${esc(f.name)}`,
    `<b>Contact:</b> ${esc(f.contact)}`,
    `<b>Budget:</b> ${esc(f.budget || 'To be discussed')}`,
    `<b>Timeline:</b> ${esc(f.timeline || 'Flexible')}`,
    '',
    `<b>Project:</b>\n${esc(f.project)}`
  ].join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const out = await tg.json().catch(() => ({}));
    if (!tg.ok || !out.ok) return res.status(502).json({ success: false, message: out.description || `Telegram HTTP ${tg.status}` });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(502).json({ success: false, message: 'Could not reach Telegram' });
  }
};
