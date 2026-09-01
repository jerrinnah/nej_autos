/* =========================================================================
   NEJ Autos — Partner Portal (broker / distributor)
   DB-backed SPA. Talks to /admin/api/. Session-cookie auth. No dependencies.
   ========================================================================= */
'use strict';

/* ------------------------------ helpers --------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = (n) => '₦' + Math.round(+n || 0).toLocaleString('en-NG');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
const initials = (n) => String(n || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
const BGS = ['linear-gradient(135deg,#1e3a8a,#3b82f6)','linear-gradient(135deg,#7c2d12,#f59e0b)','linear-gradient(135deg,#7f1d1d,#ef4444)','linear-gradient(135deg,#14532d,#22c55e)','linear-gradient(135deg,#374151,#6b7280)','linear-gradient(135deg,#0e7490,#22d3ee)'];

/* ------------------------------ API layer ------------------------------- */
const API = 'admin/api/';
async function api(path, { method = 'GET', body = null } = {}) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data.message || ('Request failed (' + res.status + ')')); e.status = res.status; e.data = data; throw e; }
  return data;
}

/* ------------------------------- toasts --------------------------------- */
function toast(msg, kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* -------------------------------- state --------------------------------- */
const store = { user: null, me: null, cars: [], links: [] };
let currentTab = 'dashboard';
let signupRole = 'distributor';

/* =========================================================================
   Auth
   ========================================================================= */
async function boot() {
  try {
    const r = await api('portal_auth.php');
    store.user = r.user;
    showApp();
  } catch (e) {
    if (e.data && e.data.error === 'not_configured') showAuth('login', 'The portal backend isn\'t configured yet. Please contact NEJ Autos.');
    else showAuth('login');
  }
}

function logoMark() { return `<div class="auth-logo"><div class="mark">NJ</div><div><b>NEJ Autos</b><span>Partner Portal</span></div></div>`; }

let authMode = 'login';
function showAuth(mode = 'login', err = '', ok = '') {
  authMode = mode;
  $('#app').hidden = true; $('#auth').hidden = false;
  $('#auth').innerHTML = `
    <div class="auth-card">
      ${logoMark()}
      <div class="auth-tabs">
        <button data-mode="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button>
        <button data-mode="signup" class="${mode === 'signup' ? 'on' : ''}">Join</button>
      </div>
      ${err ? `<div class="auth-err">${esc(err)}</div>` : ''}
      ${ok ? `<div class="auth-ok">${esc(ok)}</div>` : ''}
      ${mode === 'login' ? loginForm() : signupForm()}
    </div>`;
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.mode)));
  if (mode === 'login') wireLogin(); else wireSignup();
}

function loginForm() {
  return `
    <h1>Welcome back</h1>
    <p class="sub">Sign in to your broker or distributor account.</p>
    <form id="loginForm">
      <div class="field"><label>Email</label><input class="input" id="l_email" type="email" autocomplete="email" required autofocus></div>
      <div class="field"><label>Password</label><input class="input" id="l_pass" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Sign in →</button>
    </form>
    <p class="auth-hint">New to the network? Tap “Join” above.</p>`;
}
function wireLogin() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const r = await api('portal_auth.php', { method: 'POST', body: { email: $('#l_email').value, password: $('#l_pass').value } });
      store.user = r.user; showApp();
    } catch (err) { showAuth('login', err.message); }
  });
}

function signupForm() {
  return `
    <h1>Join NEJ Autos</h1>
    <p class="sub">Choose how you want to earn. An admin approves new accounts.</p>
    <form id="signupForm">
      <div class="role-pick">
        <div class="role-opt ${signupRole === 'broker' ? 'on' : ''}" data-role="broker">
          <b>🤝 Broker</b><span>Sell cars, earn commission on each sale.</span>
        </div>
        <div class="role-opt ${signupRole === 'distributor' ? 'on' : ''}" data-role="distributor">
          <b>🔗 Distributor</b><span>Share links, earn from clicks + sales.</span>
        </div>
      </div>
      <div class="field"><label>Full name</label><input class="input" id="s_name" required></div>
      <div class="field"><label>Email</label><input class="input" id="s_email" type="email" required></div>
      <div class="field"><label>Phone</label><input class="input" id="s_phone"></div>
      <div class="field"><label>Company (optional)</label><input class="input" id="s_company"></div>
      <div class="field"><label>Password</label><input class="input" id="s_pass" type="password" minlength="6" required></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Create account →</button>
    </form>`;
}
function wireSignup() {
  $$('[data-role]').forEach(el => el.addEventListener('click', () => { signupRole = el.dataset.role; showAuth('signup'); }));
  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const r = await api('portal_auth.php?signup=1', { method: 'POST', body: {
        name: $('#s_name').value, email: $('#s_email').value, phone: $('#s_phone').value,
        company: $('#s_company').value, role: signupRole, password: $('#s_pass').value } });
      showAuth('login', '', r.message || 'Account created — awaiting admin approval.');
    } catch (err) { showAuth('signup', err.message); }
  });
}

async function logout() {
  try { await api('portal_auth.php?logout=1', { method: 'POST' }); } catch {}
  store.user = null; showAuth('login');
}

/* =========================================================================
   App shell
   ========================================================================= */
function tabsFor(role) {
  if (role === 'distributor') return [
    { key: 'dashboard', label: '🏠 Home' },
    { key: 'inventory', label: '🚗 Share Cars' },
    { key: 'links',     label: '🔗 My Links' },
    { key: 'earnings',  label: '💰 My Money' },
    { key: 'settings',  label: '⚙️ Settings' },
  ];
  return [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'links',     label: 'My Links' },
    { key: 'earnings',  label: 'Commission' },
    { key: 'settings',  label: 'Settings' },
  ];
}

function showApp() {
  $('#auth').hidden = true; $('#app').hidden = false;
  renderTopbar();
  navigate(currentTab);
}

function renderTopbar() {
  const u = store.user;
  $('#topbar').innerHTML = `
    <div class="mark">NJ</div>
    <div class="who"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
    <div class="spacer"></div>
    <span class="role-badge ${u.role}">${u.role}</span>
    <span class="code-chip" id="codeChip" title="Your referral code — click to copy">🏷 ${esc(u.referral_code)}</span>
    <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>`;
  $('#logoutBtn').addEventListener('click', logout);
  $('#codeChip').addEventListener('click', () => { navigator.clipboard?.writeText(u.referral_code); toast('Referral code copied', 'ok'); });
}

function renderTabs() {
  $('#tabs').innerHTML = tabsFor(store.user.role).map(t =>
    `<div class="tab ${t.key === currentTab ? 'on' : ''}" data-tab="${t.key}">${t.label}${t.key === 'links' && store.links.length ? `<span class="n">${store.links.length}</span>` : ''}</div>`).join('');
  $$('[data-tab]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.tab)));
}

function loadingView() { $('#view').innerHTML = `<div class="loading"><div class="spinner"></div>Loading…</div>`; }

async function navigate(tab) {
  currentTab = tab; renderTabs(); loadingView();
  try {
    if (tab === 'dashboard') await viewDashboard();
    if (tab === 'inventory') await viewInventory();
    if (tab === 'links')     await viewLinks();
    if (tab === 'earnings')  await viewEarnings();
    if (tab === 'settings')  await viewSettings();
    renderTabs();
  } catch (e) {
    if (e.status === 401) { showAuth('login', 'Your session expired — please sign in again.'); return; }
    $('#view').innerHTML = `<div class="empty"><div class="em">⚠️</div>${esc(e.message)}</div>`;
  }
}

/* -------------------------------------------------------------------------
   Participation widgets — a streak meter and the first-payout perk. Both read
   straight off me.php, so the portal always shows the same numbers the API
   will actually enforce.
   ------------------------------------------------------------------------- */

/* Daily share allowance + how close the user is to doubling it. */
function streakCard(me) {
  const sh = me.shares || {};
  const need = +sh.streakNeed || 0;
  if (!need || (+sh.streakCap || 0) <= (+sh.baseCap || 0)) return '';   // streaks switched off
  const streak = +sh.streak || 0;
  const done = Math.min(streak, need);
  const left = Math.max(0, need - streak);
  const pips = Array.from({ length: need }, (_, i) =>
    `<i class="${i < done ? 'on' : ''}"></i>`).join('');

  return `
    <div class="streak ${sh.boosted ? 'boosted' : ''}">
      <div class="streak-top">
        <span class="streak-fire">${sh.boosted ? '🔥' : streak ? '🔥' : '💤'}</span>
        <div class="streak-txt">
          <b>${streak === 0 ? 'Start a streak today' : `${streak}-day streak`}</b>
          <small>${sh.boosted
            ? `Boost active — <b>${sh.streakCap}</b> shares count today instead of ${sh.baseCap}.`
            : left === need
              ? `Share on ${need} days running and your daily counted shares go from ${sh.baseCap} to ${sh.streakCap}.`
              : `${left} more day${left === 1 ? '' : 's'} running and your daily counted shares double to ${sh.streakCap}.`}</small>
        </div>
        <span class="streak-today">${sh.today || 0}<em>/${sh.cap} today</em></span>
      </div>
      <div class="streak-pips">${pips}</div>
    </div>`;
}

/* Same-day promise, shown only while the partner has never been paid. */
function firstPayoutNote(me) {
  if (!me.config || !me.config.first_payout_same_day) return '';
  return `<div class="banner green"><span>⚡</span><div><b>Your first payout clears the same day.</b> Request it before the end of the day and NEJ Autos pays it before the next one.</div></div>`;
}

/* =========================================================================
   Dashboard
   ========================================================================= */
async function viewDashboard() {
  const me = store.me = (await api('me.php'));
  if (me.user.role === 'distributor') renderDistributorHome(me);
  else renderBrokerHome(me);
}

/* ---- Distributor: simplified, plain-language home ---------------------- */
function renderDistributorHome(me) {
  const b = me.balance;
  const first = (me.user.name || '').split(' ')[0] || 'there';
  const ready = b.withdrawable;
  const waiting = b.pending;
  const canWithdraw = ready >= me.config.min_withdrawal;
  const perClick = me.config.click_points * me.config.point_value_ngn;

  $('#view').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div>
          <h2 class="hero-hi">Hi ${esc(first)} 👋</h2>
          <p class="hero-sub">${me.links.count
            ? `<b>${me.links.clicks.toLocaleString()}</b> clicks so far across <b>${me.links.count}</b> ${me.links.count === 1 ? 'link' : 'links'}.`
            : `Share your first car link and start earning.`}</p>
        </div>
      </div>
      <div class="hero-figs">
        <div class="fig ready"><span class="fig-lbl">Ready to withdraw</span><span class="fig-val">${money(ready)}</span></div>
        <div class="fig wait"><span class="fig-lbl">Waiting on a sale</span><span class="fig-val">${money(waiting)}</span></div>
      </div>
      <button class="btn btn-primary" id="wdHero" ${canWithdraw ? '' : 'disabled'} style="width:100%;margin-top:1rem">
        ${canWithdraw ? 'Withdraw ' + money(ready) + ' →' : '🔒 Unlocks when a car you shared is sold'}
      </button>
    </div>

    <button class="cta-share" id="ctaShare">
      <span class="cta-ic">🔗</span>
      <span class="cta-txt"><b>Share a car &amp; earn</b><small>${money(perClick)} for every new person who clicks</small></span>
      <span class="cta-arrow">→</span>
    </button>

    ${streakCard(me)}
    ${firstPayoutNote(me)}

    <div class="steps">
      <div class="step"><span class="step-n">1</span><b>Share a link</b><small>Pick a car, tap Share, send it anywhere.</small></div>
      <div class="step"><span class="step-n">2</span><b>People click</b><small>You earn ${money(perClick)} per new visitor, tracked for you.</small></div>
      <div class="step"><span class="step-n">3</span><b>Car sells → cash out</b><small>Your earnings unlock and you can withdraw.</small></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Recent activity</h3></div>
      <div class="panel-body">
        ${me.ledger.length
          ? `<div class="act-list">${me.ledger.map(actItem).join('')}</div>`
          : `<div class="empty" style="padding:1.4rem"><div class="em">✨</div>Nothing yet — share a car to see your earnings roll in.</div>`}
      </div>
    </div>`;

  const wh = $('#wdHero'); if (wh && canWithdraw) wh.addEventListener('click', () => withdrawModal(ready, me.config.min_withdrawal));
  $('#ctaShare').addEventListener('click', () => navigate('inventory'));
}

/* friendly one-line activity row (no jargon) */
function actItem(l) {
  let icon = '👆', text = 'Someone clicked your link';
  if (l.type === 'sale_bonus') { icon = '🎉'; text = 'A car you shared sold — bonus!'; }
  else if (l.type === 'sale_commission') { icon = '💰'; text = 'Commission earned'; }
  else if (l.type === 'leaderboard_bonus') { icon = '🏆'; text = l.note || 'Top-sharer bonus'; }
  else if (l.type === 'adjustment') { icon = '⚙️'; text = l.note || 'Adjustment'; }
  const amt = l.amount ? '+' + money(l.amount) : '';
  const tag = l.status === 'available'
    ? '<span class="tiny green">ready ✓</span>'
    : '<span class="tiny">waiting for sale</span>';
  return `<div class="act">
    <span class="act-ic">${icon}</span>
    <div class="act-main"><b>${esc(text)}</b><small>${esc(l.date)}</small></div>
    <div class="act-amt">${amt}<div>${tag}</div></div>
  </div>`;
}

/* ---- Broker: full metrics view (unchanged) ----------------------------- */
function renderBrokerHome(me) {
  const b = me.balance;
  const kpi = (lbl, val, meta, glow, lock) =>
    `<div class="kpi ${lock ? 'lock' : ''}" style="--glow:${glow}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="meta">${meta}</div></div>`;

  $('#view').innerHTML = `
    <div class="banner amber"><span>💡</span><div>You earn <b>${me.config.broker_rate_pct}% commission</b> on every car you close${me.config.min_commission ? `, and never less than <b>${money(me.config.min_commission)}</b> on a sale — however cheap the car` : ''}. Share a car's link, and when the buyer's enquiry is marked <b>Won</b>, your commission becomes withdrawable.</div></div>
    ${firstPayoutNote(me)}
    ${streakCard(me)}
    <div class="kpis">
      ${kpi('Withdrawable', money(b.withdrawable), b.withdrawable > 0 ? 'Ready to withdraw' : 'Unlocks after a sale', 'rgba(52,211,153,.2)')}
      ${kpi('Pending commission', money(b.pending), 'Clears when sale confirmed', 'rgba(245,166,35,.2)', true)}
      ${kpi('Sales won', me.salesWon, `${me.links.count} links shared`, 'rgba(96,165,250,.2)')}
      ${kpi('This week', money(me.week.amount), 'earned this week', 'rgba(245,166,35,.2)')}
      ${kpi('Total clicks', me.links.clicks.toLocaleString(), `${me.links.uniques.toLocaleString()} unique`, 'rgba(96,165,250,.2)')}
      ${kpi('Shares', (me.shares ? me.shares.total : 0).toLocaleString(), me.shares ? `${me.shares.today}/${me.shares.cap} counted today${me.shares.streak ? ` · 🔥 ${me.shares.streak}-day streak` : ''}` : 'shared', 'rgba(167,139,250,.2)')}
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Recent activity</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="goShare">Share a car →</button></div>
      <div class="tbl-wrap">
        ${me.ledger.length ? `<table class="tbl">
          <thead><tr><th>Type</th><th>Detail</th><th class="num">Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${me.ledger.map(l => `
            <tr>
              <td>${ledgerTag(l.type)}</td>
              <td class="cell-sub">${esc(l.note || '—')}</td>
              <td class="num cell-main">${l.amount ? money(l.amount) : '—'}</td>
              <td>${l.status === 'available' ? '<span class="pill green">available</span>' : '<span class="pill grey">locked</span>'}</td>
              <td class="cell-sub">${esc(l.date)}</td>
            </tr>`).join('')}</tbody></table>`
          : `<div class="empty"><div class="em">✨</div>No activity yet — share your first car link to get going.</div>`}
      </div>
    </div>`;
  $('#goShare').addEventListener('click', () => navigate('inventory'));
}

function ledgerTag(t) {
  const map = {
    click_points: '<span class="pill purple">click</span>',
    share_reward: '<span class="pill purple">share</span>',
    sale_commission: '<span class="pill amber">commission</span>',
    sale_bonus: '<span class="pill green">sale bonus</span>',
    leaderboard_bonus: '<span class="pill green">top-sharer bonus</span>',
    adjustment: '<span class="pill grey">adjustment</span>',
  };
  return map[t] || `<span class="pill grey">${esc(t)}</span>`;
}

/* =========================================================================
   Inventory (browse available cars → get a tracked link)
   ========================================================================= */
async function viewInventory() {
  const [rc, rl] = await Promise.all([api('cars.php?public=1'), api('links.php')]);
  store.cars = rc.cars; store.links = rl.links;
  const linkByCar = {}; store.links.forEach(l => linkByCar[l.car_id] = l);

  $('#view').innerHTML = `
    <div class="banner"><span>🔗</span><div>Pick a car and tap <b>Get my link</b>. Every click on your link is tracked to you${store.user.role === 'broker' ? ' and any resulting sale pays your commission' : ' and earns points'}.</div></div>
    ${store.cars.length ? `<div class="card-grid">${store.cars.map(c => carCard(c, linkByCar[c.id])).join('')}</div>`
      : `<div class="empty"><div class="em">🚗</div>No cars are available right now. Check back soon.</div>`}`;

  $$('[data-getlink]').forEach(b => b.addEventListener('click', () => getLink(+b.dataset.getlink)));
  $$('[data-openshare]').forEach(b => b.addEventListener('click', () => {
    const l = store.links.find(x => x.id == b.dataset.openshare); if (l) shareModal(l);
  }));
}

function carCard(c, link) {
  const media = c.photos && c.photos.length
    ? `<div class="car-media" style="background-image:url('${attr(c.photos[0])}')"></div>`
    : `<div class="car-media" style="background:${BGS[c.bg] || BGS[0]}">${esc(c.emoji)}</div>`;
  return `
    <div class="car-card">
      ${media}
      <div class="car-body">
        <h4>${esc(c.make)} ${esc(c.model)}</h4>
        <div class="yr">${esc(c.year)} · ${esc(c.body)}</div>
        <div class="price">${money(c.price)}</div>
      </div>
      <div class="car-foot">
        ${link
          ? `<button class="btn btn-ghost btn-sm" data-openshare="${link.id}">🔗 Share link · ${link.clicks} clicks</button>`
          : `<button class="btn btn-primary btn-sm" data-getlink="${c.id}">Get my link</button>`}
      </div>
    </div>`;
}

async function getLink(carId) {
  try {
    const r = await api('links.php', { method: 'POST', body: { car_id: carId } });
    if (!store.links.find(l => l.id === r.link.id)) store.links.push(r.link);
    toast(r.existing ? 'Here is your existing link' : 'Tracked link created', 'ok');
    shareModal(r.link);
  } catch (e) { toast(e.message, 'err'); }
}

/* =========================================================================
   My Links
   ========================================================================= */
async function viewLinks() {
  const r = await api('links.php'); store.links = r.links;
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>My tracked links</h3><div class="spacer"></div>
        <span class="cell-sub">${store.links.length} link(s)</span></div>
      <div class="tbl-wrap">
        ${store.links.length ? `<table class="tbl">
          <thead><tr><th>Vehicle</th><th>Short link</th><th class="num">Clicks</th><th class="num">Unique</th><th>Created</th><th></th></tr></thead>
          <tbody>${store.links.map(l => `
            <tr>
              <td class="cell-main">${esc(l.emoji || '🚗')} ${esc(l.make || '')} ${esc(l.model || '')}</td>
              <td class="cell-sub" style="font-family:ui-monospace,Menlo,monospace">/l/${esc(l.slug)}</td>
              <td class="num cell-main">${l.clicks}</td>
              <td class="num">${l.uniques}</td>
              <td class="cell-sub">${esc(l.created_at)}</td>
              <td><button class="btn btn-ghost btn-sm" data-share="${l.id}">Share</button></td>
            </tr>`).join('')}</tbody></table>`
          : `<div class="empty"><div class="em">🔗</div>No links yet. Go to <b>Inventory</b> and tap “Get my link”.</div>`}
      </div>
    </div>`;
  $$('[data-share]').forEach(b => b.addEventListener('click', () => shareModal(store.links.find(l => l.id == b.dataset.share))));
}

/* =========================================================================
   Earnings / Commission + withdrawals
   ========================================================================= */
async function viewEarnings() {
  const me = store.me = (await api('me.php'));
  if (me.user.role === 'distributor') renderDistributorMoney(me);
  else renderBrokerCommission(me);
}

/* ---- Distributor: simple "My Money" ------------------------------------ */
function renderDistributorMoney(me) {
  const b = me.balance;
  const canWithdraw = b.withdrawable >= me.config.min_withdrawal;

  $('#view').innerHTML = `
    <div class="hero">
      <div class="hero-figs">
        <div class="fig ready"><span class="fig-lbl">Ready to withdraw</span><span class="fig-val">${money(b.withdrawable)}</span></div>
        <div class="fig wait"><span class="fig-lbl">Waiting on a sale</span><span class="fig-val">${money(b.pending)}</span></div>
      </div>
      <button class="btn btn-primary" id="wdBtn" ${canWithdraw ? '' : 'disabled'} style="width:100%;margin-top:1rem">
        ${canWithdraw ? 'Withdraw ' + money(b.withdrawable) + ' →' : '🔒 Unlocks when a car you shared is sold'}
      </button>
      <p class="hero-sub" style="margin-top:.8rem;text-align:center">
        ${canWithdraw
          ? 'NEJ Autos reviews and pays your withdrawal.'
          : `You need ${money(me.config.min_withdrawal)} unlocked. Earnings unlock the moment a car you shared sells.`}
      </p>
    </div>

    ${firstPayoutNote(me)}

    ${me.withdrawals.length ? `<div class="panel">
      <div class="panel-head"><h3>Your withdrawals</h3></div>
      <div class="panel-body"><div class="act-list">
        ${me.withdrawals.map(w => `<div class="act">
          <span class="act-ic">🏦</span>
          <div class="act-main"><b>${money(w.amount)}</b><small>Requested ${esc(w.requested)}</small></div>
          <div class="act-amt">${wdPill(w.status)}</div>
        </div>`).join('')}
      </div></div>
    </div>` : ''}

    <div class="panel">
      <div class="panel-head"><h3>Where your money came from</h3></div>
      <div class="panel-body">
        ${me.ledger.length ? `<div class="act-list">${me.ledger.map(actItem).join('')}</div>`
          : `<div class="empty" style="padding:1.4rem"><div class="em">💰</div>No earnings yet — share a car to begin.</div>`}
      </div>
    </div>`;

  const wb = $('#wdBtn'); if (wb && canWithdraw) wb.addEventListener('click', () => withdrawModal(b.withdrawable, me.config.min_withdrawal));
}

/* ---- Broker: full commission view -------------------------------------- */
function renderBrokerCommission(me) {
  const b = me.balance;
  const canWithdraw = b.withdrawable >= me.config.min_withdrawal;

  $('#view').innerHTML = `
    <div class="kpis">
      <div class="kpi" style="--glow:rgba(52,211,153,.2)"><div class="lbl">Withdrawable</div><div class="val">${money(b.withdrawable)}</div><div class="meta">min ${money(me.config.min_withdrawal)}</div></div>
      <div class="kpi lock" style="--glow:rgba(245,166,35,.2)"><div class="lbl">Pending commission</div><div class="val">${money(b.pending)}</div><div class="meta">clears when sale confirmed</div></div>
      <div class="kpi" style="--glow:rgba(96,165,250,.2)"><div class="lbl">Reserved</div><div class="val">${money(b.reserved)}</div><div class="meta">in withdrawal requests</div></div>
    </div>

    ${firstPayoutNote(me)}

    <div class="panel">
      <div class="panel-head"><h3>Withdraw earnings</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="wdBtn" ${canWithdraw ? '' : 'disabled'}>Request withdrawal</button></div>
      <div class="panel-body">
        ${canWithdraw
          ? `<p class="cell-sub" style="margin:0">You have ${money(b.withdrawable)} ready. Withdrawals are reviewed and paid by NEJ Autos.</p>`
          : `<p class="cell-sub" style="margin:0">Nothing withdrawable yet. Commission unlocks when a sale you brokered is confirmed. Minimum withdrawal is ${money(me.config.min_withdrawal)}.</p>`}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Withdrawal history</h3></div>
      <div class="tbl-wrap">
        ${me.withdrawals.length ? `<table class="tbl">
          <thead><tr><th class="num">Amount</th><th>Status</th><th>Requested</th><th>Processed</th></tr></thead>
          <tbody>${me.withdrawals.map(w => `
            <tr><td class="num cell-main">${money(w.amount)}</td>
            <td>${wdPill(w.status)}</td>
            <td class="cell-sub">${esc(w.requested)}</td>
            <td class="cell-sub">${esc(w.processed || '—')}</td></tr>`).join('')}</tbody></table>`
          : `<div class="empty" style="padding:1.6rem">No withdrawals yet.</div>`}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Earnings ledger</h3></div>
      <div class="tbl-wrap">
        ${me.ledger.length ? `<table class="tbl">
          <thead><tr><th>Type</th><th>Detail</th><th class="num">Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${me.ledger.map(l => `
            <tr><td>${ledgerTag(l.type)}</td><td class="cell-sub">${esc(l.note || '—')}</td>
            <td class="num cell-main">${l.amount ? money(l.amount) : '—'}</td>
            <td>${l.status === 'available' ? '<span class="pill green">available</span>' : '<span class="pill grey">locked</span>'}</td>
            <td class="cell-sub">${esc(l.date)}</td></tr>`).join('')}</tbody></table>`
          : `<div class="empty" style="padding:1.6rem">No earnings yet.</div>`}
      </div>
    </div>`;

  const wb = $('#wdBtn'); if (wb && canWithdraw) wb.addEventListener('click', () => withdrawModal(b.withdrawable, me.config.min_withdrawal));
}

function wdPill(s) {
  const m = { Requested: 'amber', Approved: 'blue', Paid: 'green', Rejected: 'red' };
  return `<span class="pill ${m[s] || 'grey'}">${esc(s)}</span>`;
}

/* =========================================================================
   Settings — profile + payout details (self-service)
   ========================================================================= */
async function viewSettings() {
  const [p, me] = await Promise.all([api('profile.php'), api('me.php')]);
  store.me = me;
  const pf = p.profile;
  const b = me.balance, min = me.config.min_withdrawal;
  const ready = b.withdrawable >= min;

  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>💳 Payout details</h3>
        <div class="spacer"></div>
        ${pf.has_payout ? '<span class="pill green">saved</span>' : '<span class="pill amber">add your account</span>'}
      </div>
      <div class="panel-body">
        <div class="banner ${ready ? '' : 'amber'}"><span>${ready ? '✅' : '💡'}</span><div>
          ${ready
            ? `You have <b>${money(b.withdrawable)}</b> ready. Make sure your account details below are correct, then head to <b>${me.user.role === 'distributor' ? 'My Money' : 'Commission'}</b> to withdraw.`
            : `Add your account number now so you're ready. Payout <b>unlocks automatically</b> once your balance reaches <b>${money(min)}</b> — which happens when a car you shared is sold.`}
        </div></div>
        <div class="form-grid">
          <div class="field"><label>Bank name</label><input class="input" id="pf_bank" value="${attr(pf.bank_name)}" placeholder="e.g. GTBank"></div>
          <div class="field"><label>Account number</label><input class="input" id="pf_acct" inputmode="numeric" value="${attr(pf.account_number)}" placeholder="10-digit NUBAN"></div>
          <div class="field full"><label>Account name (must match the bank account)</label><input class="input" id="pf_acctname" value="${attr(pf.account_name)}" placeholder="e.g. ${attr(pf.name || 'Your full name')}"></div>
        </div>
        <button class="btn btn-primary" id="pf_savePay">Save payout details</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>👤 Profile</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="field"><label>Name</label><input class="input" value="${attr(pf.name)}" disabled></div>
          <div class="field"><label>Email</label><input class="input" value="${attr(pf.email)}" disabled></div>
          <div class="field"><label>Phone</label><input class="input" id="pf_phone" value="${attr(pf.phone)}" placeholder="Phone number"></div>
          <div class="field"><label>Company (optional)</label><input class="input" id="pf_company" value="${attr(pf.company)}" placeholder="Business name"></div>
        </div>
        <p class="cell-sub">Your referral code <b>${esc(pf.referral_code)}</b> and account type can't be changed here — contact NEJ Autos if they're wrong.</p>
        <button class="btn btn-ghost" id="pf_saveProfile">Save profile</button>
      </div>
    </div>`;

  $('#pf_savePay').addEventListener('click', async (e) => {
    const acct = $('#pf_acct').value.replace(/\D+/g, '');
    if (acct && (acct.length < 5 || acct.length > 20)) { toast('Enter a valid account number (digits only).', 'err'); return; }
    e.target.disabled = true;
    try {
      await api('profile.php', { method: 'POST', body: {
        bank_name: $('#pf_bank').value.trim(),
        account_number: acct,
        account_name: $('#pf_acctname').value.trim(),
      }});
      toast('Payout details saved', 'ok'); navigate('settings');
    } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
  });

  $('#pf_saveProfile').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await api('profile.php', { method: 'POST', body: {
        phone: $('#pf_phone').value.trim(), company: $('#pf_company').value.trim() }});
      toast('Profile saved', 'ok'); e.target.disabled = false;
    } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
  });
}

function withdrawModal(max, min) {
  const pay = (store.me && store.me.payout) || {};
  const saved = pay.has_payout
    ? [pay.bank_name, pay.account_number, pay.account_name].filter(Boolean).join(' · ')
    : '';
  openModal('Request withdrawal', `
    <p class="cell-sub" style="margin-top:0">Available: <b style="color:var(--green)">${money(max)}</b></p>
    <div class="field"><label>Amount (₦)</label><input class="input" id="w_amt" type="number" min="${min}" max="${max}" value="${max}"></div>
    <div class="field"><label>Payout method</label>
      <select class="input" id="w_method"><option>Bank transfer</option><option>Mobile money</option><option>Other</option></select></div>
    <div class="field"><label>Account details</label><textarea class="input" id="w_detail" placeholder="Bank name, account number, account name">${esc(saved)}</textarea></div>
    ${saved
      ? `<p class="cell-sub" style="margin:.2rem 0 0">Pulled from your saved payout details — edit above or in <b>Settings</b> if anything changed.</p>`
      : `<p class="cell-sub" style="margin:.2rem 0 0">💡 Tip: save your account number in <b>Settings</b> so it fills in automatically next time.</p>`}
  `, 'Submit request', async () => {
    const amount = +$('#w_amt').value, method = $('#w_method').value, detail = $('#w_detail').value.trim();
    if (!detail) { toast('Enter your account details.', 'err'); return false; }
    await api('withdrawals.php', { method: 'POST', body: { amount, method, detail } });
    toast('Withdrawal requested', 'ok'); closeModal(); navigate('earnings'); return true;
  });
}

/* =========================================================================
   Share modal
   ========================================================================= */
function shareModal(link) {
  const url = link.short_url;
  const title = `${link.make || 'This car'} ${link.model || ''}`.trim();
  const text = `Check out this ${title} from NEJ Autos:`;
  const intents = {
    whatsapp: 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url),
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
    x: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url),
    telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
  };
  openModal(`Share ${esc(title)}`, `
    <p class="cell-sub" style="margin-top:0">Every click on this link is tracked to you. Stats update on your <b>My Links</b> tab.</p>
    <div class="field"><label>Your tracked link</label>
      <div class="copyfield"><input class="input" id="sh_url" readonly value="${attr(url)}"><button class="btn btn-primary btn-sm" id="sh_copy">Copy</button></div>
    </div>
    <div class="share-row">
      <a class="btn btn-ghost btn-sm" data-sp="whatsapp" target="_blank" href="${attr(intents.whatsapp)}">💬 WhatsApp</a>
      <a class="btn btn-ghost btn-sm" data-sp="facebook" target="_blank" href="${attr(intents.facebook)}">👍 Facebook</a>
      <a class="btn btn-ghost btn-sm" data-sp="x" target="_blank" href="${attr(intents.x)}">𝕏 Post</a>
      <a class="btn btn-ghost btn-sm" data-sp="telegram" target="_blank" href="${attr(intents.telegram)}">✈️ Telegram</a>
    </div>
    <p class="cell-sub" style="margin-bottom:0">Clicks so far: <b>${link.clicks || 0}</b> (${link.uniques || 0} unique). Sharing earns a reward on up to <b>${(store.me && store.me.shares ? store.me.shares.cap : 2)} cars/day</b> — it unlocks when the car sells.</p>
  `, null, null, 'Done');
  $('#sh_copy').addEventListener('click', () => {
    $('#sh_url').select();
    navigator.clipboard?.writeText(url).then(() => toast('Link copied', 'ok'), () => {});
    recordShare(link, 'copy');
  });
  $$('.share-row [data-sp]').forEach(a => a.addEventListener('click', () => recordShare(link, a.dataset.sp)));
}

/* Record a share against the logged-in partner. Non-blocking: never gets in the
   way of the actual share. The server caps how many shares count per day. */
async function recordShare(link, platform) {
  try {
    const r = await api('shares.php', { method: 'POST', body: {
      platform,
      link_id: link.id,
      car_id: link.car_id,
      vehicle: `${link.make || ''} ${link.model || ''}`.trim(),
    }});
    if (!r) return;
    if (r.counted) {
      // Tell them where the streak stands — that is what brings them back tomorrow.
      const left = r.cap - r.today;
      toast(r.boosted
        ? `Share counted 🔥 ${r.streak}-day streak · ${left} more count${left === 1 ? 's' : ''} today`
        : r.streak > 1
          ? `Share counted — ${r.streak} days running. Keep it up.`
          : 'Share counted — reward pending until the car sells', 'ok');
    } else {
      toast(`That's all ${r.cap} counted shares for today — keep sharing, and come back tomorrow to keep your streak.`, 'ok');
    }
  } catch (e) { /* analytics only; ignore failures */ }
}

/* =========================================================================
   Modal system
   ========================================================================= */
function openModal(title, bodyHtml, primaryLabel, onPrimary, closeLabel = 'Cancel') {
  const host = $('#modal'); host.hidden = false;
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
function closeModal() { const h = $('#modal'); h.hidden = true; h.innerHTML = ''; h.removeEventListener('click', backdropClose); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ------------------------------- start ---------------------------------- */
boot();
