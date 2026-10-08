const $ = (s, r = document) => r.querySelector(s);
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const day = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (src, alt) => `<div class="ph">${src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()">` : ''}</div>`;

const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
  instagram: `<svg ${S}><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>`,
  facebook: `<svg ${S}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  x: `<svg ${S}><path d="M4 4l16 16M20 4L4 20"/></svg>`,
  youtube: `<svg ${S}><path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.9 4 12 4 12 4s-6.9 0-8.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 11.8a29 29 0 0 0 .4 5.3 2.8 2.8 0 0 0 2 2c1.7.4 8.6.4 8.6.4s6.9 0 8.6-.4a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-5.3 29 29 0 0 0-.5-5.4z"/><path d="M9.8 15l5.7-3.3L9.8 8.5z"/></svg>`,
  linkedin: `<svg ${S}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`
};

let site = { trips: [], destinations: [], brand: {}, whatsapp: '' };
let history = [];
let tripId = '';
let busy = false;

/* ---------- scroll reveal ---------- */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  : null;
function reveal() {
  document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
    el.style.transitionDelay = ([...el.parentElement.children].indexOf(el) % 3) * 90 + 'ms';
    io ? io.observe(el) : el.classList.add('in');
  });
}

/* ---------- smooth scrolling with a bit of friction (desktop wheel only) ---------- */
const SCROLL_EASE = 0.09; // lower = heavier / more friction (0.05 very heavy, 0.15 light)
const SCROLL_STEP = 0.85; // how far one wheel notch travels (lower = slower)
function smoothScroll() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  root.classList.add('smooth');
  let target = scrollY, current = scrollY, raf = 0;
  const limit = () => root.scrollHeight - innerHeight;
  const tick = () => {
    current += (target - current) * SCROLL_EASE;
    if (Math.abs(target - current) < 0.5) { current = target; raf = 0; } else raf = requestAnimationFrame(tick);
    scrollTo(0, current);
  };
  const go = (y) => { target = Math.max(0, Math.min(limit(), y)); if (!raf) { current = scrollY; raf = requestAnimationFrame(tick); } };

  addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented) return;
    for (let el = e.target; el && el !== document.body; el = el.parentElement) { // let the chat scroll normally
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return;
    }
    e.preventDefault();
    go((raf ? target : scrollY) + (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * SCROLL_STEP);
  }, { passive: false });

  addEventListener('scroll', () => { if (!raf) target = current = scrollY; }, { passive: true }); // keyboard, scrollbar, etc.

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || a.getAttribute('href') === '#') return;
    const el = a.getAttribute('href') === '#top' ? document.body : $(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    go(el === document.body ? 0 : el.getBoundingClientRect().top + scrollY - 68);
  });
}

/* ---------- page build ---------- */
async function init() {
  $('#yr').textContent = new Date().getFullYear();
  try { site = await (await fetch('/api/site')).json(); } catch { $('#tripGrid').innerHTML = '<p class="sub">Trips could not be loaded. Please refresh.</p>'; return; }
  const { brand } = site;
  document.querySelectorAll('[data-brand]').forEach((el) => (el.textContent = brand[el.dataset.brand] || ''));
  if (brand.hero_image) $('#hero').style.setProperty('--hero-img', `url(${brand.hero_image})`);
  const wa = site.whatsapp ? `https://wa.me/${site.whatsapp.replace(/\D/g, '')}` : '#';
  const c = site.contact || {};

  $('#tripGrid').innerHTML = site.trips.length ? site.trips.map(tripCard).join('') : '<p class="sub">New trips are coming soon. Ask our assistant what is planned.</p>';
  $('#destGrid').innerHTML = site.destinations.map((d) => `
    <article class="post reveal">${img(d.image, `${d.name}, ${d.country}`)}
      <span class="tag">${esc(d.country)}</span><h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p>
      ${d.from_price ? `<p class="price"><small>From</small> ${money(d.from_price)}</p>` : ''}
      <div class="actions"><button class="btn btn-line" data-ask-dest="${esc(d.name)}">Ask about ${esc(d.name)}</button></div></article>`).join('');

  $('#footDests').innerHTML = '<h4>Destinations</h4>' + site.destinations.slice(0, 6).map((d) => `<a href="#destinations">${esc(d.name)}</a>`).join('');
  $('#footContact').innerHTML = '<h4>Contact</h4>' + [
    c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '',
    c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '',
    `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`].join('');
  $('#panelMail').href = c.email ? `mailto:${c.email}` : '#';
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = wa));
  $('#social').innerHTML = Object.entries(brand.social || {}).filter(([k, v]) => ICONS[k] && v)
    .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${k}">${ICONS[k]}</a>`).join('');

  const wm = $('#wordmark');
  wm.innerHTML = `<span>${esc(String(brand.name || '').replace(/\./g, '').toUpperCase())}</span>`;
  const fit = () => { const s = wm.firstChild; wm.style.fontSize = '100px'; wm.style.fontSize = Math.min(260, (100 * wm.clientWidth) / s.offsetWidth) + 'px'; };
  fit(); addEventListener('resize', fit); document.fonts?.ready.then(fit);

  injectSchema();
  reveal();
}

function tripCard(t) {
  return `<article class="post reveal">${img(t.image, t.destination)}
    <span class="tag">${day(t.start_date)} &ndash; ${day(t.end_date)}</span>
    <h3>${esc(t.name)}</h3><p>${esc(t.destination)}</p>
    <p class="price"><small>From</small> ${money(t.starting_price)} <small>${esc(t.price_basis || '')}</small></p>
    <ul class="inc">${(t.includes || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <div class="actions"><button class="btn btn-primary" data-ask-trip="${esc(t.id)}">Ask AI About This Trip</button></div></article>`;
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

reveal();
smoothScroll();
init();