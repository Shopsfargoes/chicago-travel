import { rateLimit } from './_lib/guard.js';
import { cleanLead, validateLead, sendLead } from './_lib/lead.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!rateLimit(req, 5)) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  const lead = cleanLead(req.body);
  const missing = validateLead(lead);
  if (missing.length) return res.status(400).json({ error: `Please provide ${missing.join(' and ')}.` });
  try { await sendLead(lead); res.json({ ok: true }); }
  catch { res.status(502).json({ error: 'We could not send your request. Please use WhatsApp instead.' }); }
}
