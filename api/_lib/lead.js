const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

export function cleanLead(l = {}) {
  return {
    name: clip(l.name, 80), email: clip(l.email, 120), phone: clip(l.phone, 30),
    destination: clip(l.destination, 80), trip: clip(l.trip, 80),
    travel_dates: clip(l.travel_dates, 80), travellers: clip(l.travellers, 20),
    budget: clip(l.budget, 40), requirements: clip(l.requirements, 300),
    message: clip(l.message, 500), intent: ['low', 'medium', 'high'].includes(l.intent) ? l.intent : 'medium'
  };
}

export function validateLead(lead) {
  const missing = [];
  if (lead.name.length < 2) missing.push('name');
  if (!emailRe.test(lead.email)) missing.push('a valid email');
  if (lead.phone && !/^[+\d][\d\s().-]{6,}$/.test(lead.phone)) missing.push('a valid phone/WhatsApp number');
  return missing;
}

export async function sendLead(lead) {
  const body = [
    'NEW TRAVEL LEAD', '',
    `Name:\n${lead.name}`, `Email:\n${lead.email}`, `Phone:\n${lead.phone || '-'}`,
    `Destination:\n${lead.destination || '-'}`, `Trip:\n${lead.trip || '-'}`,
    `Travel Dates:\n${lead.travel_dates || '-'}`, `Travellers:\n${lead.travellers || '-'}`,
    `Budget:\n${lead.budget || '-'}`, `Special requirements:\n${lead.requirements || '-'}`,
    `Intent:\n${lead.intent}`, `Message:\n${lead.message || '-'}`
  ].join('\n\n');

  const { RESEND_API_KEY, AGENCY_EMAIL, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY || !AGENCY_EMAIL) {
    console.log('[lead:not-emailed]\n' + body); // demo fallback: visible in Vercel logs
    return { delivered: false };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM || 'onboarding@resend.dev', to: [AGENCY_EMAIL], reply_to: lead.email, subject: `New travel lead: ${lead.name}`, text: body })
  });
  if (!r.ok) { console.error('[lead:email-failed]', r.status, '\n' + body); throw new Error('email failed'); }
  return { delivered: true };
}
