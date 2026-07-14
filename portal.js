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
  return [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'links',     label: 'My Links' },
    { key: 'earnings',  label: role === 'broker' ? 'Commission' : 'Earnings' },
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
    renderTabs();
  } catch (e) {
    if (e.status === 401) { showAuth('login', 'Your session expired — please sign in again.'); return; }
    $('#view').innerHTML = `<div class="empty"><div class="em">⚠️</div>${esc(e.message)}</div>`;
  }
}

/* =========================================================================
   Dashboard
   ========================================================================= */
async function viewDashboard() {
  const me = store.me = (await api('me.php'));
  const b = me.balance, isBroker = me.user.role === 'broker';
  const kpi = (lbl, val, meta, glow, lock) =>
    `<div class="kpi ${lock ? 'lock' : ''}" style="--glow:${glow}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="meta">${meta}</div></div>`;

  const banner = isBroker
    ? `<div class="banner amber"><span>💡</span><div>You earn <b>${me.config.broker_rate_pct}% commission</b> on every car you close. Share a car's link, and when the buyer's enquiry is marked <b>Won</b>, your commission becomes withdrawable.</div></div>`
    : `<div class="banner"><span>💡</span><div>You earn <b>${me.config.click_points} points</b> (${money(me.config.click_points * me.config.point_value_ngn)}) per unique click, plus a <b>${money(me.config.sale_bonus_ngn)} bonus</b> when a car you shared sells. Click earnings stay <b>locked until that car is sold</b> — then they’re withdrawable.</div></div>`;

  $('#view').innerHTML = `
    ${banner}
    <div class="kpis">
      ${kpi('Withdrawable', money(b.withdrawable), b.withdrawable > 0 ? 'Ready to withdraw' : 'Unlocks after a sale', 'rgba(52,211,153,.2)')}
      ${kpi(isBroker ? 'Pending commission' : 'Locked earnings', money(b.pending + (b.available - b.withdrawable > 0 ? 0 : 0)), isBroker ? 'Clears when sale confirmed' : 'Unlocks when shared car sells', 'rgba(245,166,35,.2)', true)}
      ${isBroker
        ? kpi('Sales won', me.salesWon, `${me.links.count} links shared`, 'rgba(96,165,250,.2)')
        : kpi('Points', me.balance.points.toLocaleString(), `${money(me.config.point_value_ngn)} per point`, 'rgba(167,139,250,.2)')}
      ${kpi('This week', money(me.week.amount), me.week.label, 'rgba(245,166,35,.2)')}
      ${kpi('Total clicks', me.links.clicks.toLocaleString(), `${me.links.uniques.toLocaleString()} unique`, 'rgba(96,165,250,.2)')}
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Recent activity</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="goShare">Share a car →</button></div>
      <div class="tbl-wrap">
        ${me.ledger.length ? `<table class="tbl">
          <thead><tr><th>Type</th><th>Detail</th><th class="num">Points</th><th class="num">Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${me.ledger.map(l => `
            <tr>
              <td>${ledgerTag(l.type)}</td>
              <td class="cell-sub">${esc(l.note || '—')}</td>
              <td class="num">${l.points ? '+' + l.points : '—'}</td>
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
    sale_commission: '<span class="pill amber">commission</span>',
    sale_bonus: '<span class="pill green">sale bonus</span>',
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
        <div class="yr">${esc(c.year)} · ${esc(c.body)} · ${c.mileage ? (+c.mileage).toLocaleString() + ' km' : 'New'}</div>
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
  const b = me.balance;
  const canWithdraw = b.withdrawable >= me.config.min_withdrawal;

  $('#view').innerHTML = `
    <div class="kpis">
      <div class="kpi" style="--glow:rgba(52,211,153,.2)"><div class="lbl">Withdrawable</div><div class="val">${money(b.withdrawable)}</div><div class="meta">min ${money(me.config.min_withdrawal)}</div></div>
      <div class="kpi lock" style="--glow:rgba(245,166,35,.2)"><div class="lbl">Locked / pending</div><div class="val">${money(b.pending)}</div><div class="meta">${me.user.role === 'broker' ? 'clears when sale confirmed' : 'unlocks when shared car sells'}</div></div>
      <div class="kpi" style="--glow:rgba(96,165,250,.2)"><div class="lbl">Reserved</div><div class="val">${money(b.reserved)}</div><div class="meta">in withdrawal requests</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Withdraw earnings</h3><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="wdBtn" ${canWithdraw ? '' : 'disabled'}>Request withdrawal</button></div>
      <div class="panel-body">
        ${canWithdraw
          ? `<p class="cell-sub" style="margin:0">You have ${money(b.withdrawable)} ready. Withdrawals are reviewed and paid by NEJ Autos.</p>`
          : `<p class="cell-sub" style="margin:0">Nothing withdrawable yet. ${me.user.role === 'broker' ? 'Commission unlocks when a sale you brokered is confirmed.' : 'Click earnings unlock once a car you shared is sold.'} Minimum withdrawal is ${money(me.config.min_withdrawal)}.</p>`}
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

function withdrawModal(max, min) {
  openModal('Request withdrawal', `
    <p class="cell-sub" style="margin-top:0">Available: <b style="color:var(--green)">${money(max)}</b></p>
    <div class="field"><label>Amount (₦)</label><input class="input" id="w_amt" type="number" min="${min}" max="${max}" value="${max}"></div>
    <div class="field"><label>Payout method</label>
      <select class="input" id="w_method"><option>Bank transfer</option><option>Mobile money</option><option>Other</option></select></div>
    <div class="field"><label>Account details</label><textarea class="input" id="w_detail" placeholder="Bank name, account number, account name"></textarea></div>
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
      <a class="btn btn-ghost btn-sm" target="_blank" href="${attr(intents.whatsapp)}">💬 WhatsApp</a>
      <a class="btn btn-ghost btn-sm" target="_blank" href="${attr(intents.facebook)}">👍 Facebook</a>
      <a class="btn btn-ghost btn-sm" target="_blank" href="${attr(intents.x)}">𝕏 Post</a>
      <a class="btn btn-ghost btn-sm" target="_blank" href="${attr(intents.telegram)}">✈️ Telegram</a>
    </div>
    <p class="cell-sub" style="margin-bottom:0">Clicks so far: <b>${link.clicks || 0}</b> (${link.uniques || 0} unique)</p>
  `, null, null, 'Done');
  $('#sh_copy').addEventListener('click', () => {
    $('#sh_url').select();
    navigator.clipboard?.writeText(url).then(() => toast('Link copied', 'ok'), () => {});
  });
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
