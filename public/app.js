const $ = (s, r = document) => r.querySelector(s);
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const day = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (src, alt) => `<div class="ph">${src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()">` : ''}</div>`;

let site = { trips: [], destinations: [], brand: {}, whatsapp: '' };
let history = [];
let tripId = '';
let busy = false;

async function init() {
  $('#yr').textContent = new Date().getFullYear();
  try { site = await (await fetch('/api/site')).json(); } catch { $('#tripGrid').innerHTML = '<p class="meta">Trips could not be loaded. Please refresh.</p>'; return; }
  const { brand } = site;
  document.querySelectorAll('[data-brand]').forEach((el) => (el.textContent = brand[el.dataset.brand] || ''));
  if (brand.hero_image) $('#hero').style.setProperty('--hero-img', `url(${brand.hero_image})`);
  const wa = site.whatsapp ? `https://wa.me/${site.whatsapp.replace(/\D/g, '')}` : '#';
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = wa));

  $('#tripGrid').innerHTML = site.trips.length ? site.trips.map(tripCard).join('') : '<p class="meta">New trips are coming soon. Ask our assistant what is planned.</p>';
  $('#destGrid').innerHTML = site.destinations.map((d) => `
    <article class="card dest">${img(d.image, `${d.name}, ${d.country}`)}
      <div class="card-body"><h3>${esc(d.name)}</h3><p class="meta">${esc(d.country)}</p><p>${esc(d.blurb)}</p>
      ${d.from_price ? `<p class="price"><small>From</small> ${money(d.from_price)}</p>` : ''}
      <div class="actions"><button class="btn btn-line" data-ask-dest="${esc(d.name)}">Ask about ${esc(d.name)}</button></div></div></article>`).join('');
  $('#footDests').innerHTML = site.destinations.slice(0, 6).map((d) => `<a href="#destinations">${esc(d.name)}</a>`).join('');
  const c = site.contact || {};
  $('#footContact').innerHTML = `${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}<a data-wa target="_blank" rel="noopener" href="${wa}">WhatsApp</a>`;
  injectSchema();
}

function tripCard(t) {
  return `<article class="card">${img(t.image, `${t.destination}`)}
    <div class="card-body"><h3>${esc(t.name)}</h3>
      <p class="meta">${esc(t.destination)}<br>${day(t.start_date)} &ndash; ${day(t.end_date)}</p>
      <p class="price"><small>From</small> ${money(t.starting_price)} <small>${esc(t.price_basis || '')}</small></p>
      <ul class="inc">${(t.includes || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="actions"><button class="btn btn-primary" data-ask-trip="${esc(t.id)}">Ask AI About This Trip</button></div></div></article>`;
}

function injectSchema() {
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'TravelAgency', name: site.brand.name, description: site.brand.description,
    makesOffer: site.trips.map((t) => ({ '@type': 'Offer', name: t.name, price: t.starting_price, priceCurrency: 'USD', description: `${t.destination}, ${t.start_date} to ${t.end_date}` })) });
  document.head.append(s);
}

/* ---------- chat ---------- */
const chat = $('#chat'), msgs = $('#msgs'), input = $('#chatInput');
const quickPrompts = ['Where can I go for Christmas?', 'Show me trips under $3,000', 'I want somewhere warm', "I'm travelling with my family"];

function addMsg(text, who) { const d = document.createElement('div'); d.className = `msg ${who}`; d.textContent = text; msgs.append(d); msgs.scrollTop = msgs.scrollHeight; return d; }
function addTrips(ids) {
  ids.forEach((id) => { const t = site.trips.find((x) => x.id === id); if (!t) return;
    const d = document.createElement('div'); d.className = 'mini';
    d.innerHTML = `<strong>${esc(t.name)}</strong>${esc(t.destination)}<br>${day(t.start_date)} &ndash; ${day(t.end_date)}<br>From ${money(t.starting_price)} ${esc(t.price_basis || '')}`;
    msgs.append(d); });
  msgs.scrollTop = msgs.scrollHeight;
}

function openChat(forTrip = '', prefill = '') {
  const first = chat.hidden;
  chat.hidden = false; $('#fab').hidden = window.innerWidth < 820;
  if (forTrip && forTrip !== tripId) { tripId = forTrip; history = []; msgs.innerHTML = ''; }
  if (!msgs.children.length) {
    const t = site.trips.find((x) => x.id === tripId);
    addMsg(t ? `Hi! I can help you learn more about our ${t.name} to ${t.destination.split(',')[0]}.\n\nWhat would you like to know?` : "Hi! Tell me where you'd like to go, when, and who's travelling, and I'll suggest trips from our upcoming list.", 'bot');
    $('#quick').innerHTML = t ? '' : quickPrompts.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  }
  if (prefill) send(prefill); else if (first) input.focus();
}
function closeChat() { chat.hidden = true; $('#fab').hidden = false; $('#fab').focus(); }

async function send(text) {
  text = text.trim(); if (!text || busy) return;
  busy = true; $('#quick').innerHTML = '';
  addMsg(text, 'you'); history.push({ role: 'user', content: text });
  const typing = addMsg('Typing...', 'bot'); typing.classList.add('typing');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, tripId }) });
    const data = await r.json();
    typing.remove(); addMsg(data.reply, 'bot'); history.push({ role: 'assistant', content: data.reply });
    if (data.trips?.length) addTrips(data.trips);
    if (data.leadSent && site.whatsapp) {
      const a = document.createElement('a'); a.className = 'btn btn-primary'; a.target = '_blank'; a.rel = 'noopener';
      a.href = `https://wa.me/${site.whatsapp.replace(/\D/g, '')}`; a.textContent = 'Chat with us on WhatsApp'; msgs.append(a);
    }
  } catch { typing.remove(); addMsg('Connection problem. Please try again, or message us on WhatsApp.', 'bot'); }
  busy = false; input.focus();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.hasAttribute('data-open-chat')) { if (t.tagName === 'A') e.preventDefault(); openChat(); $('#navLinks').classList.remove('open'); }
  if (t.dataset.askTrip) openChat(t.dataset.askTrip);
  if (t.dataset.askDest) openChat('', `Tell me about ${t.dataset.askDest}`);
  if (t.closest('#quick')) send(t.textContent);
});
$('#fab').addEventListener('click', () => openChat());
$('#chatClose').addEventListener('click', closeChat);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !chat.hidden) closeChat(); });
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(v); });
$('#menuBtn').addEventListener('click', (e) => { const o = $('#navLinks').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); });

init();
