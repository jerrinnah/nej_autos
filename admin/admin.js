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
const store = { admin: null, cars: [], leads: [], partners: [], payouts: [], shares: [], stats: null,
  notif: { pending: 0, today: 0, sharesToday: 0, recent: [] } };
let currentView = 'overview';

/* Notifications — the "seen" watermark is the highest signup id the admin has
   opened. Kept in localStorage so the bell is per-device, no server state. */
const SEEN_KEY = 'nej_admin_seen_signup';
function seenSignupId() { return +(localStorage.getItem(SEEN_KEY) || 0); }
function markSignupsSeen() {
  const top = store.notif.recent.reduce((m, s) => Math.max(m, s.id), 0);
  if (top) localStorage.setItem(SEEN_KEY, String(top));
}
function unreadSignups() {
  const seen = seenSignupId();
  return store.notif.recent.filter(s => s.id > seen).length;
}
async function loadNotifs() {
  try {
    const r = await api('stats.php');
    store.stats = r.stats;
    const g = r.stats.signups || {};
    store.notif = {
      pending: g.pending || 0, today: g.today || 0,
      sharesToday: (r.stats.shares && r.stats.shares.today) || 0,
      recent: g.recent || [],
    };
  } catch { /* not configured / not migrated — leave the empty defaults */ }
}
function timeAgo(ts) {
  const then = new Date((ts || '').replace(' ', 'T'));
  if (isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

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
  { key: 'overview',    label: 'Overview',    ic: '📊' },
  { key: 'inventory',   label: 'Inventory',   ic: '🚗' },
  { key: 'content',     label: 'Website',     ic: '🎨' },
  { key: 'leads',       label: 'Leads',       ic: '📥' },
  { key: 'accounts',    label: 'Accounts',    ic: '👥' },
  { key: 'withdrawals', label: 'Withdrawals', ic: '🏦' },
  { key: 'partners',    label: 'Partners',    ic: '🤝' },
  { key: 'payouts',     label: 'Payouts',     ic: '💸' },
  { key: 'shares',      label: 'Shares',      ic: '🔗' },
  { key: 'leaderboard', label: 'Top sharers', ic: '🏆' },
  { key: 'settings',    label: 'Settings',    ic: '⚙️' },
];

async function showApp() {
  $('#auth').hidden = true; $('#app').hidden = false;
  await loadNotifs();
  renderSidebar();
  navigate(currentView);
}

function renderSidebar() {
  const counts = {
    inventory: store.cars.length || '',
    leads: store.leads.filter(l => l.status === 'New').length || '',
    accounts: store.notif.pending || '',
    partners: store.partners.length || '',
  };
  const unread = unreadSignups();
  $('#sidebar').innerHTML = `
    <div class="brand">
      <div class="mark">NJ</div><div><b>NEJ Autos</b><span>Admin</span></div>
      <div class="spacer"></div>
      <button class="bell" data-bell title="Notifications">🔔${unread ? `<span class="bell-dot">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
    </div>
    <nav class="nav">
      ${NAV.map(n => `
        <div class="nav-item ${n.key === currentView ? 'active' : ''}" data-nav="${n.key}">
          <span class="ic">${n.ic}</span>${n.label}
          ${counts[n.key] ? `<span class="badge">${counts[n.key]}</span>` : ''}
        </div>`).join('')}
    </nav>
    <div class="side-foot">
      <a class="nav-item" href="../" target="_blank"><span class="ic">🌐</span>View site</a>
      <div class="nav-item" data-logout><span class="ic">↩︎</span>Sign out</div>
      <div class="side-user">
        <div class="av">${esc(initials(store.admin?.name))}</div>
        <div><b>${esc(store.admin?.name || 'Admin')}</b><span>@${esc(store.admin?.username || '')}</span></div>
      </div>
    </div>`;
  $$('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  $('[data-logout]').addEventListener('click', logout);
  $('[data-bell]').addEventListener('click', notifModal);
}

function notifModal() {
  const list = store.notif.recent;
  const seen = seenSignupId();
  const roledot = r => r === 'broker' ? '<span class="pill amber">broker</span>' : '<span class="pill purple">distributor</span>';
  const stColor = { Active: 'green', Pending: 'amber', Suspended: 'red' };
  openModal('Notifications', `
    <div class="notif-summary">
      <div><b>${store.notif.pending}</b><span>awaiting approval</span></div>
      <div><b>${store.notif.today}</b><span>signups today</span></div>
      <div><b>${store.notif.sharesToday}</b><span>shares today</span></div>
    </div>
    <h4 class="notif-h">Recent signups</h4>
    ${list.length ? `<div class="notif-list">${list.map(s => `
      <div class="notif-row ${s.id > seen ? 'is-new' : ''}">
        <span class="row-emoji">${esc(initials(s.name))}</span>
        <div class="notif-main">
          <b>${esc(s.name)}</b> ${roledot(s.role)}
          ${s.id > seen ? '<span class="pill blue">new</span>' : ''}
          <div class="cell-sub">${esc(s.email)} · ${esc(timeAgo(s.created_at))}</div>
        </div>
        <span class="pill ${stColor[s.status] || 'grey'}">${esc(s.status)}</span>
        ${s.status === 'Pending' ? `<button class="btn btn-primary btn-sm" data-napprove="${s.id}">Approve</button>` : ''}
      </div>`).join('')}</div>`
      : `<div class="empty" style="padding:1.5rem"><div class="em">🔔</div>No signups yet.</div>`}
  `, list.some(s => s.status === 'Pending') ? 'Review in Accounts' : '', () => {
    closeModal(); navigate('accounts'); return true;
  }, 'Close');

  $$('[data-napprove]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api(`users.php?id=${b.dataset.napprove}`, { method: 'POST', body: { status: 'Active' } });
      toast('Account approved', 'ok');
      await loadNotifs(); closeModal(); renderSidebar();
      if (currentView === 'accounts') navigate('accounts');
    } catch (e) { toast(e.message, 'err'); b.disabled = false; }
  }));

  markSignupsSeen();
  renderSidebar();
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
    if (key === 'content')   await viewContent();
    if (key === 'leads')     await viewLeads();
    if (key === 'partners')  await viewPartners();
    if (key === 'payouts')   await viewPayouts();
    if (key === 'shares')    await viewShares();
    if (key === 'leaderboard') await viewLeaderboard();
    if (key === 'accounts')  await viewAccounts();
    if (key === 'withdrawals') await viewWithdrawals();
    if (key === 'settings')  await viewSettings();
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
  // keep the bell / Accounts badge in sync with this fresh pull
  const g = s.signups || {};
  store.notif = { pending: g.pending || 0, today: g.today || 0,
    sharesToday: (s.shares && s.shares.today) || 0, recent: g.recent || [] };
  renderSidebar();
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
      ${kpi('Shares today', s.shares.today ?? 0, `${s.shares.week ?? 0} in the last 7 days · ${s.shares.total} all-time`, 'rgba(245,166,35,.2)')}
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
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Shares per day — last 14 days</h3><div class="spacer"></div><span class="cell-sub">${s.shares.today ?? 0} today</span></div>
      <div class="panel-body">
        ${(s.shares.daily && s.shares.daily.some(d => d.c > 0)) ? (() => {
          const daily = s.shares.daily, dMax = Math.max(1, ...daily.map(d => d.c));
          return `<div class="spark">
              ${daily.map(d => `<div class="s" style="height:${Math.max(6, d.c / dMax * 100)}%" title="${esc(d.d)} · ${d.c} share${d.c === 1 ? '' : 's'}"></div>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:.5rem;font-size:.72rem;color:var(--faint)">
              ${daily.map((d, i) => (i % 2 === 0) ? `<span>${esc(d.d.slice(5))}</span>` : '<span></span>').join('')}
            </div>`;
        })() : `<div class="empty" style="padding:1.5rem">No shares in the last 14 days.</div>`}
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
  const base = new URL('../car', location.href);   // clean URL — .htaccess maps /car → car.html
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
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = store.shares.filter(sh => sh.date === today).length;
  setTopbar('Shares', `${todayCount} today · ${store.shares.length} share events logged`);
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
   Top sharers — monthly bonus pool leaderboard
   ========================================================================= */
let lbPeriod = '';

function lbMonthOptions(current) {
  // last 6 months, newest first (YYYY-MM). Client-side is fine for a picker.
  const opts = []; const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 6; i++) {
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
    opts.push(`<option value="${ym}" ${ym === current ? 'selected' : ''}>${label}${i === 0 ? ' (this month)' : ''}</option>`);
    d.setMonth(d.getMonth() - 1);
  }
  return opts.join('');
}

async function viewLeaderboard() {
  let r;
  try { r = await api('leaderboard.php' + (lbPeriod ? `?period=${lbPeriod}` : '')); }
  catch (e) {
    if (e.status === 500) { $('#view').innerHTML = `<div class="empty"><div class="em">🧩</div>Run setup on the Accounts tab first.</div>`; setTopbar('Top sharers', ''); return; }
    throw e;
  }
  lbPeriod = r.period;
  const c = r.config;
  const roleP = ro => ro === 'broker' ? '<span class="pill amber">broker</span>' : '<span class="pill purple">distributor</span>';
  setTopbar('Top sharers', `Bonus pool for the highest sharers by unique clicks — ${r.label}.`,
    `<select class="input" id="lbPeriod" style="width:auto">${lbMonthOptions(lbPeriod)}</select>`);

  const total = r.paid ? r.paidTotal : r.totalPayout;
  const payable = c.pool > 0 && !r.paid && !r.isFuture && r.rows.some(x => x.payout > 0);

  $('#view').innerHTML = `
    ${c.pool <= 0 ? `<div class="banner amber"><span>💤</span><div><b>Feature is off.</b> Set a monthly <b>pool</b> under <b>Settings → Top-sharer bonus</b> to start rewarding your most active sharers — even when the sale didn't close through their link.</div></div>` : ''}
    <div class="kpis">
      <div class="kpi"><div class="lbl">Monthly pool</div><div class="val">${kmoney(c.pool)}</div><div class="meta">split among top ${c.winners}</div></div>
      <div class="kpi"><div class="lbl">Split method</div><div class="val" style="font-size:1.1rem">${c.weighted ? 'By clicks' : 'Equal'}</div><div class="meta">${c.weighted ? 'proportional to reach' : 'same to each winner'}</div></div>
      <div class="kpi"><div class="lbl">${r.paid ? 'Paid this month' : 'Will pay out'}</div><div class="val">${kmoney(total)}</div><div class="meta">${r.paid ? `paid ${esc(r.paidOn || '')}` : `to ${r.rows.filter(x => x.payout > 0).length} winner(s)`}</div></div>
      <div class="kpi"><div class="lbl">Ranked by</div><div class="val" style="font-size:1.1rem">Unique clicks</div><div class="meta">capped ${c.dayCap}/link/day (anti-fraud)</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Leaderboard — ${esc(r.label)}</h3><div class="spacer"></div>
        ${r.paid ? `<span class="pill green">✓ Paid ${esc(r.paidOn || '')}</span>`
          : `<button class="btn btn-primary btn-sm" id="lbPay" ${payable ? '' : 'disabled'}>Pay ${kmoney(total)} to ${r.rows.filter(x => x.payout > 0).length} winner(s)</button>`}
      </div>
      <div class="tbl-wrap">
        ${r.rows.length ? `<table class="tbl">
          <thead><tr><th>#</th><th>Sharer</th><th>Role</th><th class="num">Unique clicks</th><th class="num">${r.paid ? 'Paid' : 'Bonus'}</th></tr></thead>
          <tbody>${r.rows.map(x => `
            <tr>
              <td class="cell-main">${x.rank}</td>
              <td><span class="cell-main">${esc(x.name)}</span><div class="cell-sub">${esc(x.referral_code)}</div></td>
              <td>${roleP(x.role)}</td>
              <td class="num cell-main">${x.score.toLocaleString()}${x.raw > x.score ? `<div class="cell-sub">${x.raw.toLocaleString()} raw</div>` : ''}</td>
              <td class="num cell-main">${(r.paid ? (x.paidAmount || 0) : x.payout) > 0 ? money(r.paid ? x.paidAmount : x.payout) : '—'}</td>
            </tr>`).join('')}</tbody></table>`
          : `<div class="empty"><div class="em">🏁</div>No qualifying sharers yet for ${esc(r.label)}.<br><span class="cell-sub">Sharers need at least ${c.minClicks} unique click${c.minClicks === 1 ? '' : 's'} to appear.</span></div>`}
      </div>
    </div>
    <p class="cell-sub" style="max-width:640px">This bonus is <b>on top of</b> sale commissions and is paid from a fixed pool, so your monthly cost never exceeds ${kmoney(c.pool)} regardless of activity. Paying is one-time per month — the button locks once done.</p>`;

  const sel = $('#lbPeriod');
  if (sel) sel.addEventListener('change', () => { lbPeriod = sel.value; navigate('leaderboard'); });
  const payBtn = $('#lbPay');
  if (payBtn) payBtn.addEventListener('click', async () => {
    if (!confirm(`Pay ${money(total)} for ${r.label}? This credits each winner's withdrawable balance and can't be undone.`)) return;
    payBtn.disabled = true;
    try {
      const res = await api(`leaderboard.php?period=${lbPeriod}`, { method: 'POST' });
      toast(`Paid ${money(res.total)} to ${res.winners} winner(s)`, 'ok');
      navigate('leaderboard');
    } catch (e) { toast(e.message, 'err'); payBtn.disabled = false; }
  });
}

/* =========================================================================
   Accounts (broker / distributor)
   ========================================================================= */
let acctFilter = 'all';
async function viewAccounts() {
  let r;
  try { r = await api('users.php'); }
  catch (e) {
    if (e.status === 500 || (e.data && /users/i.test(e.message))) {
      $('#view').innerHTML = `<div class="empty"><div class="em">🧩</div>The broker/distributor tables aren't set up yet.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" id="runMig">Set up now</button></div>`;
      $('#runMig').addEventListener('click', runMigration);
      setTopbar('Accounts', 'Broker & distributor accounts.');
      return;
    }
    throw e;
  }
  store.users = r.users;
  const pending = store.users.filter(u => u.status === 'Pending').length;
  setTopbar('Accounts', `${store.users.length} accounts · ${pending} awaiting approval`);
  renderAccounts();
}

function renderAccounts() {
  const counts = { all: store.users.length };
  ['Pending', 'Active', 'Suspended'].forEach(s => counts[s] = store.users.filter(u => u.status === s).length);
  const seg = ['all', 'Pending', 'Active', 'Suspended'].map(k =>
    `<button class="${acctFilter === k ? 'on' : ''}" data-seg="${k}">${k === 'all' ? 'All' : k} ${counts[k] ? '· ' + counts[k] : ''}</button>`).join('');
  let list = acctFilter === 'all' ? store.users : store.users.filter(u => u.status === acctFilter);
  const stColor = { Active: 'green', Pending: 'amber', Suspended: 'red' };

  $('#view').innerHTML = `
    <div class="toolbar"><div class="seg">${seg}</div></div>
    <div class="panel"><div class="tbl-wrap">
      ${list.length ? `<table class="tbl">
        <thead><tr><th>Account</th><th>Role</th><th>Code</th><th class="num">Withdrawable</th><th class="num">Locked</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(u => `
          <tr>
            <td><span class="row-emoji">${esc(initials(u.name))}</span><span class="cell-main">${esc(u.name)}</span><div class="cell-sub" style="margin-left:2.6rem">${esc(u.email)}</div></td>
            <td>${u.role === 'broker' ? `<span class="pill amber">broker${u.commission_pct != null ? ' · ' + u.commission_pct + '%' : ''}</span>` : '<span class="pill purple">distributor</span>'}</td>
            <td class="cell-sub">${esc(u.referral_code)}</td>
            <td class="num cell-main">${money(u.balance.withdrawable)}</td>
            <td class="num cell-sub">${money(u.balance.pending)}</td>
            <td><span class="pill ${stColor[u.status] || 'grey'}">${esc(u.status)}</span></td>
            <td style="white-space:nowrap">
              ${u.status === 'Pending' ? `<button class="btn btn-primary btn-sm" data-approve="${u.id}">Approve</button>` : ''}
              <button class="icon-btn" data-edit-u="${u.id}" title="Edit">✏️</button>
              <button class="icon-btn" data-del-u="${u.id}" title="Delete">🗑</button>
            </td>
          </tr>`).join('')}</tbody></table>`
      : `<div class="empty"><div class="em">👥</div>No accounts in this view.</div>`}
    </div></div>`;

  $$('[data-seg]').forEach(b => b.addEventListener('click', () => { acctFilter = b.dataset.seg; renderAccounts(); }));
  $$('[data-approve]').forEach(b => b.addEventListener('click', async () => {
    await api(`users.php?id=${b.dataset.approve}`, { method: 'POST', body: { status: 'Active' } });
    toast('Account approved', 'ok'); await loadNotifs(); navigate('accounts');
  }));
  $$('[data-edit-u]').forEach(b => b.addEventListener('click', () => accountModal(store.users.find(u => u.id == b.dataset.editU))));
  $$('[data-del-u]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this account and all its links/earnings? This cannot be undone.')) return;
    await api(`users.php?id=${b.dataset.delU}`, { method: 'POST', body: { _delete: 1 } });
    toast('Account deleted', 'ok'); await loadNotifs(); navigate('accounts');
  }));
}

function accountModal(u) {
  openModal(`${esc(u.name)}`, `
    <div class="form-grid">
      <div class="field"><label>Status</label><select class="input" id="u_status">${['Pending','Active','Suspended'].map(s => `<option ${s === u.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Role</label><select class="input" id="u_role">${['broker','distributor'].map(s => `<option ${s === u.role ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field full"><label>Broker commission % (blank = use global default)</label><input class="input" id="u_pct" type="number" step="0.5" min="0" max="100" value="${u.commission_pct != null ? u.commission_pct : ''}" placeholder="e.g. 12"></div>
    </div>
    <p class="cell-sub">Code: <b>${esc(u.referral_code)}</b> · Joined ${esc(u.joined)} · ${money(u.balance.withdrawable)} withdrawable</p>
    <p class="cell-sub" style="margin-top:.3rem">Payout: ${u.account_number ? `<b>${esc(u.bank_name || '—')}</b> · ${esc(u.account_number)}${u.account_name ? ' · ' + esc(u.account_name) : ''}` : '<i>not provided yet</i>'}</p>
  `, 'Save', async () => {
    const pct = $('#u_pct').value.trim();
    await api(`users.php?id=${u.id}`, { method: 'POST', body: {
      status: $('#u_status').value, role: $('#u_role').value, commission_pct: pct === '' ? null : +pct } });
    toast('Account updated', 'ok'); closeModal(); navigate('accounts'); return true;
  });
}

async function runMigration() {
  try { const r = await api('migrate.php'); toast('Tables ready', 'ok'); navigate('accounts'); }
  catch (e) { toast(e.message, 'err'); }
}

/* =========================================================================
   Withdrawals
   ========================================================================= */
async function viewWithdrawals() {
  let r;
  try { r = await api('withdrawals.php?admin=1'); }
  catch (e) {
    if (e.status === 500) { $('#view').innerHTML = `<div class="empty"><div class="em">🧩</div>Run setup on the Accounts tab first.</div>`; setTopbar('Withdrawals', ''); return; }
    throw e;
  }
  const wds = r.withdrawals;
  const pending = wds.filter(w => w.status === 'Requested').length;
  setTopbar('Withdrawals', `${wds.length} total · ${pending} awaiting action`);
  const stColor = { Requested: 'amber', Approved: 'blue', Paid: 'green', Rejected: 'red' };

  $('#view').innerHTML = `
    <div class="panel"><div class="tbl-wrap">
      ${wds.length ? `<table class="tbl">
        <thead><tr><th>Account</th><th class="num">Amount</th><th>Method</th><th>Details</th><th>Status</th><th>Requested</th><th></th></tr></thead>
        <tbody>${wds.map(w => `
          <tr>
            <td><span class="cell-main">${esc(w.user.name)}</span> <span class="pill ${w.user.role === 'broker' ? 'amber' : 'purple'}" style="margin-left:.3rem">${esc(w.user.role)}</span><div class="cell-sub">${esc(w.user.email)}</div></td>
            <td class="num cell-main">${money(w.amount)}</td>
            <td class="cell-sub">${esc(w.method)}</td>
            <td class="cell-sub" style="max-width:220px;white-space:normal">${esc(w.detail)}</td>
            <td><span class="pill ${stColor[w.status] || 'grey'}">${esc(w.status)}</span></td>
            <td class="cell-sub">${esc(w.requested)}</td>
            <td style="white-space:nowrap">
              ${w.status === 'Requested' ? `<button class="btn btn-ghost btn-sm" data-wd="${w.id}" data-st="Approved">Approve</button>` : ''}
              ${w.status !== 'Paid' && w.status !== 'Rejected' ? `<button class="btn btn-primary btn-sm" data-wd="${w.id}" data-st="Paid">Mark paid</button>` : ''}
              ${w.status === 'Requested' ? `<button class="icon-btn" data-wd="${w.id}" data-st="Rejected" title="Reject">✕</button>` : ''}
            </td>
          </tr>`).join('')}</tbody></table>`
      : `<div class="empty"><div class="em">🏦</div>No withdrawal requests yet.</div>`}
    </div></div>`;

  $$('[data-wd]').forEach(b => b.addEventListener('click', async () => {
    await api(`withdrawals.php?admin=1&id=${b.dataset.wd}`, { method: 'POST', body: { status: b.dataset.st } });
    toast('Withdrawal ' + b.dataset.st.toLowerCase(), 'ok'); navigate('withdrawals');
  }));
}

/* =========================================================================
   Settings (economics)
   ========================================================================= */
async function viewSettings() {
  let r;
  try { r = await api('settings.php'); }
  catch (e) {
    if (e.status === 500) {
      $('#view').innerHTML = `<div class="empty"><div class="em">🧩</div>Broker/distributor tables aren't set up yet.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" id="runMig2">Set up now</button></div>`;
      $('#runMig2').addEventListener('click', runMigration); setTopbar('Settings', ''); return;
    }
    throw e;
  }
  const s = r.settings;
  setTopbar('Settings', 'Commission rate, points and payout rules.');
  $('#view').innerHTML = `
    <div class="panel" style="max-width:640px">
      <div class="panel-head"><h3>Economics</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="field"><label>Broker commission %</label><input class="input" id="set_rate" type="number" step="0.5" value="${s.broker_rate_pct}"></div>
          <div class="field"><label>Points per unique click</label><input class="input" id="set_cp" type="number" value="${s.click_points}"></div>
          <div class="field"><label>₦ value per point</label><input class="input" id="set_pv" type="number" value="${s.point_value_ngn}"></div>
          <div class="field"><label>Distributor sale bonus (₦)</label><input class="input" id="set_bonus" type="number" value="${s.distributor_sale_bonus_ngn}"></div>
          <div class="field"><label>Share reward (₦)</label><input class="input" id="set_sharereward" type="number" value="${s.share_reward_ngn}"></div>
          <div class="field"><label>Max counted shares / day</label><input class="input" id="set_sharecap" type="number" value="${s.max_counted_shares_per_day}"></div>
          <div class="field full"><label>Minimum withdrawal (₦)</label><input class="input" id="set_min" type="number" value="${s.min_withdrawal_ngn}"></div>
        </div>
        <p class="cell-sub">Share reward is paid per counted share (up to the daily cap) and unlocks when a car the partner shared is sold.</p>
        <button class="btn btn-primary" id="saveSet">Save settings</button>
      </div>
    </div>
    <div class="panel" style="max-width:640px">
      <div class="panel-head"><h3>Anti-fraud limits</h3></div>
      <div class="panel-body">
        <p class="cell-sub" style="margin-top:0">Guards against click farming. A distributor can only be rewarded for so many clicks per link each day, and click earnings unlock on a sale only up to a share of that car's real price.</p>
        <div class="form-grid">
          <div class="field"><label>Max rewarded clicks / link / day</label><input class="input" id="set_daycap" type="number" value="${s.max_click_points_per_link_day}"></div>
          <div class="field"><label>Click unlock cap (% of sale)</label><input class="input" id="set_unlockcap" type="number" value="${s.click_unlock_cap_pct}"></div>
          <div class="field full"><label>Share reward unlock cap (% of sale)</label><input class="input" id="set_shareunlock" type="number" value="${s.share_unlock_cap_pct}"></div>
        </div>
        <p class="cell-sub">When a shared car sells, pending share rewards for that car unlock only up to this share of the car's real price (oldest first) — so a month of stacked ₦${(+s.share_reward_ngn || 0).toLocaleString()}/day rewards can't all cash out on one thin-margin sale.</p>
        <button class="btn btn-primary" id="saveFraud">Save limits</button>
      </div>
    </div>
    <div class="panel" style="max-width:640px">
      <div class="panel-head"><h3>Top-sharer bonus</h3></div>
      <div class="panel-body">
        <p class="cell-sub" style="margin-top:0">Rewards your most active sharers each month by unique clicks — <b>even when the sale didn't close through their link</b> — from a fixed pool. Set the pool to <b>0</b> to switch it off. Pay it out on the <b>Top sharers</b> tab. Cost never exceeds the pool.</p>
        <div class="form-grid">
          <div class="field"><label>Monthly pool (₦) · 0 = off</label><input class="input" id="set_lbpool" type="number" value="${s.leaderboard_pool_ngn}"></div>
          <div class="field"><label>Number of winners</label><input class="input" id="set_lbwin" type="number" value="${s.leaderboard_winners}"></div>
          <div class="field"><label>Split method</label><select class="input" id="set_lbsplit"><option value="1" ${+s.leaderboard_split_weighted ? 'selected' : ''}>By clicks (weighted)</option><option value="0" ${+s.leaderboard_split_weighted ? '' : 'selected'}>Equal shares</option></select></div>
          <div class="field"><label>Min unique clicks to qualify</label><input class="input" id="set_lbmin" type="number" value="${s.leaderboard_min_clicks}"></div>
        </div>
        <button class="btn btn-primary" id="saveLb">Save bonus settings</button>
      </div>
    </div>
    <div class="panel" style="max-width:640px">
      <div class="panel-head"><h3>Security</h3></div>
      <div class="panel-body">
        <p class="cell-sub" style="margin-top:0">Change your admin password. You'll stay signed in.</p>
        <div class="form-grid">
          <div class="field full"><label>Current password</label><input class="input" id="pw_cur" type="password" autocomplete="current-password"></div>
          <div class="field"><label>New password</label><input class="input" id="pw_new" type="password" autocomplete="new-password"></div>
          <div class="field"><label>Confirm new password</label><input class="input" id="pw_conf" type="password" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-primary" id="savePw">Change password</button>
      </div>
    </div>
    <div class="panel" style="max-width:640px">
      <div class="panel-head"><h3>System</h3></div>
      <div class="panel-body">
        <p class="cell-sub" style="margin-top:0">Re-run the database migration if new tables are ever missing (safe — it only creates what's absent).</p>
        <button class="btn btn-ghost btn-sm" id="runMig3">Run migration</button>
      </div>
    </div>`;
  $('#saveSet').addEventListener('click', async () => {
    await api('settings.php', { method: 'POST', body: {
      broker_rate_pct: +$('#set_rate').value, click_points: +$('#set_cp').value,
      point_value_ngn: +$('#set_pv').value, distributor_sale_bonus_ngn: +$('#set_bonus').value,
      share_reward_ngn: +$('#set_sharereward').value, max_counted_shares_per_day: +$('#set_sharecap').value,
      min_withdrawal_ngn: +$('#set_min').value } });
    toast('Settings saved', 'ok');
  });
  $('#savePw').addEventListener('click', async () => {
    const cur = $('#pw_cur').value, nw = $('#pw_new').value, conf = $('#pw_conf').value;
    if (!cur || !nw) { toast('Fill in both password fields', 'err'); return; }
    if (nw.length < 6) { toast('New password must be at least 6 characters', 'err'); return; }
    if (nw !== conf) { toast('New passwords do not match', 'err'); return; }
    try {
      await api('auth.php?change_password=1', { method: 'POST', body: { current: cur, new: nw } });
      toast('Password changed', 'ok');
      $('#pw_cur').value = $('#pw_new').value = $('#pw_conf').value = '';
    } catch (e) { toast(e.message, 'err'); }
  });
  $('#saveFraud').addEventListener('click', async () => {
    await api('settings.php', { method: 'POST', body: {
      max_click_points_per_link_day: +$('#set_daycap').value,
      click_unlock_cap_pct: +$('#set_unlockcap').value,
      share_unlock_cap_pct: +$('#set_shareunlock').value } });
    toast('Limits saved', 'ok');
  });
  $('#saveLb').addEventListener('click', async () => {
    await api('settings.php', { method: 'POST', body: {
      leaderboard_pool_ngn: +$('#set_lbpool').value,
      leaderboard_winners: +$('#set_lbwin').value,
      leaderboard_split_weighted: +$('#set_lbsplit').value,
      leaderboard_min_clicks: +$('#set_lbmin').value } });
    toast('Bonus settings saved', 'ok');
  });
  $('#runMig3').addEventListener('click', runMigration);
}

/* =========================================================================
   Website (CMS) — hero slider + every editable block of homepage copy.
   Blocks are described declaratively in CMS_BLOCKS and rendered by a generic
   form builder, so adding a field is a one-line change here plus the matching
   default in api/_content_defaults.php.
   ========================================================================= */
let cmsData = {}, cmsSlides = [], cmsAutoplay = 6000;

/* Field types: text | area | lines | check | select | list */
const CMS_BLOCKS = [
  { key: 'nav', title: 'Header & navigation', hint: 'The bar across the top of the homepage.', fields: [
    { k: 'mark',        l: 'Logo mark',    t: 'text' },
    { k: 'brand',       l: 'Brand name',   t: 'text' },
    { k: 'brand_em',    l: 'Brand name — italic part', t: 'text' },
    { k: 'login_label', l: 'Login button', t: 'text' },
    { k: 'links',       l: 'Menu links',   t: 'lines', w: 'full', rows: 4,
      hint: 'One per line, as  Label | link  — e.g.  Fleet | #fleet' },
  ]},

  { key: 'hero', title: 'Hero (no-slider fallback)',
    hint: 'Used when the slider above has no live slides. The tabs show either way.', fields: [
    { k: 'headline',  l: 'Headline', t: 'area', w: 'full', rows: 2, hint: 'Line breaks are kept.' },
    { k: 'lead',      l: 'Sub-heading', t: 'area', w: 'full', rows: 2 },
    { k: 'cta_label', l: 'Link text', t: 'text' },
    { k: 'cta_href',  l: 'Link target', t: 'text' },
    { k: 'tabs',      l: 'Hero tabs', t: 'lines', w: 'full', rows: 3, hint: 'One tab per line.' },
  ]},

  { key: 'booking', title: 'Search bar', hint: 'The find-a-car strip under the hero.', fields: [
    { k: 'location_label', l: 'Location label', t: 'text' },
    { k: 'location_ph',    l: 'Location placeholder', t: 'text' },
    { k: 'type_label',     l: 'Car type label', t: 'text' },
    { k: 'budget_label',   l: 'Budget label', t: 'text' },
    { k: 'types',          l: 'Car type options', t: 'lines', rows: 6, hint: 'One per line.' },
    { k: 'budgets',        l: 'Budget options',  t: 'lines', rows: 6, hint: 'One per line.' },
    { k: 'btn',            l: 'Button text', t: 'text', w: 'full' },
  ]},

  { key: 'fleet', title: 'Fleet section', hint: 'Heading above the live inventory grid.', fields: [
    { k: 'kicker',      l: 'Kicker', t: 'text' },
    { k: 'title',       l: 'Heading', t: 'text' },
    { k: 'title_em',    l: 'Heading — highlighted', t: 'text' },
    { k: 'title_after', l: 'Heading — after highlight', t: 'text' },
    { k: 'text',        l: 'Intro text', t: 'area', w: 'full', rows: 2 },
    { k: 'empty',       l: 'Message when no cars are live', t: 'text', w: 'full' },
  ]},

  { key: 'share', title: 'Share & Earn section', hint: 'Wrap words in *asterisks* to bold them.', fields: [
    { k: 'kicker',      l: 'Kicker', t: 'text' },
    { k: 'title',       l: 'Heading', t: 'text' },
    { k: 'title_em',    l: 'Heading — highlighted', t: 'text' },
    { k: 'title_after', l: 'Heading — after highlight', t: 'text' },
    { k: 'text',        l: 'Intro text', t: 'area', w: 'full', rows: 2 },
    { k: 'steps', l: 'Steps', t: 'list', itemLabel: 'Step', cap: 6, cols: [
      { k: 'ico',   l: 'Icon',  t: 'text' },
      { k: 'title', l: 'Title', t: 'text' },
      { k: 'text',  l: 'Text',  t: 'area', w: 'full', rows: 2 },
    ]},
    { k: 'chips', l: 'Reward band', t: 'list', itemLabel: 'Reward', cap: 6, cols: [
      { k: 'v', l: 'Amount', t: 'text' },
      { k: 'k', l: 'Caption', t: 'text' },
    ]},
  ]},

  { key: 'tiers', title: 'Partner tiers', fields: [
    { k: 'kicker',      l: 'Kicker', t: 'text' },
    { k: 'title',       l: 'Heading', t: 'text' },
    { k: 'title_em',    l: 'Heading — highlighted', t: 'text' },
    { k: 'title_after', l: 'Heading — after highlight', t: 'text' },
    { k: 'text',        l: 'Intro text', t: 'area', w: 'full', rows: 2 },
    { k: 'items', l: 'Tiers', t: 'list', itemLabel: 'Tier', cap: 6, cols: [
      { k: 'medal', l: 'Badge', t: 'text' },
      { k: 'name',  l: 'Name',  t: 'text' },
      { k: 'tone',  l: 'Colour', t: 'select', opts: [
        { v: 'bronze', l: 'Bronze' }, { v: 'silver', l: 'Silver' },
        { v: 'gold',   l: 'Gold'   }, { v: 'plat',   l: 'Platinum' } ] },
      { k: 'units', l: 'Volume', t: 'text' },
      { k: 'rate',  l: 'Rate',   t: 'text' },
      { k: 'lbl',   l: 'Rate caption', t: 'text' },
      { k: 'featured', l: 'Highlighted', t: 'check', on: 'Outline this tier' },
      { k: 'perks', l: 'Perks', t: 'lines', w: 'full', rows: 3, hint: 'One per line.' },
    ]},
  ]},

  { key: 'quotes', title: 'Testimonials', fields: [
    { k: 'kicker',      l: 'Kicker', t: 'text' },
    { k: 'title',       l: 'Heading', t: 'text' },
    { k: 'title_em',    l: 'Heading — highlighted', t: 'text' },
    { k: 'title_after', l: 'Heading — after highlight', t: 'text' },
    { k: 'items', l: 'Quotes', t: 'list', itemLabel: 'Quote', cap: 9, cols: [
      { k: 'text',  l: 'Quote', t: 'area', w: 'full', rows: 3 },
      { k: 'name',  l: 'Name',  t: 'text' },
      { k: 'role',  l: 'Company', t: 'text' },
      { k: 'stars', l: 'Stars (0–5)', t: 'text' },
    ]},
  ]},

  { key: 'cta', title: 'Partner call-to-action', hint: 'The dark band with the application form.', fields: [
    { k: 'kicker',    l: 'Kicker', t: 'text' },
    { k: 'title',     l: 'Heading', t: 'area', w: 'full', rows: 2 },
    { k: 'text',      l: 'Body text', t: 'area', w: 'full', rows: 2 },
    { k: 'btn_label', l: 'Button text', t: 'text' },
    { k: 'btn_href',  l: 'Button target', t: 'text' },
    { k: 'stats', l: 'Stat strip', t: 'list', itemLabel: 'Stat', cap: 4, cols: [
      { k: 'n', l: 'Figure', t: 'text' },
      { k: 'l', l: 'Caption', t: 'text' },
    ]},
    { k: 'form_title', l: 'Form heading', t: 'text' },
    { k: 'form_btn',   l: 'Form button', t: 'text' },
    { k: 'form_text',  l: 'Form sub-text', t: 'text', w: 'full' },
    { k: 'form_email', l: 'Applications go to', t: 'text', w: 'full' },
  ]},

  { key: 'footer', title: 'Footer', fields: [
    { k: 'about',      l: 'About text', t: 'area', w: 'full', rows: 2 },
    { k: 'col1_title', l: 'Column 1 heading', t: 'text' },
    { k: 'col1_links', l: 'Column 1 links', t: 'lines', rows: 4, hint: 'Label | link' },
    { k: 'col2_title', l: 'Column 2 heading', t: 'text' },
    { k: 'col2_links', l: 'Column 2 links', t: 'lines', rows: 4, hint: 'Label | link' },
    { k: 'col3_title', l: 'Contact heading', t: 'text' },
    { k: 'email',      l: 'Contact email', t: 'text' },
    { k: 'phone',      l: 'Contact phone', t: 'text' },
    { k: 'copyright',  l: 'Copyright line', t: 'text' },
    { k: 'tagline',    l: 'Footer tagline', t: 'text' },
  ]},
];

async function viewContent() {
  let r;
  try { r = await api('content.php'); }
  catch (e) {
    if (e.status === 500) {
      $('#view').innerHTML = `<div class="empty"><div class="em">🧩</div>The website content tables aren't set up yet.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" id="runMigCms">Set up now</button></div>`;
      $('#runMigCms').addEventListener('click', runMigration);
      setTopbar('Website', ''); return;
    }
    throw e;
  }
  cmsData = r.content || {};
  cmsSlides = r.slides || [];
  try { const st = await api('settings.php'); cmsAutoplay = +st.settings.hero_autoplay_ms || 0; }
  catch { cmsAutoplay = 6000; }

  const live = cmsSlides.filter(s => s.active).length;
  setTopbar('Website', live
    ? `${live} live slide${live === 1 ? '' : 's'} — the slider is showing on the homepage.`
    : 'No live slides — the homepage is using its original hero.',
    `<a class="btn btn-ghost" href="../" target="_blank">🌐 Preview site</a>`);
  renderContent();
}

function renderContent() {
  const y = window.scrollY;
  $('#view').innerHTML = cmsSlidesPanel() + CMS_BLOCKS.map(cmsPanelHtml).join('');
  wireContent();
  window.scrollTo(0, y);
}

/* ------------------------------ hero slider ----------------------------- */
function cmsSlidesPanel() {
  return `
    <div class="panel">
      <div class="panel-head"><h3>Hero slider</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" data-slide-add>＋ Add slide</button></div>
      <div class="panel-body">
        <p class="cell-sub" style="margin-top:0">Live slides replace the homepage hero — photo, headline and button. Hide them all and the original hero comes back untouched.</p>
        ${cmsSlides.length
          ? `<div class="slide-list">${cmsSlides.map(cmsSlideRow).join('')}</div>`
          : `<div class="empty" style="padding:1.6rem"><div class="em">🖼</div>No slides yet.</div>`}
        <div class="form-grid" style="margin-top:1.4rem">
          <div class="field"><label>Autoplay delay (ms) · 0 = off</label>
            <input class="input" id="cms_autoplay" type="number" min="0" max="60000" step="500" value="${cmsAutoplay}"></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="cms_saveAuto">Save slider settings</button>
      </div>
    </div>`;
}

function cmsSlideRow(s, i) {
  return `
    <div class="slide-row">
      <div class="slide-thumb"${s.image ? ` style="background-image:url('${attr(s.image)}')"` : ''}>${s.image ? '' : '🖼'}</div>
      <div class="slide-main">
        <b>${esc(s.title || 'Untitled slide')}</b>
        <div class="cell-sub">${esc(s.subtitle || '—')}</div>
      </div>
      <span class="pill ${s.active ? 'green' : 'grey'}">${s.active ? 'Live' : 'Hidden'}</span>
      <div class="slide-ops">
        <button class="icon-btn" data-smove="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-smove="${i}" data-dir="1" title="Move down" ${i === cmsSlides.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-ghost btn-sm" data-sedit="${s.id}">Edit</button>
        <button class="icon-btn" data-sdel="${s.id}" title="Delete">🗑</button>
      </div>
    </div>`;
}

function cmsSlideModal(slide) {
  const s = slide || { image: '', title: '', subtitle: '', cta_label: 'View the fleet',
    cta_href: '#fleet', align: 'left', overlay: 55, active: true };
  const isEdit = !!slide;

  openModal(isEdit ? 'Edit slide' : 'Add slide', `
    <div class="form-grid">
      <div class="full field">
        <label>Slide image</label>
        <div class="dropzone" id="sdz">📁 Click or drop an image here<br><span class="cell-sub">Wide photos work best · JPG / PNG / WEBP</span></div>
        <input type="file" id="sfile" accept="image/*" hidden>
        <div class="thumbs" id="sthumb"></div>
      </div>
      <div class="full field"><label>Headline</label><input class="input" id="s_title" value="${attr(s.title)}"></div>
      <div class="full field"><label>Sub-heading</label><textarea class="input" id="s_sub" rows="2">${esc(s.subtitle)}</textarea></div>
      <div class="field"><label>Button text</label><input class="input" id="s_cl" value="${attr(s.cta_label)}"></div>
      <div class="field"><label>Button target</label><input class="input" id="s_ch" value="${attr(s.cta_href)}"></div>
      <div class="field"><label>Text position</label><select class="input" id="s_align">
        <option value="left" ${s.align === 'left' ? 'selected' : ''}>Left</option>
        <option value="center" ${s.align === 'center' ? 'selected' : ''}>Centred</option></select></div>
      <div class="field"><label>Photo darkening (%)</label><input class="input" id="s_ov" type="number" min="0" max="90" value="${s.overlay}"></div>
      <div class="full"><label class="check"><input type="checkbox" id="s_active" ${s.active ? 'checked' : ''}> Show this slide on the site</label></div>
    </div>
  `, isEdit ? 'Save slide' : 'Add slide', async () => cmsSaveSlide(s, isEdit));

  let image = s.image || '';
  const paint = () => {
    $('#sthumb').innerHTML = image
      ? `<div class="th" style="background-image:url('${attr(image)}')"><button data-rmimg>✕</button></div>` : '';
    const rm = $('#sthumb [data-rmimg]');
    if (rm) rm.addEventListener('click', () => { image = ''; paint(); });
  };
  paint();
  window.__getSlideImage = () => image;

  const dz = $('#sdz'), fi = $('#sfile');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('drag'); upload(e.dataTransfer.files); });
  fi.addEventListener('change', () => upload(fi.files));

  async function upload(files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    fd.append('image', files[0]);
    const label = dz.innerHTML;
    dz.innerHTML = '⏳ Uploading…';
    try {
      const r = await api('content.php?upload=1', { method: 'POST', form: fd });
      image = r.url; paint(); toast('Image uploaded', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    dz.innerHTML = label;
  }
}

async function cmsSaveSlide(s, isEdit) {
  const body = {
    image: window.__getSlideImage ? window.__getSlideImage() : (s.image || ''),
    title: $('#s_title').value, subtitle: $('#s_sub').value,
    cta_label: $('#s_cl').value, cta_href: $('#s_ch').value,
    align: $('#s_align').value, overlay: +$('#s_ov').value,
    active: $('#s_active').checked,
  };
  if (!body.title.trim() && !body.image) { toast('Add an image or a headline first.', 'err'); return false; }
  await api(isEdit ? `content.php?slide=1&id=${s.id}` : 'content.php?slide=1', { method: 'POST', body });
  toast(isEdit ? 'Slide saved' : 'Slide added', 'ok');
  closeModal();
  navigate('content');
  return true;
}

async function cmsDeleteSlide(id) {
  const s = cmsSlides.find(x => x.id == id);
  if (!confirm(`Delete "${s && s.title ? s.title : 'this slide'}"? This cannot be undone.`)) return;
  await api(`content.php?slide=1&id=${id}`, { method: 'POST', body: { _delete: 1 } });
  toast('Slide deleted', 'ok');
  navigate('content');
}

async function cmsMoveSlide(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= cmsSlides.length) return;
  const list = cmsSlides.slice();
  [list[i], list[j]] = [list[j], list[i]];
  cmsSlides = list;
  renderContent();
  try { await api('content.php?reorder=1', { method: 'POST', body: { ids: list.map(s => s.id) } }); }
  catch (e) { toast(e.message, 'err'); navigate('content'); }
}

/* --------------------------- generic block forms ------------------------ */
function cmsPanelHtml(spec) {
  const data = cmsData[spec.key] || {};
  return `
    <div class="panel">
      <div class="panel-head"><h3>${esc(spec.title)}</h3><div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" data-reset="${spec.key}">Reset</button></div>
      <div class="panel-body">
        ${spec.hint ? `<p class="cell-sub" style="margin-top:0">${esc(spec.hint)}</p>` : ''}
        <div class="form-grid">${spec.fields.map(f => cmsFieldHtml(spec.key, f, data)).join('')}</div>
        <button class="btn btn-primary" data-save="${spec.key}">Save changes</button>
      </div>
    </div>`;
}

function cmsFieldHtml(blockKey, f, data) {
  if (f.t === 'list') return cmsListHtml(blockKey, f, Array.isArray(data[f.k]) ? data[f.k] : []);
  return `
    <div class="field${f.w === 'full' ? ' full' : ''}">
      <label>${esc(f.l)}</label>
      ${cmsInput(`${blockKey}.${f.k}`, f, data[f.k])}
      ${f.hint ? `<span class="cell-sub">${esc(f.hint)}</span>` : ''}
    </div>`;
}

function cmsListHtml(blockKey, f, rows) {
  const path = `${blockKey}.${f.k}`;
  const item = (row, i) => `
    <div class="cms-item">
      <div class="cms-item-head">
        <b>${esc(f.itemLabel || 'Item')} ${i + 1}</b><div class="spacer"></div>
        <button class="icon-btn" data-rowmove="${path}" data-i="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-rowmove="${path}" data-i="${i}" data-dir="1" title="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" data-rowdel="${path}" data-i="${i}" title="Remove">🗑</button>
      </div>
      <div class="form-grid">
        ${f.cols.map(c => `
          <div class="field${c.w === 'full' ? ' full' : ''}">
            <label>${esc(c.l)}</label>
            ${cmsInput(`${path}.${i}.${c.k}`, c, row[c.k])}
            ${c.hint ? `<span class="cell-sub">${esc(c.hint)}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  return `
    <div class="field full">
      <label>${esc(f.l)}</label>
      <div class="cms-list">${rows.map(item).join('')}</div>
      <button class="btn btn-ghost btn-sm" data-rowadd="${path}" data-cap="${f.cap || 12}">
        ＋ Add ${esc((f.itemLabel || 'item').toLowerCase())}</button>
    </div>`;
}

function cmsInput(path, f, val) {
  const v = val == null ? '' : val;
  if (f.t === 'area' || f.t === 'lines')
    return `<textarea class="input" rows="${f.rows || 3}" data-cms="${path}">${esc(v)}</textarea>`;
  if (f.t === 'check')
    return `<label class="check"><input type="checkbox" data-cms="${path}" data-check ${+v ? 'checked' : ''}> ${esc(f.on || 'Yes')}</label>`;
  if (f.t === 'select')
    return `<select class="input" data-cms="${path}">${f.opts.map(o =>
      `<option value="${attr(o.v)}"${String(o.v) === String(v) ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  return `<input class="input" data-cms="${path}" value="${attr(v)}">`;
}

/* Read/write cmsData through a dotted path, e.g. "share.steps.0.text". */
function cmsAt(path) {
  const p = path.split('.');
  let o = cmsData;
  for (let i = 0; i < p.length - 1; i++) {
    if (o == null) return null;
    o = o[p[i]];
  }
  return o == null ? null : { obj: o, key: p[p.length - 1] };
}

/** The array behind a "block.listKey" path, or null. */
function cmsList(path) {
  let o = cmsData;
  for (const k of path.split('.')) { if (o == null) return null; o = o[k]; }
  return Array.isArray(o) ? o : null;
}

let cmsBound = false;

function wireContent() {
  const view = $('#view');

  // Every input writes straight back into cmsData, so re-rendering a list
  // never loses edits made elsewhere in the form. #view outlives each render,
  // so this delegation is bound once rather than per render.
  if (!cmsBound) {
    const capture = (e) => {
      const el = e.target.closest('[data-cms]');
      if (!el) return;
      const at = cmsAt(el.dataset.cms);
      if (at) at.obj[at.key] = el.hasAttribute('data-check') ? (el.checked ? 1 : 0) : el.value;
    };
    view.addEventListener('input', capture);
    view.addEventListener('change', capture);
    cmsBound = true;
  }

  $$('[data-save]', view).forEach(b => b.addEventListener('click', async () => {
    const key = b.dataset.save;
    b.disabled = true;
    try {
      const r = await api(`content.php?block=${encodeURIComponent(key)}`, { method: 'POST', body: cmsData[key] });
      cmsData[key] = r.value;
      toast('Saved — refresh the homepage to see it', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    b.disabled = false;
  }));

  $$('[data-reset]', view).forEach(b => b.addEventListener('click', async () => {
    const key = b.dataset.reset;
    if (!confirm('Restore this section to the original wording? Your changes to it are lost.')) return;
    try {
      const r = await api(`content.php?block=${encodeURIComponent(key)}&reset=1`, { method: 'POST', body: {} });
      cmsData[key] = r.value;
      renderContent();
      toast('Section reset', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }));

  $$('[data-rowadd]', view).forEach(b => b.addEventListener('click', () => {
    const list = cmsList(b.dataset.rowadd);
    if (!list) return;
    if (list.length >= +b.dataset.cap) { toast(`Up to ${b.dataset.cap} items here.`, 'err'); return; }
    const spec = cmsFindList(b.dataset.rowadd);
    const row = {};
    spec.cols.forEach(c => { row[c.k] = c.t === 'check' ? 0 : (c.t === 'select' ? c.opts[0].v : ''); });
    list.push(row);
    renderContent();
  }));

  $$('[data-rowdel]', view).forEach(b => b.addEventListener('click', () => {
    const list = cmsList(b.dataset.rowdel);
    if (list) { list.splice(+b.dataset.i, 1); renderContent(); }
  }));

  $$('[data-rowmove]', view).forEach(b => b.addEventListener('click', () => {
    const list = cmsList(b.dataset.rowmove);
    if (!list) return;
    const i = +b.dataset.i, j = i + (+b.dataset.dir);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    renderContent();
  }));

  const add = $('[data-slide-add]', view);
  if (add) add.addEventListener('click', () => cmsSlideModal());
  $$('[data-sedit]', view).forEach(b => b.addEventListener('click', () => cmsSlideModal(cmsSlides.find(s => s.id == b.dataset.sedit))));
  $$('[data-sdel]', view).forEach(b => b.addEventListener('click', () => cmsDeleteSlide(b.dataset.sdel)));
  $$('[data-smove]', view).forEach(b => b.addEventListener('click', () => cmsMoveSlide(+b.dataset.smove, +b.dataset.dir)));

  const sa = $('#cms_saveAuto', view);
  if (sa) sa.addEventListener('click', async () => {
    cmsAutoplay = +$('#cms_autoplay').value || 0;
    try {
      await api('settings.php', { method: 'POST', body: { hero_autoplay_ms: cmsAutoplay } });
      toast('Slider settings saved', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  });
}

/** Find the list field spec behind a "block.listKey" path. */
function cmsFindList(path) {
  const [blockKey, listKey] = path.split('.');
  const spec = CMS_BLOCKS.find(b => b.key === blockKey);
  return spec && spec.fields.find(f => f.k === listKey && f.t === 'list');
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
  window.__getSlideImage = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ------------------------------- start ---------------------------------- */
boot();
