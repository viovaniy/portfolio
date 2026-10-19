// Issues short-lived tokens so the visitor's browser can upload brief
// references straight to Vercel Blob (no 4.5 MB function limit).
// Needs BLOB_READ_WRITE_TOKEN (added when the Blob store is connected with a read-write token).
const { handleUpload } = require('@vercel/blob/client');

const MAX_FILE = 50 * 1024 * 1024; // Telegram bots can send files up to 50 MB
const header = (req, name) => { const v = req.headers[name]; return Array.isArray(v) ? v[0] : (v || ''); };
function allowedOrigin(req) {
  const origin = header(req, 'origin') || header(req, 'referer');
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return /(^|\.)viovaniy\.com$/.test(host) || /\.vercel\.app$/.test(host) || host === 'localhost' || host === '127.0.0.1';
  } catch { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Uploads are not configured' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Malformed request' });
  // Only token requests from the site itself (completion callbacks come from Vercel and are signed).
  if (body.type === 'blob.generate-client-token' && !allowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const out = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async pathname => {
        if (!/^refs\/[^/]{1,160}$/.test(pathname)) throw new Error('Invalid path');
        return { maximumSizeInBytes: MAX_FILE, addRandomSuffix: true, validUntil: Date.now() + 30 * 60 * 1000 };
      }
    });
    return res.status(200).json(out);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload refused' });
  }
};
