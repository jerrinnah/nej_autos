/* =========================================================================
   NEJ Autos — public car detail page.
   Premium detail card + image carousel. Reads car details + referrer (?ref=)
   from the URL and records an enquiry attributed to the sharing partner.
   Self-contained: works even if the visitor has never opened the portal.
   ========================================================================= */
'use strict';

const PORTAL_KEY = 'nej_portal_v1';
const ATTR_KEY = 'nej_attributions';
const BGS = [
  'linear-gradient(135deg,#1e3a8a,#3b82f6)',
  'linear-gradient(135deg,#7c2d12,#f59e0b)',
  'linear-gradient(135deg,#7f1d1d,#ef4444)',
  'linear-gradient(135deg,#14532d,#22c55e)',
  'linear-gradient(135deg,#374151,#6b7280)',
  'linear-gradient(135deg,#0e7490,#22d3ee)',
];
const money = (n) => '₦' + Math.round(+n || 0).toLocaleString('en-NG');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name).split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'NEJ';

const P = new URLSearchParams(location.search);
const car = {
  id: P.get('id') || 'veh-unknown',
  ref: P.get('ref') || 'NEJ-DIRECT',
  by: P.get('by') || 'NEJ Autos',
  make: P.get('mk') || 'NEJ', model: P.get('mo') || 'Vehicle',
  year: P.get('yr') || '2024', price: +P.get('pr') || 0,
  emoji: P.get('em') || '🚗', body: P.get('bd') || 'Vehicle',
  mileage: +P.get('mi') || 0,
  bonus: P.get('bn') === '1', ev: P.get('ev') === '1',
  bg: BGS[+P.get('bg')] || BGS[0],
  // optional real photos: ?imgs=url1,url2 (comma-separated, url-encoded)
  imgs: (P.get('imgs') || '').split(',').map(s => s.trim()).filter(Boolean),
};

// carousel slides: real photos if provided, else 3 studio placeholder frames
const STUDIO = [
  'radial-gradient(circle at 50% 38%, #ffffff 0%, #eef1f5 70%, #e2e6ec 100%)',
  'radial-gradient(circle at 40% 42%, #ffffff 0%, #eaeef3 68%, #dbe1e8 100%)',
  'radial-gradient(circle at 60% 40%, #ffffff 0%, #edeff3 70%, #e4e8ee 100%)',
];
const slides = car.imgs.length
  ? car.imgs.map(u => `<div class="slide"><img src="${esc(u)}" alt="${esc(car.make + ' ' + car.model)}"></div>`)
  : STUDIO.map(g => `<div class="slide"><div class="studio" style="background:${g}"><span class="emoji">${car.emoji}</span></div></div>`);

const thumbs = car.imgs.length
  ? car.imgs.map((u, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-i="${i}"><img src="${esc(u)}" alt=""></button>`)
  : STUDIO.map((g, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-i="${i}"><span class="mini" style="background:${g}">${car.emoji}</span></button>`);

function specCell(k, v) {
  return `<div class="spec-cell"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

function specs() {
  return [
    specCell('Fuel', car.ev ? '⚡ Electric' : '⛽ Petrol'),
    specCell('Transmission', 'Automatic'),
    specCell('Mileage', car.mileage ? car.mileage.toLocaleString() + ' KM' : '—'),
    specCell('Body', esc(car.body)),
    specCell('Year', esc(car.year)),
    specCell('Condition', '✓ Certified'),
  ].join('');
}

function description() {
  return `The ${car.year} ${car.make} ${car.model} blends proven engineering with NEJ Autos' full inspection, ` +
         `title check and reconditioning — delivered ready to drive, and ready to sell.`;
}

function render() {
  document.getElementById('app').innerHTML = `
    <div class="detail">
      <div class="gallery">
        <div class="stage">
          <span class="avail">Available</span>
          <div class="viewport"><div class="track" id="track">${slides.join('')}</div></div>
          ${slides.length > 1 ? `
            <button class="nav prev" id="prev" aria-label="Previous">‹</button>
            <button class="nav next" id="next" aria-label="Next">›</button>` : ''}
        </div>
        ${slides.length > 1 ? `<div class="thumbs" id="thumbs">${thumbs.join('')}</div>` : ''}
      </div>

      <div class="info">
        <p class="eyebrow">${esc(car.body)} · ${esc(car.year)}</p>
        <h1>${esc(car.make)} ${esc(car.model)}</h1>
        <div class="price">${money(car.price)}<small>Certified price · inspected &amp; reconditioned</small></div>

        <div class="spec-grid">${specs()}</div>

        <p class="desc">${esc(description())}</p>

        <div class="actions" id="actions">
          <button class="btnx btnx-primary" onclick="showEnquiry()">I'm interested →</button>
          <button class="btnx btnx-outline" onclick="openShare()">🔗 Share &amp; earn</button>
        </div>

        <div class="trust"><span class="av">${esc(initials(car.by))}</span>Shared by <strong style="color:var(--body)">${esc(car.by)}</strong></div>
      </div>
    </div>
  `;
  if (slides.length > 1) initCarousel();
}

/* ------------------------------ Carousel -------------------------------- */
let idx = 0;
function initCarousel() {
  const track = document.getElementById('track');
  const n = slides.length;
  const thumbEls = Array.from(document.querySelectorAll('.thumb'));
  const to = (i) => {
    idx = (i + n) % n;
    track.style.transform = `translateX(${-idx * 100}%)`;
    thumbEls.forEach((t, k) => t.classList.toggle('active', k === idx));
  };
  document.getElementById('prev').addEventListener('click', () => to(idx - 1));
  document.getElementById('next').addEventListener('click', () => to(idx + 1));
  thumbEls.forEach((t) => t.addEventListener('click', () => to(+t.dataset.i)));

  // touch swipe
  let x0 = null;
  const vp = track.parentElement;
  vp.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) to(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}

/* ------------------------------ Enquiry --------------------------------- */
function showEnquiry() {
  document.getElementById('actions').innerHTML = `
    <div class="enq-form">
      <input id="bName" placeholder="Your name">
      <input id="bContact" placeholder="Phone or email">
      <button class="btnx btnx-primary" onclick="enquire()">Send enquiry →</button>
      <button class="btnx btnx-outline" onclick="render()">Cancel</button>
    </div>`;
  document.getElementById('bName').focus();
}

function enquire() {
  const name = document.getElementById('bName').value.trim();
  const contact = document.getElementById('bContact').value.trim();
  if (!name) { document.getElementById('bName').focus(); return; }

  const lead = {
    id: 'lead-' + Date.now(),
    customer: name,
    vehicle: `${car.make} ${car.model}`,
    phone: contact || '—',
    value: car.price,
    status: 'New',
    date: '2026-07-13',
    viaShare: 'shared link',
    ref: car.ref,
  };

  // If the referring partner is logged in on THIS browser, drop the lead straight
  // into their portal so they see it attributed. Otherwise queue it for later sync.
  let landed = false;
  try {
    const raw = localStorage.getItem(PORTAL_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      if (st && st.referralCode === car.ref) {
        st.leads.unshift(lead);
        localStorage.setItem(PORTAL_KEY, JSON.stringify(st));
        landed = true;
      }
    }
  } catch (e) { /* ignore */ }
  if (!landed) {
    try {
      const q = JSON.parse(localStorage.getItem(ATTR_KEY) || '[]');
      q.push(lead);
      localStorage.setItem(ATTR_KEY, JSON.stringify(q));
    } catch (e) { /* ignore */ }
  }

  document.getElementById('actions').innerHTML = `
    <div class="success">
      <div class="big">✅</div>
      <p style="margin:0.3rem 0 0"><strong>Thanks, ${esc(name.split(' ')[0])}!</strong><br>
      <span style="color:var(--muted);font-size:0.9rem">Sent to ${esc(car.by)} — you'll hear back shortly.</span></p>
    </div>`;
}

/* ------------------------- Share menu (social + copy) ------------------- */
const SOCIALS = [
  { key: 'whatsapp', label: 'WhatsApp', em: '💬' },
  { key: 'facebook', label: 'Facebook', em: '👍' },
  { key: 'x',        label: 'X',        em: '𝕏' },
  { key: 'telegram', label: 'Telegram', em: '✈️' },
];
function shareIntent(key, url, text) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  if (key === 'whatsapp') return 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
  if (key === 'facebook') return 'https://www.facebook.com/sharer/sharer.php?u=' + u + '&quote=' + t;
  if (key === 'x')        return 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u;
  if (key === 'telegram') return 'https://t.me/share/url?url=' + u + '&text=' + t;
  return null;
}
function sharePills() {
  const p = [];
  p.push(`<span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;color:#4b5563;border:1px solid #e7e9ee;border-radius:999px;padding:.26rem .65rem;background:#fff;"><span style="width:8px;height:8px;border-radius:50%;background:${car.ev ? '#22c55e' : '#3b82f6'}"></span>${esc(car.body)}</span>`);
  if (car.mileage) p.push(`<span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;color:#4b5563;border:1px solid #e7e9ee;border-radius:999px;padding:.26rem .65rem;background:#fff;">📍 ${car.mileage.toLocaleString()} KM</span>`);
  p.push(`<span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;color:#4b5563;border:1px solid #e7e9ee;border-radius:999px;padding:.26rem .65rem;background:#fff;">${car.ev ? '⚡ Electric' : '⚙️ Automatic'}</span>`);
  return p.join('');
}

function openShare() {
  const url = location.href;
  const text = `🚗 ${car.year} ${car.make} ${car.model} — ${money(car.price)}, certified by NEJ Autos. Take a look:`;

  const media = car.imgs.length
    ? `<img src="${esc(car.imgs[0])}" alt="" style="width:100%;height:210px;object-fit:cover;display:block;">`
    : `<div style="height:210px;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#ffffff 0%,#f1f3f6 72%,#e9ecf1 100%);font-size:6rem;filter:drop-shadow(0 16px 20px rgba(0,0,0,.16));">${car.emoji}</div>`;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:1.2rem;background:rgba(20,24,33,.55);backdrop-filter:blur(5px);';

  const card = document.createElement('div');
  card.style.cssText = 'width:min(430px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 40px 90px rgba(0,0,0,.4);position:relative;';
  card.innerHTML =
    '<button id="smx" aria-label="Close" style="position:absolute;top:.8rem;right:.8rem;z-index:3;background:rgba(255,255,255,.92);border:1px solid #e7e9ee;width:34px;height:34px;border-radius:50%;cursor:pointer;color:#5a616d;font-size:1rem;box-shadow:0 2px 8px rgba(0,0,0,.08);">✕</button>' +
    media +
    '<div style="padding:1.3rem 1.4rem 0;">' +
      '<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.9rem;">' + sharePills() + '</div>' +
      '<h2 style="margin:0;font-size:1.55rem;font-weight:800;letter-spacing:-.02em;color:#14161a;line-height:1.05;">' + esc(car.make + ' ' + car.model) + '</h2>' +
      '<p style="margin:.2rem 0 0;color:#9096a1;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:.8rem;">' + esc(car.body + ' · ' + car.year) + '</p>' +
      '<p style="margin:.8rem 0 0;color:#4b5563;font-size:.9rem;line-height:1.55;">' + esc(description()) + '</p>' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-top:1rem;">' +
        '<div style="font-size:1.5rem;font-weight:800;color:#14161a;letter-spacing:-.02em;">' + money(car.price) + '</div>' +
        '<span style="font-size:.72rem;font-weight:700;color:#12925a;text-transform:uppercase;letter-spacing:.05em;">● Available</span>' +
      '</div>' +
    '</div>' +
    '<div style="margin:1.2rem 1.1rem 1.1rem;padding:.9rem;background:#f7f8fa;border:1px solid #eef0f3;border-radius:14px;">' +
      '<div style="font-size:.72rem;font-weight:700;color:#8b909b;text-transform:uppercase;letter-spacing:.08em;margin:0 .2rem .7rem;">Share &amp; earn ₦2,500 per share</div>' +
      '<div id="smopts" style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;"></div>' +
      '<div id="smrow" style="display:flex;gap:.5rem;margin-top:.7rem;"></div>' +
    '</div>';

  const opts = card.querySelector('#smopts');
  SOCIALS.forEach((s) => {
    const b = document.createElement('button');
    b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.7rem .3rem;border:1px solid #e7e9ee;border-radius:10px;background:#fff;cursor:pointer;font-size:.68rem;font-weight:600;color:#5a616d;transition:border-color .15s ease;';
    b.innerHTML = '<span style="font-size:1.4rem;line-height:1">' + s.em + '</span>' + s.label;
    b.addEventListener('mouseenter', () => { b.style.borderColor = '#e0592b'; });
    b.addEventListener('mouseleave', () => { b.style.borderColor = '#e7e9ee'; });
    b.addEventListener('click', () => { const i = shareIntent(s.key, url, text); if (i) window.open(i, '_blank', 'noopener,noreferrer'); host.remove(); });
    opts.appendChild(b);
  });

  const row = card.querySelector('#smrow');
  const input = document.createElement('input');
  input.readOnly = true; input.value = url;
  input.style.cssText = 'flex:1;min-width:0;padding:.6rem .75rem;border:1px solid #e7e9ee;border-radius:9px;background:#fff;color:#8b909b;font-size:.76rem;font-family:ui-monospace,Menlo,monospace;';
  const copy = document.createElement('button');
  copy.textContent = 'Copy';
  copy.style.cssText = 'padding:.5rem 1rem;border:1.5px solid #e0592b;border-radius:9px;background:#fff;color:#e0592b;font-weight:700;cursor:pointer;white-space:nowrap;';
  copy.addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { copy.textContent = 'Copied!'; setTimeout(() => copy.textContent = 'Copy', 1500); }, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  });
  row.appendChild(input); row.appendChild(copy);

  card.querySelector('#smx').addEventListener('click', () => host.remove());
  host.appendChild(card);
  host.addEventListener('click', (e) => { if (e.target === host) host.remove(); });
  document.body.appendChild(host);
}

Object.assign(window, { render, showEnquiry, enquire, openShare });
render();
