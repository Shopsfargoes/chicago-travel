import { loadData, loadBrand, loadAI, upcoming } from './_lib/data.js';
import { rateLimit } from './_lib/guard.js';
import { cleanLead, validateLead, sendLead } from './_lib/lead.js';

const tools = [
  { type: 'function', function: { name: 'recommend_trips', description: 'Show trip cards to the visitor. Use ids from the data only.',
    parameters: { type: 'object', properties: { trip_ids: { type: 'array', items: { type: 'string' } } }, required: ['trip_ids'] } } },
  { type: 'function', function: { name: 'submit_lead', description: 'Send the enquiry to the travel team. Call only after the visitor confirmed the details.',
    parameters: { type: 'object', properties: {
      name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, destination: { type: 'string' }, trip: { type: 'string' },
      travel_dates: { type: 'string' }, travellers: { type: 'string' }, budget: { type: 'string' }, requirements: { type: 'string' },
      message: { type: 'string' }, intent: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['name', 'email'] } } }
];

const nums = (s) => new Set((String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, '')));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!rateLimit(req, 20)) return res.status(429).json({ reply: 'You are sending messages very quickly. Please wait a moment and try again.' });

  const { AI_BASE_URL, AI_API_KEY, AI_MODEL, AI_FALLBACK_MODELS } = process.env;
  if (!AI_API_KEY || !AI_MODEL) return res.status(500).json({ reply: 'The assistant is not configured yet. You can reach the team on WhatsApp.' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
  const messages = incoming
    .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!messages.length || messages.at(-1).role !== 'user') return res.status(400).json({ reply: 'Say something to get started.' });

  const data = loadData(); const brand = loadBrand(); const ai = loadAI();
  const trips = upcoming(data.trips);
  const tripId = String(req.body?.tripId || '');
  const focus = trips.find((t) => t.id === tripId);

  const system = [
    `You are the ${brand.ai_name} for ${brand.name}. ${ai.persona}`,
    'RULES:\n- ' + ai.rules.join('\n- '),
    `fallback_unknown: "${ai.fallback_unknown}"`,
    focus ? `The visitor is asking about trip id "${focus.id}".` : '',
    'AGENCY DATA (the only source of truth):\n' + JSON.stringify({ agency: data.agency, destinations: data.destinations, trips, faqs: data.faqs, policies: data.policies, contact: data.contact })
  ].filter(Boolean).join('\n\n');

  const fallbacks = (AI_FALLBACK_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean);
  let msg;
  try {
    const r = await fetch(`${(AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.SITE_URL || '', 'X-Title': brand.name },
      body: JSON.stringify({ model: AI_MODEL, ...(fallbacks.length && { models: [AI_MODEL, ...fallbacks] }),
        messages: [{ role: 'system', content: system }, ...messages], tools, tool_choice: 'auto', max_tokens: 400, temperature: 0.3 })
    });
    if (!r.ok) throw new Error(String(r.status));
    msg = (await r.json()).choices?.[0]?.message;
    if (!msg) throw new Error('empty');
  } catch (e) {
    console.error('[chat:ai-error]', e.message);
    return res.status(502).json({ reply: 'I am having trouble right now. Please try again, or message the team on WhatsApp.' });
  }

  let reply = (msg.content || '').trim();
  let tripIds = [];
  let leadSent = false;

  for (const call of msg.tool_calls || []) {
    let args = {};
    try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
    if (call.function.name === 'recommend_trips') {
      tripIds = (args.trip_ids || []).filter((id) => trips.some((t) => t.id === id)).slice(0, 3);
    }
    if (call.function.name === 'submit_lead') {
      const lead = cleanLead(args);
      const missing = validateLead(lead);
      if (missing.length) { reply = `Before I send this, I still need ${missing.join(' and ')}.`; continue; }
      try { await sendLead(lead); leadSent = true; reply = `Thanks, ${lead.name.split(' ')[0]}. We've received your travel request. Our travel team will review it and get back to you shortly.`; }
      catch { reply = 'I could not send your request just now. Please message us on WhatsApp so we do not lose it.'; }
    }
  }

  // Price guard: any $ amount must exist in the data or in what the visitor typed.
  if (!leadSent) {
    const allowed = new Set([...nums(JSON.stringify(data)), ...messages.filter((m) => m.role === 'user').flatMap((m) => [...nums(m.content)])]);
    const used = [...reply.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => m[1].replace(/,/g, ''));
    if (used.some((n) => !allowed.has(n))) reply = ai.fallback_unknown;
  }
  if (!reply) reply = tripIds.length ? 'Here is what matches. Want me to go through what is included?' : ai.fallback_unknown;

  res.json({ reply, trips: tripIds, leadSent });
}
