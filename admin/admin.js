/* =========================================================================
   NEJ Autos — Admin control centre (SPA)
   Talks to the PHP API under ./api/. Session-cookie auth. No dependencies.
   ========================================================================= */
'use strict';

/* ------------------------------ helpers --------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = (n) => '₦' + Math.round(+n || 0).toLocaleString('en-NG');
const kmoney = (n) => {
  n = +n || 0;
  if (n >= 1e9) return '₦' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '₦' + Math.round(n / 1e3) + 'K';
  return '₦' + n;
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
const attr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

const BGS = [
  'linear-gradient(135deg,#1e3a8a,#3b82f6)', 'linear-gradient(135deg,#7c2d12,#f59e0b)',
  'linear-gradient(135deg,#7f1d1d,#ef4444)', 'linear-gradient(135deg,#14532d,#22c55e)',
  'linear-gradient(135deg,#374151,#6b7280)', 'linear-gradient(135deg,#0e7490,#22d3ee)',
];

/* ------------------------------ API layer ------------------------------- */
const API = 'api/';
async function api(path, { method = 'GET', body = null, form = null } = {}) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (form) { opts.body = form; }
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  let data = {};
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const err = new Error(data.message || ('Request failed (' + res.status + ')'));
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/* ------------------------------- toasts --------------------------------- */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* -------------------------------- state --------------------------------- */
const store = { admin: null, cars: [], leads: [], partners: [], payouts: [], shares: [], stats: null };
let currentView = 'overview';

/* =========================================================================
   Auth
   ========================================================================= */
async function boot() {
  try {
    const r = await api('auth.php');
    store.admin = r.admin;
    showApp();
  } catch (e) {
    if (e.status === 401) showLogin();
    else if (e.data && e.data.error === 'not_configured') showSetup(e.data.message);
    else showLogin(e.message);
  }
}

function showSetup(message) {
  $('#app').hidden = true; $('#auth').hidden = false;
  $('#auth').innerHTML = `
    <div class="auth-card">
      ${brandLogo()}
      <h1>Finish setup</h1>
      <p class="sub">The admin backend isn't configured yet.</p>
      <div class="setup-note">
        ${esc(message || 'Configuration missing.')}<br><br>
        <b>Steps on your cPanel host:</b><br>
        1. In <code>/admin/</code> copy <code>config.sample.php</code> → <code>config.php</code> and add your MySQL details.<br>
        2. Set an <code>install_token</code>, then open<br>
        <code>/admin/api/install.php?token=YOURTOKEN&user=admin&pass=YourPass&demo=1</code><br>
        3. Blank the token and reload this page.
      </div>
      <p class="auth-hint">See <code>/admin/README.md</code> for the full walkthrough.</p>
    </div>`;
}

function showLogin(errMsg) {
  $('#app').hidden = true; $('#auth').hidden = false;
  $('#auth').innerHTML = `
    <form class="auth-card" id="loginForm">
      ${brandLogo()}
      <h1>Admin sign in</h1>
      <p class="sub">Control centre for inventory, leads &amp; partners.</p>
      ${errMsg ? `<div class="auth-err">${esc(errMsg)}</div>` : ''}
      <div class="field">
        <label for="u">Username</label>
        <input class="input" id="u" name="username" autocomplete="username" required autofocus>
      </div>
      <div class="field">
        <label for="p">Password</label>
        <input class="input" id="p" name="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:.5rem" type="submit">Sign in →</button>
      <p class="auth-hint">Protected area · NEJ Autos</p>
    </form>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const r = await api('auth.php', { method: 'POST', body: { username: $('#u').value, password: $('#p').value } });
      store.admin = r.admin;
      showApp();
    } catch (err) {
      showLogin(err.message);
    }
  });
}

function brandLogo() {
  return `<div class="auth-logo"><div class="mark">NJ</div><div><b>NEJ Autos</b><span>Admin</span></div></div>`;
}

async function logout() {
  try { await api('auth.php?logout=1', { method: 'POST' }); } catch {}
  store.admin = null;
  showLogin();
}

/* =========================================================================
   App shell + navigation
   ========================================================================= */
const NAV = [
  { key: 'overview',  label: 'Overview',   ic: '📊' },
  { key: 'inventory', label: 'Inventory',  ic: '🚗' },
  { key: 'leads',     label: 'Leads',      ic: '📥' },
  { key: 'partners',  label: 'Partners',   ic: '🤝' },
  { key: 'payouts',   label: 'Payouts',    ic: '💸' },
  { key: 'shares',    label: 'Shares',     ic: '🔗' },
];

function showApp() {
  $('#auth').hidden = true; $('#app').hidden = false;
  renderSidebar();
  navigate(currentView);
}

function renderSidebar() {
  const counts = {
    inventory: store.cars.length || '',
    leads: store.leads.filter(l => l.status === 'New').length || '',
    partners: store.partners.length || '',
  };
  $('#sidebar').innerHTML = `
    <div class="brand"><div class="mark">NJ</div><div><b>NEJ Autos</b><span>Admin</span></div></div>
    <nav class="nav">
      ${NAV.map(n => `
        <div class="nav-item ${n.key === currentView ? 'active' : ''}" data-nav="${n.key}">
          <span class="ic">${n.ic}</span>${n.label}
          ${counts[n.key] ? `<span class="badge">${counts[n.key]}</span>` : ''}
        </div>`).join('')}
    </nav>
    <div class="side-foot">
      <a class="nav-item" href="../index.html" target="_blank"><span class="ic">🌐</span>View site</a>
      <div class="nav-item" data-logout><span class="ic">↩︎</span>Sign out</div>
      <div class="side-user">
        <div class="av">${esc(initials(store.admin?.name))}</div>
        <div><b>${esc(store.admin?.name || 'Admin')}</b><span>@${esc(store.admin?.username || '')}</span></div>
      </div>
    </div>`;
  $$('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  $('[data-logout]').addEventListener('click', logout);
}

function setTopbar(title, sub, actions = '') {
  $('#topbar').innerHTML = `
    <div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>
    <div class="spacer"></div>${actions}`;
}

function loadingView() { $('#view').innerHTML = `<div class="loading"><div class="spinner"></div>Loading…</div>`; }

async function navigate(key) {
  currentView = key;
  renderSidebar();
  loadingView();
  try {
    if (key === 'overview')  await viewOverview();
    if (key === 'inventory') await viewInventory();
    if (key === 'leads')     await viewLeads();
    if (key === 'partners')  await viewPartners();
    if (key === 'payouts')   await viewPayouts();
    if (key === 'shares')    await viewShares();
  } catch (e) {
    if (e.status === 401) { showLogin('Your session expired. Please sign in again.'); return; }
    $('#view').innerHTML = `<div class="empty"><div class="em">⚠️</div>${esc(e.message)}</div>`;
  }
}

/* =========================================================================
   Overview
   ========================================================================= */
async function viewOverview() {
  const r = await api('stats.php');
  const s = store.stats = r.stats;
  setTopbar('Overview', 'Everything at a glance — live from your database.');

  const kpi = (lbl, val, meta, glow) =>
    `<div class="kpi" style="--glow:${glow}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="meta">${meta}</div></div>`;

  const statusColors = { New: 'blue', Contacted: 'amber', Financing: 'purple', Won: 'green', Lost: 'red' };
  const lbs = s.leadsByStatus || {};
  const maxStatus = Math.max(1, ...Object.values(lbs));
  const plat = s.shares.byPlatform || {};
  const maxPlat = Math.max(1, ...Object.values(plat));
  const trendMax = Math.max(1, ...(s.trend || []).map(t => +t.val));

  $('#view').innerHTML = `
    <div class="kpis">
      ${kpi('Inventory value', kmoney(s.cars.value), `${s.cars.available} available · ${s.cars.sold} sold`, 'rgba(245,166,35,.2)')}
      ${kpi('Sales won', kmoney(s.leads.salesValue), `${s.leads.won} closed · ${s.leads.conversion}% conversion`, 'rgba(52,211,153,.2)')}
      ${kpi('Open leads', s.leads.open, `${s.leads.new} new · ${s.leads.attributed} via share links`, 'rgba(96,165,250,.2)')}
      ${kpi('Partners', s.partners.total, `${s.partners.active} active · ${s.partners.pending} pending`, 'rgba(167,139,250,.2)')}
      ${kpi('Payouts pending', kmoney(s.payouts.pending), `${kmoney(s.payouts.paid)} paid to date`, 'rgba(248,113,113,.2)')}
      ${kpi('Total shares', s.shares.total, `share-to-earn activity`, 'rgba(245,166,35,.2)')}
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Won sales value — last 6 months</h3></div>
        <div class="panel-body">
          ${(s.trend && s.trend.length) ? `
            <div class="spark">
              ${s.trend.map(t => `<div class="s" style="height:${Math.max(6, +t.val / trendMax * 100)}%" title="${esc(t.ym)} · ${money(t.val)}"></div>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:.5rem;font-size:.72rem;color:var(--faint)">
              ${s.trend.map(t => `<span>${esc(t.ym.slice(5))}</span>`).join('')}
            </div>` : `<div class="empty" style="padding:1.5rem">No won sales recorded yet.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Leads by status</h3></div>
        <div class="panel-body">
          <div class="bars">
            ${['New','Contacted','Financing','Won','Lost'].map(k => `
              <div class="bar-row">
                <span class="k">${k}</span>
                <div class="bar-track"><div class="bar-fill ${statusColors[k] === 'green' ? 'green' : statusColors[k] === 'blue' ? 'blue' : ''}" style="width:${(lbs[k] || 0) / maxStatus * 100}%"></div></div>
                <span class="v">${lbs[k] || 0}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Shares by platform</h3><div class="spacer"></div><span class="cell-sub">${s.shares.total} total</span></div>
        <div class="panel-body">
          ${Object.keys(plat).length ? `<div class="bars">
            ${Object.entries(plat).map(([k, v]) => `
              <div class="bar-row"><span class="k">${esc(k)}</span>
              <div class="bar-track"><div class="bar-fill blue" style="width:${v / maxPlat * 100}%"></div></div>
              <span class="v">${v}</span></div>`).join('')}
          </div>` : `<div class="empty" style="padding:1.5rem">No shares yet.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Available stock mix</h3></div>
        <div class="panel-body">
          ${(s.bodyMix && s.bodyMix.length) ? `<div class="bars">
            ${s.bodyMix.map(b => `
              <div class="bar-row"><span class="k">${esc(b.body)}</span>
              <div class="bar-track"><div class="bar-fill green" style="width:${b.c / Math.max(1, ...s.bodyMix.map(x => +x.c)) * 100}%"></div></div>
              <span class="v">${b.c}</span></div>`).join('')}
          </div>` : `<div class="empty" style="padding:1.5rem">No available stock.</div>`}
        </div>
      </div>
    </div>`;
}

/* =========================================================================
   Inventory
   ========================================================================= */
let invFilter = 'all', invSearch = '';

async function viewInventory() {
  const r = await api('cars.php');
  store.cars = r.cars;
  setTopbar('Inventory', `${store.cars.length} vehicles in your catalogue.`,
    `<button class="btn btn-primary" data-add-car>＋ Add vehicle</button>`);
  $('[data-add-car]').addEventListener('click', () => carModal());
  renderInventory();
}

function renderInventory() {
  const counts = { all: store.cars.length };
  ['Available', 'Reserved', 'Sold', 'Draft'].forEach(st => counts[st] = store.cars.filter(c => c.status === st).length);
  const seg = ['all', 'Available', 'Reserved', 'Sold', 'Draft']
    .map(k => `<button class="${invFilter === k ? 'on' : ''}" data-seg="${k}">${k === 'all' ? 'All' : k} ${counts[k] ? `· ${counts[k]}` : ''}</button>`).join('');

  let list = store.cars;
  if (invFilter !== 'all') list = list.filter(c => c.status === invFilter);
  if (invSearch) {
    const q = invSearch.toLowerCase();
    list = list.filter(c => (c.make + ' ' + c.model + ' ' + c.body).toLowerCase().includes(q));
  }

  $('#view').innerHTML = `
    <div class="toolbar">
      <div class="seg">${seg}</div>
      <div class="spacer"></div>
      <div class="search"><input class="input" id="invSearch" placeholder="Search make, model…" value="${attr(invSearch)}"></div>
    </div>
    ${list.length ? `<div class="card-grid">${list.map(carCard).join('')}</div>`
      : `<div class="empty"><div class="em">🚗</div>No vehicles here yet.<br><button class="btn btn-primary btn-sm" style="margin-top:1rem" data-add-car2>＋ Add your first vehicle</button></div>`}`;

  $$('[data-seg]').forEach(b => b.addEventListener('click', () => { invFilter = b.dataset.seg; renderInventory(); }));
  const sb = $('#invSearch');
  if (sb) sb.addEventListener('input', () => { invSearch = sb.value; const p = sb.selectionStart; renderInventory(); const n = $('#invSearch'); if (n) { n.focus(); n.setSelectionRange(p, p); } });
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => carModal(store.cars.find(c => c.id == b.dataset.edit))));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => deleteCar(b.dataset.del)));
  $$('[data-share]').forEach(b => b.addEventListener('click', () => shareModal(store.cars.find(c => c.id == b.dataset.share))));
  const a2 = $('[data-add-car2]'); if (a2) a2.addEventListener('click', () => carModal());
}

function statusPill(st) {
  const map = { Available: 'green', Reserved: 'amber', Sold: 'grey', Draft: 'blue' };
  return `<span class="pill ${map[st] || 'grey'}">${esc(st)}</span>`;
}

function carCard(c) {
  const media = c.photos && c.photos.length
    ? `<div class="car-media" style="background-image:url('${attr(c.photos[0])}')"><span class="status">${statusPill(c.status)}</span></div>`
    : `<div class="car-media" style="background:${BGS[c.bg] || BGS[0]}"><span class="status">${statusPill(c.status)}</span>${esc(c.emoji)}</div>`;
  return `
    <div class="car-card">
      ${media}
      <div class="car-body">
        <h4>${esc(c.make)} ${esc(c.model)}${c.is_ev ? '<span class="tag ev">EV</span>' : ''}${c.is_premium ? '<span class="tag prem">Premium</span>' : ''}</h4>
        <div class="yr">${esc(c.year)} · ${esc(c.body)} · ${c.mileage ? c.mileage.toLocaleString() + ' km' : 'New'}</div>
        <div class="price">${money(c.price)}</div>
      </div>
      <div class="car-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-share="${c.id}">🔗 Link</button>
        <button class="icon-btn" data-del="${c.id}" title="Delete">🗑</button>
      </div>
    </div>`;
}

function carModal(car) {
  const c = car || { make: '', model: '', year: 2024, price: 0, mileage: 0, body: 'SUV', emoji: '🚗', bg: 0,
    is_ev: false, is_premium: false, target_bonus: false, cond_score: 5, inspection: 'Certified', status: 'Available', photos: [] };
  const isEdit = !!car;
  const bodies = ['SUV', 'Sedan', 'Truck', 'EV', 'Premium', 'Coupe', 'Van', 'Hatchback', 'Vehicle'];

  openModal(isEdit ? 'Edit vehicle' : 'Add vehicle', `
    <div class="form-grid">
      <div class="field"><label>Make</label><input class="input" id="f_make" value="${attr(c.make)}"></div>
      <div class="field"><label>Model</label><input class="input" id="f_model" value="${attr(c.model)}"></div>
      <div class="field"><label>Year</label><input class="input" id="f_year" type="number" value="${c.year}"></div>
      <div class="field"><label>Price (₦)</label><input class="input" id="f_price" type="number" value="${c.price}"></div>
      <div class="field"><label>Mileage (km)</label><input class="input" id="f_mileage" type="number" value="${c.mileage}"></div>
      <div class="field"><label>Body type</label><select class="input" id="f_body">${bodies.map(b => `<option ${b === c.body ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select class="input" id="f_status">${['Available','Reserved','Sold','Draft'].map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Emoji (fallback)</label><input class="input" id="f_emoji" value="${attr(c.emoji)}" maxlength="4"></div>
      <div class="field"><label>Placeholder colour</label><select class="input" id="f_bg">${BGS.map((_, i) => `<option value="${i}" ${i === c.bg ? 'selected' : ''}>Gradient ${i + 1}</option>`).join('')}</select></div>
      <div class="field"><label>Condition score (0–5)</label><input class="input" id="f_cond" type="number" min="0" max="5" value="${c.cond_score}"></div>
      <div class="full" style="display:flex;gap:.7rem;flex-wrap:wrap">
        <label class="check"><input type="checkbox" id="f_ev" ${c.is_ev ? 'checked' : ''}> Electric</label>
        <label class="check"><input type="checkbox" id="f_prem" ${c.is_premium ? 'checked' : ''}> Premium</label>
        <label class="check"><input type="checkbox" id="f_bonus" ${c.target_bonus ? 'checked' : ''}> Bonus eligible</label>
      </div>
      <div class="full field">
        <label>Photos</label>
        <div class="dropzone" id="dz">📁 Click or drop images here to upload<br><span class="cell-sub">JPG / PNG / WEBP · up to 6MB each</span></div>
        <input type="file" id="fileInput" accept="image/*" multiple hidden>
        <div class="thumbs" id="thumbs"></div>
      </div>
    </div>
  `, isEdit ? 'Save changes' : 'Add vehicle', async () => saveCar(c, isEdit));

  // photo state lives on the modal
  let photos = Array.isArray(c.photos) ? c.photos.slice() : [];
  const renderThumbs = () => {
    $('#thumbs').innerHTML = photos.map((u, i) =>
      `<div class="th" style="background-image:url('${attr(u)}')"><button data-rm="${i}">✕</button></div>`).join('');
    $$('#thumbs [data-rm]').forEach(b => b.addEventListener('click', () => { photos.splice(+b.dataset.rm, 1); renderThumbs(); }));
  };
  renderThumbs();
  window.__getPhotos = () => photos;

  const dz = $('#dz'), fi = $('#fileInput');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('drag'); uploadFiles(e.dataTransfer.files); });
  fi.addEventListener('change', () => uploadFiles(fi.files));

  async function uploadFiles(files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('photos[]', f));
    dz.innerHTML = '⏳ Uploading…';
    try {
      const r = await api('cars.php?upload=1', { method: 'POST', form: fd });
      photos = photos.concat(r.urls);
      renderThumbs();
      toast('Uploaded ' + r.urls.length + ' photo(s)', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    dz.innerHTML = '📁 Click or drop images here to upload<br><span class="cell-sub">JPG / PNG / WEBP · up to 6MB each</span>';
  }
}

async function saveCar(c, isEdit) {
  const body = {
    make: $('#f_make').value, model: $('#f_model').value,
    year: +$('#f_year').value, price: +$('#f_price').value, mileage: +$('#f_mileage').value,
    body: $('#f_body').value, status: $('#f_status').value, emoji: $('#f_emoji').value,
    bg: +$('#f_bg').value, cond_score: +$('#f_cond').value,
    is_ev: $('#f_ev').checked, is_premium: $('#f_prem').checked, target_bonus: $('#f_bonus').checked,
    inspection: c.inspection || 'Certified',
    photos: (window.__getPhotos ? window.__getPhotos() : (c.photos || [])),
  };
  if (!body.make.trim() || !body.model.trim()) { toast('Make and model are required.', 'err'); return false; }
  const path = isEdit ? `cars.php?id=${c.id}` : 'cars.php';
  await api(path, { method: 'POST', body });
  toast(isEdit ? 'Vehicle updated' : 'Vehicle added', 'ok');
  closeModal();
  navigate('inventory');
  return true;
}

async function deleteCar(id) {
  const c = store.cars.find(x => x.id == id);
  if (!confirm(`Delete ${c ? c.make + ' ' + c.model : 'this vehicle'}? This cannot be undone.`)) return;
  await api(`cars.php?id=${id}`, { method: 'POST', body: { _delete: 1 } });
  toast('Vehicle deleted', 'ok');
  navigate('inventory');
}

/* --- shareable public car link (matches car.js query params) --- */
function carShareUrl(c, ref) {
  const base = new URL('../car.html', location.href);
  const p = base.searchParams;
  p.set('id', 'veh-' + c.id); p.set('mk', c.make); p.set('mo', c.model);
  p.set('yr', c.year); p.set('pr', c.price); p.set('em', c.emoji);
  p.set('bd', c.body); p.set('mi', c.mileage); p.set('bg', c.bg);
  if (c.is_ev) p.set('ev', '1');
  if (c.target_bonus) p.set('bn', '1');
  if (ref) p.set('ref', ref);
  if (c.photos && c.photos.length) {
    // resolve relative upload paths to absolute so links work when shared off-site
    const abs = c.photos.map(u => u.startsWith('http') ? u : new URL(u, location.origin).href);
    p.set('imgs', abs.join(','));
  }
  return base.href;
}

function shareModal(c) {
  const url = carShareUrl(c, '');
  openModal(`Share link — ${esc(c.make)} ${esc(c.model)}`, `
    <p class="cell-sub" style="margin-top:0">Public detail page a partner or customer can open. Add a partner referral code to attribute the enquiry.</p>
    <div class="field"><label>Attribute to referral code (optional)</label>
      <input class="input" id="shRef" placeholder="e.g. NEJ-AT-2612"></div>
    <div class="field"><label>Shareable link</label>
      <div class="copyfield"><input class="input" id="shUrl" readonly value="${attr(url)}"><button class="btn btn-primary btn-sm" id="shCopy">Copy</button></div>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem">
      <a class="btn btn-ghost btn-sm" id="shOpen" href="${attr(url)}" target="_blank">Open ↗</a>
      <a class="btn btn-ghost btn-sm" id="shWa" target="_blank">💬 WhatsApp</a>
    </div>
  `, null, null, 'Close');

  const refresh = () => {
    const u = carShareUrl(c, $('#shRef').value.trim());
    $('#shUrl').value = u; $('#shOpen').href = u;
    $('#shWa').href = 'https://wa.me/?text=' + encodeURIComponent(`${c.make} ${c.model} — ${money(c.price)}. ${u}`);
  };
  refresh();
  $('#shRef').addEventListener('input', refresh);
  $('#shCopy').addEventListener('click', () => {
    $('#shUrl').select();
    navigator.clipboard?.writeText($('#shUrl').value).then(() => toast('Link copied', 'ok'), () => {});
  });
}

/* =========================================================================
   Leads
   ========================================================================= */
let leadFilter = 'all';
const LEAD_STATUS = ['New', 'Contacted', 'Financing', 'Won', 'Lost'];

async function viewLeads() {
  const r = await api('leads.php');
  store.leads = r.leads;
  setTopbar('Leads', `${store.leads.length} enquiries · ${store.leads.filter(l => l.status === 'New').length} new`);
  renderLeads();
}

function renderLeads() {
  const counts = { all: store.leads.length };
  LEAD_STATUS.forEach(s => counts[s] = store.leads.filter(l => l.status === s).length);
  const seg = ['all', ...LEAD_STATUS].map(k =>
    `<button class="${leadFilter === k ? 'on' : ''}" data-seg="${k}">${k === 'all' ? 'All' : k} ${counts[k] ? `· ${counts[k]}` : ''}</button>`).join('');
  let list = leadFilter === 'all' ? store.leads : store.leads.filter(l => l.status === leadFilter);

  const statusColor = { New: 'blue', Contacted: 'amber', Financing: 'purple', Won: 'green', Lost: 'red' };

  $('#view').innerHTML = `
    <div class="toolbar"><div class="seg">${seg}</div></div>
    <div class="panel"><div class="tbl-wrap">
      ${list.length ? `<table class="tbl">
        <thead><tr><th>Customer</th><th>Vehicle</th><th>Contact</th><th class="num">Value</th><th>Source</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>${list.map(l => `
          <tr>
            <td class="cell-main">${esc(l.customer)}</td>
            <td>${esc(l.vehicle || '—')}</td>
            <td class="cell-sub">${esc(l.phone || '—')}</td>
            <td class="num">${l.value ? money(l.value) : '—'}</td>
            <td>${l.via_share ? `<span class="pill purple">${esc(l.via_share)}</span>` : '<span class="cell-sub">direct</span>'}</td>
            <td>
              <select class="input" style="padding:.35rem .6rem;min-width:120px" data-status="${l.id}">
                ${LEAD_STATUS.map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
            <td class="cell-sub">${esc(l.date)}</td>
            <td><button class="icon-btn" data-del-lead="${l.id}" title="Delete">🗑</button></td>
          </tr>`).join('')}
        </tbody></table>`
      : `<div class="empty"><div class="em">📥</div>No leads in this view.</div>`}
    </div></div>`;

  $$('[data-seg]').forEach(b => b.addEventListener('click', () => { leadFilter = b.dataset.seg; renderLeads(); }));
  $$('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    try { await api(`leads.php?id=${sel.dataset.status}`, { method: 'POST', body: { status: sel.value } });
      const l = store.leads.find(x => x.id == sel.dataset.status); if (l) l.status = sel.value;
      toast('Lead updated', 'ok'); renderLeads();
    } catch (e) { toast(e.message, 'err'); }
  }));
  $$('[data-del-lead]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this lead?')) return;
    await api(`leads.php?id=${b.dataset.delLead}`, { method: 'POST', body: { _delete: 1 } });
    store.leads = store.leads.filter(x => x.id != b.dataset.delLead);
    toast('Lead deleted', 'ok'); renderLeads();
  }));
}

/* =========================================================================
   Partners
   ========================================================================= */
async function viewPartners() {
  const r = await api('partners.php');
  store.partners = r.partners;
  setTopbar('Partners', `${store.partners.length} in the network`,
    `<button class="btn btn-primary" data-add-p>＋ Add partner</button>`);
  $('[data-add-p]').addEventListener('click', () => partnerModal());
  renderPartners();
}

function renderPartners() {
  const stColor = { Active: 'green', Pending: 'amber', Suspended: 'red' };
  $('#view').innerHTML = `
    <div class="panel"><div class="tbl-wrap">
      ${store.partners.length ? `<table class="tbl">
        <thead><tr><th>#</th><th>Partner</th><th>Code</th><th class="num">Units</th><th class="num">YTD</th><th class="num">Commission</th><th class="num">Shares</th><th>Status</th><th></th></tr></thead>
        <tbody>${store.partners.map((p, i) => `
          <tr>
            <td class="cell-sub">${i + 1}</td>
            <td><span class="row-emoji">${esc(initials(p.name))}</span><span class="cell-main">${esc(p.name)}</span><div class="cell-sub" style="margin-left:2.6rem">${esc(p.company || '—')}</div></td>
            <td class="cell-sub">${esc(p.referral_code)}</td>
            <td class="num">${p.units}</td>
            <td class="num">${p.ytd}</td>
            <td class="num">${money(p.commission)}</td>
            <td class="num">${p.shares}</td>
            <td><span class="pill ${stColor[p.status] || 'grey'}">${esc(p.status)}</span></td>
            <td style="white-space:nowrap">
              <button class="icon-btn" data-edit-p="${p.id}" title="Edit">✏️</button>
              <button class="icon-btn" data-del-p="${p.id}" title="Delete">🗑</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`
      : `<div class="empty"><div class="em">🤝</div>No partners yet.</div>`}
    </div></div>`;
  $$('[data-edit-p]').forEach(b => b.addEventListener('click', () => partnerModal(store.partners.find(p => p.id == b.dataset.editP))));
  $$('[data-del-p]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this partner?')) return;
    await api(`partners.php?id=${b.dataset.delP}`, { method: 'POST', body: { _delete: 1 } });
    toast('Partner removed', 'ok'); navigate('partners');
  }));
}

function partnerModal(p) {
  const isEdit = !!p;
  const d = p || { name: '', company: '', email: '', phone: '', referral_code: '', units: 0, ytd: 0, commission: 0, referrals: 0, shares: 0, status: 'Active' };
  openModal(isEdit ? 'Edit partner' : 'Add partner', `
    <div class="form-grid">
      <div class="field"><label>Name</label><input class="input" id="p_name" value="${attr(d.name)}"></div>
      <div class="field"><label>Company</label><input class="input" id="p_company" value="${attr(d.company)}"></div>
      <div class="field"><label>Email</label><input class="input" id="p_email" type="email" value="${attr(d.email)}"></div>
      <div class="field"><label>Phone</label><input class="input" id="p_phone" value="${attr(d.phone)}"></div>
      <div class="field"><label>Referral code</label><input class="input" id="p_code" value="${attr(d.referral_code)}" placeholder="auto-generated if blank"></div>
      <div class="field"><label>Status</label><select class="input" id="p_status">${['Active','Pending','Suspended'].map(s => `<option ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Units (month)</label><input class="input" id="p_units" type="number" value="${d.units}"></div>
      <div class="field"><label>YTD units</label><input class="input" id="p_ytd" type="number" value="${d.ytd}"></div>
      <div class="field"><label>Commission (₦)</label><input class="input" id="p_comm" type="number" value="${d.commission}"></div>
      <div class="field"><label>Shares</label><input class="input" id="p_shares" type="number" value="${d.shares}"></div>
    </div>
  `, isEdit ? 'Save' : 'Add partner', async () => {
    const body = {
      name: $('#p_name').value, company: $('#p_company').value, email: $('#p_email').value, phone: $('#p_phone').value,
      referral_code: $('#p_code').value, status: $('#p_status').value,
      units: +$('#p_units').value, ytd: +$('#p_ytd').value, commission: +$('#p_comm').value, shares: +$('#p_shares').value,
    };
    if (!body.name.trim()) { toast('Name is required.', 'err'); return false; }
    await api(isEdit ? `partners.php?id=${p.id}` : 'partners.php', { method: 'POST', body });
    toast(isEdit ? 'Partner updated' : 'Partner added', 'ok');
    closeModal(); navigate('partners'); return true;
  });
}

/* =========================================================================
   Payouts
   ========================================================================= */
async function viewPayouts() {
  const [rp, rpart] = await Promise.all([api('payouts.php'), store.partners.length ? Promise.resolve({ partners: store.partners }) : api('partners.php')]);
  store.payouts = rp.payouts; store.partners = rpart.partners;
  const pending = store.payouts.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const paid = store.payouts.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  setTopbar('Payouts', `${money(paid)} paid · ${money(pending)} pending`,
    `<button class="btn btn-primary" data-add-po>＋ New payout</button>`);
  $('[data-add-po]').addEventListener('click', () => payoutModal());
  renderPayouts();
}

function renderPayouts() {
  const stColor = { Paid: 'green', Pending: 'amber', Failed: 'red' };
  $('#view').innerHTML = `
    <div class="panel"><div class="tbl-wrap">
      ${store.payouts.length ? `<table class="tbl">
        <thead><tr><th>Ref</th><th>Partner</th><th>Description</th><th class="num">Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>${store.payouts.map(p => `
          <tr>
            <td class="cell-sub">${esc(p.ref)}</td>
            <td>${esc(p.partner_name || '—')}</td>
            <td>${esc(p.descr)}</td>
            <td class="num cell-main">${money(p.amount)}</td>
            <td><span class="pill ${stColor[p.status] || 'grey'}">${esc(p.status)}</span></td>
            <td class="cell-sub">${esc(p.paid_on || p.date)}</td>
            <td style="white-space:nowrap">
              ${p.status !== 'Paid' ? `<button class="btn btn-ghost btn-sm" data-pay="${p.id}">Mark paid</button>` : ''}
              <button class="icon-btn" data-del-po="${p.id}" title="Delete">🗑</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`
      : `<div class="empty"><div class="em">💸</div>No payouts recorded.</div>`}
    </div></div>`;
  $$('[data-pay]').forEach(b => b.addEventListener('click', async () => {
    await api(`payouts.php?id=${b.dataset.pay}`, { method: 'POST', body: { status: 'Paid' } });
    toast('Marked as paid', 'ok'); navigate('payouts');
  }));
  $$('[data-del-po]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this payout record?')) return;
    await api(`payouts.php?id=${b.dataset.delPo}`, { method: 'POST', body: { _delete: 1 } });
    toast('Payout deleted', 'ok'); navigate('payouts');
  }));
}

function payoutModal() {
  openModal('New payout', `
    <div class="form-grid">
      <div class="field full"><label>Partner</label><select class="input" id="po_partner"><option value="">— none —</option>${store.partners.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field full"><label>Description</label><input class="input" id="po_desc" value="Weekly commission run"></div>
      <div class="field"><label>Amount (₦)</label><input class="input" id="po_amt" type="number" value="0"></div>
      <div class="field"><label>Status</label><select class="input" id="po_status">${['Pending','Paid','Failed'].map(s => `<option>${s}</option>`).join('')}</select></div>
    </div>
  `, 'Create payout', async () => {
    const body = { partner_id: +$('#po_partner').value || 0, descr: $('#po_desc').value, amount: +$('#po_amt').value, status: $('#po_status').value };
    if (body.amount <= 0) { toast('Enter an amount.', 'err'); return false; }
    await api('payouts.php', { method: 'POST', body });
    toast('Payout created', 'ok'); closeModal(); navigate('payouts'); return true;
  });
}

/* =========================================================================
   Shares
   ========================================================================= */
async function viewShares() {
  const r = await api('shares.php');
  store.shares = r.shares;
  setTopbar('Shares', `${store.shares.length} share events logged`);
  const platIcon = { whatsapp: '💬', facebook: '👍', x: '𝕏', telegram: '✈️', email: '✉️', copy: '🔗', other: '•' };
  $('#view').innerHTML = `
    <div class="panel"><div class="tbl-wrap">
      ${store.shares.length ? `<table class="tbl">
        <thead><tr><th>Vehicle</th><th>Partner</th><th>Platform</th><th>Ref</th><th>Date</th><th></th></tr></thead>
        <tbody>${store.shares.map(sh => `
          <tr>
            <td class="cell-main">${esc(sh.vehicle || '—')}</td>
            <td>${esc(sh.partner_name || '—')}</td>
            <td><span class="pill blue">${platIcon[sh.platform] || '•'} ${esc(sh.platform)}</span></td>
            <td class="cell-sub">${esc(sh.ref || '—')}</td>
            <td class="cell-sub">${esc(sh.date)}</td>
            <td><button class="icon-btn" data-del-sh="${sh.id}" title="Delete">🗑</button></td>
          </tr>`).join('')}
        </tbody></table>`
      : `<div class="empty"><div class="em">🔗</div>No share activity yet.</div>`}
    </div></div>`;
  $$('[data-del-sh]').forEach(b => b.addEventListener('click', async () => {
    await api(`shares.php?id=${b.dataset.delSh}`, { method: 'POST', body: { _delete: 1 } });
    toast('Share removed', 'ok'); navigate('shares');
  }));
}

/* =========================================================================
   Modal system
   ========================================================================= */
function openModal(title, bodyHtml, primaryLabel, onPrimary, closeLabel = 'Cancel') {
  const host = $('#modal');
  host.hidden = false;
  host.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>${esc(closeLabel)}</button>
        ${primaryLabel ? `<button class="btn btn-primary" data-primary>${esc(primaryLabel)}</button>` : ''}
      </div>
    </div>`;
  $$('[data-close]', host).forEach(b => b.addEventListener('click', closeModal));
  host.addEventListener('click', backdropClose);
  if (primaryLabel && onPrimary) {
    $('[data-primary]', host).addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      try { const ok = await onPrimary(); if (ok === false) btn.disabled = false; }
      catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    });
  }
}
function backdropClose(e) { if (e.target === $('#modal')) closeModal(); }
function closeModal() {
  const host = $('#modal');
  host.hidden = true; host.innerHTML = '';
  host.removeEventListener('click', backdropClose);
  window.__getPhotos = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ------------------------------- start ---------------------------------- */
boot();
