/* =========================================================================
   NEJ Autos Partner Portal — self-contained SPA
   Vanilla JS. State persists in localStorage. No external dependencies.
   ========================================================================= */

'use strict';

/* ----------------------------- Config ----------------------------------- */
const TIERS = [
  { key: 'Bronze',   min: 0,  max: 4,   rate: 0.03, color: 'var(--bronze)',   emoji: '🥉' },
  { key: 'Silver',   min: 5,  max: 12,  rate: 0.05, color: 'var(--silver)',   emoji: '🥈' },
  { key: 'Gold',     min: 13, max: 25,  rate: 0.06, color: 'var(--gold)',     emoji: '🥇' },
  { key: 'Platinum', min: 26, max: 999, rate: 0.07, color: 'var(--platinum)', emoji: '💎' },
];
const TARGET_BONUS = 250000;   // ₦ per EV / premium unit
const REFERRAL_BONUS = 100000; // ₦ when a referred partner closes their first sale
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

// --- Share-to-earn ---
const CLOSER_BONUS_RATE = 0.02;   // +2% on tier rate when the buyer buys THROUGH your share link
const TOP_SHARER_BONUS = 300000;  // ₦ monthly bonus for the #1 sharer of the network
const SHARE_REWARD = 2500;        // ₦ credited per counted share (subject to the daily cap)
const SHARE_DAILY_LIMIT = 2;      // max counted shares per day, per partner
const SHARE_GOAL = 50000;         // ₦ milestone shown as a progress target
const SHARE_PLATFORMS = [
  { key: 'whatsapp', label: 'WhatsApp', ico: '💬', color: '#25D366' },
  { key: 'facebook', label: 'Facebook', ico: '👍', color: '#1877F2' },
  { key: 'x',        label: 'X',        ico: '𝕏',  color: '#000000' },
  { key: 'telegram', label: 'Telegram', ico: '✈️', color: '#0088cc' },
  { key: 'email',    label: 'Email',    ico: '✉️', color: '#6b7a9c' },
  { key: 'copy',     label: 'Copy link',ico: '🔗', color: '#f5a623' },
];

/* ----------------------------- Utilities -------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
const money2 = (n) => '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const initials = (name) => name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tierFor = (units) => TIERS.find(t => units >= t.min && units <= t.max) || TIERS[0];
const nextTier = (units) => TIERS.find(t => t.min > units) || null;
// deterministic id (no Math.random — keeps things reproducible & lint-safe)
let _idc = Date.now ? 0 : 0;
let _seq = 1000;
const uid = (p) => `${p}-${++_seq}`;

/* --------------------------- Seed demo data ----------------------------- */
const CARS = [
  { emoji: '🚗', bg: 'linear-gradient(135deg,#1e3a8a,#3b82f6)' },
  { emoji: '🚙', bg: 'linear-gradient(135deg,#7c2d12,#f59e0b)' },
  { emoji: '🏎️', bg: 'linear-gradient(135deg,#7f1d1d,#ef4444)' },
  { emoji: '🚐', bg: 'linear-gradient(135deg,#14532d,#22c55e)' },
  { emoji: '🛻', bg: 'linear-gradient(135deg,#374151,#6b7280)' },
  { emoji: '⚡', bg: 'linear-gradient(135deg,#0e7490,#22d3ee)' },
];

function seedInventory() {
  const raw = [
    ['Tesla', 'Model 3 Long Range', 2024, 41990000, 8200, 'EV', true, 5],
    ['BMW', 'i4 eDrive40', 2023, 47500000, 12400, 'EV', true, 5],
    ['Toyota', 'RAV4 Hybrid XLE', 2023, 32400000, 18900, 'SUV', false, 1],
    ['Honda', 'Civic Sport', 2022, 24800000, 27500, 'Sedan', false, 2],
    ['Ford', 'F-150 Lariat', 2023, 52300000, 15100, 'Truck', true, 4],
    ['Mercedes-Benz', 'C 300', 2023, 46900000, 9800, 'Premium', true, 5],
    ['Hyundai', 'Ioniq 5 SEL', 2024, 45200000, 6400, 'EV', true, 5],
    ['Chevrolet', 'Equinox LT', 2022, 26700000, 31200, 'SUV', false, 3],
    ['Audi', 'Q5 Premium Plus', 2023, 49800000, 11700, 'Premium', true, 4],
    ['Kia', 'Telluride SX', 2023, 44100000, 14300, 'SUV', false, 0],
    ['Nissan', 'Altima SR', 2022, 23200000, 29800, 'Sedan', false, 2],
    ['Jeep', 'Grand Cherokee', 2023, 43600000, 16800, 'SUV', false, 1],
  ];
  return raw.map((r, i) => {
    const car = CARS[i % CARS.length];
    const isElectric = r[5] === 'EV';
    const isPremium = r[5] === 'Premium' || r[3] >= 45000000;
    return {
      id: uid('veh'),
      make: r[0], model: r[1], year: r[2], price: r[3], mileage: r[4],
      body: r[5], targetBonus: r[6] > 0, condScore: r[7],
      emoji: isElectric ? '⚡' : car.emoji,
      bg: car.bg,
      inspection: 'Certified',
      status: 'Available',
      isPremium, isElectric,
    };
  });
}

// Partner roster for leaderboard. The current user is injected into this list.
function seedPartners() {
  return [
    { id: 'p-ava',  name: 'Ava Thompson',   company: 'Summit Auto Group',   units: 31, ytd: 214, commission: 18420000, referrals: 6, shares: 142 },
    { id: 'p-marc', name: 'Marcus Reid',    company: 'Reid Motors',         units: 24, ytd: 168, commission: 13980000, referrals: 4, shares: 98 },
    { id: 'p-lena', name: 'Lena Ortiz',     company: 'Coastline Cars',      units: 19, ytd: 141, commission: 10240000, referrals: 3, shares: 76 },
    { id: 'p-devon',name: 'Devon Clarke',   company: 'Clarke Independent',  units: 15, ytd: 98,  commission: 8110000,  referrals: 2, shares: 54 },
    { id: 'p-priya',name: 'Priya Nair',     company: 'Nair Auto Brokers',   units: 11, ytd: 77,  commission: 5340000,  referrals: 5, shares: 61 },
    { id: 'p-sam',  name: 'Sam Whitfield',  company: 'Whitfield Fleet',     units: 8,  ytd: 52,  commission: 3720000,  referrals: 1, shares: 33 },
    { id: 'p-nina', name: 'Nina Foster',    company: 'Foster & Co',         units: 6,  ytd: 39,  commission: 2610000,  referrals: 0, shares: 27 },
  ];
}

// Seed a few share events + one attributed sale so the demo shows the loop working.
function seedShares() {
  return [
    { id: uid('sh'), vehId: null, vehicle: 'Tesla Model 3 Long Range', platform: 'whatsapp', date: '2026-07-06' },
    { id: uid('sh'), vehId: null, vehicle: 'Tesla Model 3 Long Range', platform: 'facebook', date: '2026-07-06' },
    { id: uid('sh'), vehId: null, vehicle: 'Ford F-150 Lariat',        platform: 'whatsapp', date: '2026-07-04' },
    { id: uid('sh'), vehId: null, vehicle: 'BMW i4 eDrive40',          platform: 'x',        date: '2026-07-03' },
    { id: uid('sh'), vehId: null, vehicle: 'Hyundai Ioniq 5 SEL',      platform: 'whatsapp', date: '2026-07-09' },
    { id: uid('sh'), vehId: null, vehicle: 'Hyundai Ioniq 5 SEL',      platform: 'telegram', date: '2026-07-09' },
    { id: uid('sh'), vehId: null, vehicle: 'Toyota RAV4 Hybrid XLE',   platform: 'facebook', date: '2026-07-10' },
  ];
}

function seedLeads() {
  return [
    { id: uid('lead'), customer: 'Robert Hale',  vehicle: 'Tesla Model 3 Long Range', phone: '0803-555-0192', value: 41990000, status: 'Financing', date: '2026-07-08' },
    { id: uid('lead'), customer: 'Jasmine Cole',  vehicle: 'Toyota RAV4 Hybrid XLE',   phone: '0806-555-0114', value: 32400000, status: 'Contacted', date: '2026-07-10' },
    { id: uid('lead'), customer: 'Derek Nunez',   vehicle: 'Ford F-150 Lariat',        phone: '0810-555-0177', value: 52300000, status: 'Won',       date: '2026-07-02', viaShare: 'whatsapp' },
    { id: uid('lead'), customer: 'Amara Singh',   vehicle: 'Honda Civic Sport',        phone: '0708-555-0136', value: 24800000, status: 'New',       date: '2026-07-11' },
    { id: uid('lead'), customer: 'Leo Vance',     vehicle: 'BMW i4 eDrive40',          phone: '0705-555-0159', value: 47500000, status: 'Won',       date: '2026-06-28' },
  ];
}

function seedPayouts() {
  return [
    { id: uid('po'), date: '2026-07-05', desc: 'Weekly commission run', amount: 2196000, status: 'Paid', ref: 'NEJ-PO-4821' },
    { id: uid('po'), date: '2026-06-28', desc: 'Weekly commission + EV bonus', amount: 3110000, status: 'Paid', ref: 'NEJ-PO-4762' },
    { id: uid('po'), date: '2026-06-21', desc: 'Weekly commission run', amount: 1840000, status: 'Paid', ref: 'NEJ-PO-4698' },
    { id: uid('po'), date: '2026-07-12', desc: 'Pending — clears in 5 business days', amount: 2620000, status: 'Pending', ref: 'NEJ-PO-4890' },
  ];
}

/* --------------------------- State / storage ---------------------------- */
const STORE_KEY = 'nej_portal_v1';
let state = null;

function freshState(profile) {
  const leads = seedLeads();
  const monthly = [3, 5, 4, 7, 9, 12, wonThisMonth(leads)]; // units per month, current month last
  return {
    session: profile,           // { name, company, email }
    inventory: seedInventory(),
    leads,
    payouts: seedPayouts(),
    partners: seedPartners(),
    shares: seedShares(),
    favorites: [],
    monthly,
    referralCode: 'NEJ-' + initials(profile.name) + '-' + String(2600 + profile.name.length),
    joined: '2026-03-14',
  };
}

function wonThisMonth(leads) {
  return leads.filter(l => l.status === 'Won' && l.date >= '2026-07-01').length + 3;
}

function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}

/* --------------------------- Derived metrics ---------------------------- */
function metrics() {
  const wonLeads = state.leads.filter(l => l.status === 'Won');
  const unitsMonth = state.monthly[state.monthly.length - 1];
  const tier = tierFor(unitsMonth);
  const salesValue = wonLeads.reduce((s, l) => s + l.value, 0);
  const commissionMTD = Math.round(salesValue * tier.rate);
  const bonusUnits = wonLeads.filter(l => isTargetVehicle(l.vehicle)).length;
  const bonus = bonusUnits * TARGET_BONUS;
  const pending = state.payouts.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const paid = state.payouts.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const openLeads = state.leads.filter(l => !['Won', 'Lost'].includes(l.status)).length;

  // --- share-to-earn ---
  const myShares = (state.shares || []).length;
  const attributedLeads = state.leads.filter(l => l.viaShare);          // buyers who came through my link
  const attributedWon = attributedLeads.filter(l => l.status === 'Won');
  const attributedValue = attributedWon.reduce((s, l) => s + l.value, 0);
  const closerBonus = Math.round(attributedValue * CLOSER_BONUS_RATE);  // +2% for buy-through
  const shareRank = shareRankOf(myShares);
  const isTopSharer = shareRank === 1;
  const sharePayout = myShares * SHARE_REWARD;                          // per-share reward earned
  const shareEarnings = closerBonus + (isTopSharer ? TOP_SHARER_BONUS : 0) + sharePayout;
  const sharesToGoal = Math.ceil(SHARE_GOAL / SHARE_REWARD);            // shares needed to reach ₦50k
  const goalPct = Math.min(100, Math.round(sharePayout / SHARE_GOAL * 100));
  const sharedToday = sharesToday();
  const sharesLeftToday = Math.max(0, SHARE_DAILY_LIMIT - sharedToday);

  return {
    unitsMonth, tier, salesValue, commissionMTD, bonus, bonusUnits, pending, paid, openLeads,
    myShares, attributedLeads, attributedWon, attributedValue, closerBonus,
    shareRank, isTopSharer, sharePayout, shareEarnings, sharesToGoal, goalPct,
    sharedToday, sharesLeftToday,
  };
}

// "today" from the device clock (falls back to the demo date if unavailable)
function today() {
  try { return new Date().toISOString().slice(0, 10); } catch { return '2026-07-13'; }
}
function sharesToday() {
  const t = today();
  return (state.shares || []).filter(s => s.date === t).length;
}

function shareRankOf(myShares) {
  const counts = state.partners.map(p => p.shares).concat(myShares).sort((a, b) => b - a);
  return counts.indexOf(myShares) + 1;
}

// bring older saved sessions up to date with new fields
function migrate() {
  if (!state) return;
  if (!state.shares) state.shares = seedShares();
  if (!state.partners[0] || state.partners[0].shares == null) state.partners = seedPartners();
  syncAttributions();
}

// Pull in enquiries left on the public car page (car.js) that belong to this partner.
function syncAttributions() {
  let q;
  try { q = JSON.parse(localStorage.getItem('nej_attributions') || '[]'); } catch { q = []; }
  if (!q.length) return;
  const mine = q.filter(l => l.ref === state.referralCode);
  const rest = q.filter(l => l.ref !== state.referralCode);
  let added = 0;
  mine.forEach(l => {
    if (!state.leads.some(x => x.id === l.id)) { state.leads.unshift(l); added++; }
  });
  if (added) {
    localStorage.setItem('nej_attributions', JSON.stringify(rest));
    save();
    setTimeout(() => toast(`👤 ${added} new buyer${added > 1 ? 's' : ''} came through your shared link${added > 1 ? 's' : ''}!`, 'good'), 600);
  }
}

function isTargetVehicle(vName) {
  return state.inventory.some(v => `${v.make} ${v.model}` === vName && v.targetBonus)
      || /Tesla|BMW|Mercedes|Audi|Ioniq|EV|i4/i.test(vName);
}

/* --------------------------- Rendering: shell --------------------------- */
const NAV = [
  { id: 'dashboard',   label: 'Dashboard',   ico: '📊' },
  { id: 'inventory',   label: 'Inventory',   ico: '🚗' },
  { id: 'share',       label: 'Share & Earn',ico: '📤' },
  { id: 'leads',       label: 'Leads',       ico: '📇' },
  { id: 'commissions', label: 'Commissions', ico: '💰' },
  { id: 'leaderboard', label: 'Leaderboard', ico: '🏆' },
];
let currentView = 'dashboard';

function renderShell() {
  const m = metrics();
  const u = state.session;
  $('#app').classList.add('active');
  $('#auth').classList.add('hidden');

  $('#sidebar').innerHTML = `
    <div class="side-brand">
      <span class="brand-mark">NEJ</span>
      <div><h1>NEJ Autos</h1><span class="tag">Partner Portal</span></div>
    </div>
    ${NAV.map(n => navItem(n, m)).join('')}
    <div class="side-spacer"></div>
    <div class="side-user">
      <span class="avatar sm">${esc(initials(u.name))}</span>
      <div class="meta"><strong>${esc(u.name)}</strong><span>${esc(u.company)}</span></div>
    </div>
    <button class="btn btn-ghost btn-sm btn-block side-logout" onclick="logout()">Log out</button>
  `;

  $('#mobile-nav').innerHTML = NAV.map(n => `
    <button class="mnav-item ${n.id === currentView ? 'active' : ''}" onclick="go('${n.id}')">
      <span class="ico">${n.ico}</span>${n.label}
    </button>`).join('');

  bindSideNav();
  renderView();
}

function navItem(n, m) {
  let badge = '';
  if (n.id === 'leads' && m.openLeads) badge = `<span class="badge">${m.openLeads}</span>`;
  return `<div class="nav-item ${n.id === currentView ? 'active' : ''}" data-view="${n.id}">
    <span class="ico">${n.ico}</span>${n.label}${badge}</div>`;
}

function bindSideNav() {
  document.querySelectorAll('#sidebar .nav-item').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.view));
  });
}

function go(view) {
  currentView = view;
  location.hash = view;
  document.querySelectorAll('#sidebar .nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view));
  document.querySelectorAll('.mnav-item').forEach((el, i) =>
    el.classList.toggle('active', NAV[i].id === view));
  renderView();
  $('#main').scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function renderView() {
  const map = {
    dashboard: viewDashboard,
    inventory: viewInventory,
    share: viewShare,
    leads: viewLeads,
    commissions: viewCommissions,
    leaderboard: viewLeaderboard,
  };
  $('#view').innerHTML = (map[currentView] || viewDashboard)();
  if (currentView === 'inventory') bindInventory();
  if (currentView === 'dashboard') requestAnimationFrame(animateBars);
}

function topbar(title, sub) {
  const m = metrics();
  return `
  <div class="mobile-head">
    <span class="brand-mark" style="width:36px;height:36px;border-radius:11px;font-size:0.9rem">NEJ</span>
    <h1>${esc(title)}</h1>
    <span class="avatar sm">${esc(initials(state.session.name))}</span>
  </div>
  <div class="topbar">
    <div class="title"><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
    <div class="spacer"></div>
    <span class="tier-pill"><span class="tier-dot" style="background:${m.tier.color}"></span>${m.tier.emoji} ${m.tier.key}</span>
  </div>`;
}

/* --------------------------- View: Dashboard ---------------------------- */
function viewDashboard() {
  const m = metrics();
  const nt = nextTier(m.unitsMonth);
  const tierProgress = m.tier.max === 999 ? 100 :
    Math.min(100, Math.round(((m.unitsMonth - m.tier.min) / (m.tier.max + 1 - m.tier.min)) * 100));
  const toNext = nt ? nt.min - m.unitsMonth : 0;

  return `
  ${topbar('Dashboard', `Welcome back, ${state.session.name.split(' ')[0]} — here's your month at a glance.`)}
  <div class="grid kpi-grid">
    ${kpi('🚘', 'var(--accent-soft)', 'Units sold (Jul)', m.unitsMonth, `+${Math.max(1, m.unitsMonth - state.monthly[state.monthly.length - 2])} vs Jun`, 'up')}
    ${kpi('💵', 'var(--green-soft)', 'Commission MTD', money(m.commissionMTD), `${(m.tier.rate * 100).toFixed(0)}% ${m.tier.key} rate`, 'up')}
    ${kpi('🎯', 'var(--blue-soft)', 'Target bonuses', money(m.bonus), `${m.bonusUnits} EV / premium sold`, 'up')}
    ${kpi('⏳', 'rgba(255,255,255,0.06)', 'Pending payout', money(m.pending), 'Clears in 5 days', '')}
  </div>

  <div class="grid two-col" style="margin-top:1.1rem">
    <div class="card">
      <div class="section-title" style="margin:0 0 0.4rem">Monthly sales volume<span class="spacer"></span><span class="pill grey">units / month</span></div>
      <div class="chart-wrap"><div class="bar-chart" id="barChart">
        ${state.monthly.map((v, i) => {
          const max = Math.max(...state.monthly);
          const h = Math.round((v / max) * 150);
          return `<div class="bar-col"><span class="val">${v}</span>
            <div class="bar" data-h="${h}" style="height:0"></div>
            <span class="lbl">${MONTHS[i]}</span></div>`;
        }).join('')}
      </div></div>
    </div>

    <div class="card">
      <div class="section-title" style="margin:0 0 0.2rem">Tier progress</div>
      <div style="display:flex;align-items:center;gap:0.6rem;font-size:1.35rem;font-weight:750">
        <span>${m.tier.emoji}</span> ${m.tier.key}
      </div>
      <div class="tier-track">
        ${TIERS.map(t => {
          const active = t.min <= m.unitsMonth;
          const isCur = t.key === m.tier.key;
          const fill = isCur ? tierProgress : (active ? 100 : 0);
          return `<div class="tier-seg"><div class="fill" style="width:${fill}%;background:${active ? 'linear-gradient(90deg,var(--accent),var(--accent-2))' : 'transparent'}"></div></div>`;
        }).join('')}
      </div>
      <div class="tier-legend">${TIERS.map(t => `<span>${t.key}</span>`).join('')}</div>
      <p class="tier-next">
        ${nt ? `Sell <strong>${toNext} more unit${toNext > 1 ? 's' : ''}</strong> this month to reach <strong>${nt.key}</strong> and unlock <strong>${(nt.rate * 100).toFixed(0)}%</strong> commission.`
             : `You're at the top tier — enjoy <strong>${(m.tier.rate * 100).toFixed(0)}%</strong> commission plus quarterly rewards.`}
      </p>
    </div>
  </div>

  <div class="section-title">Recent activity<span class="spacer"></span>
    <button class="btn btn-ghost btn-sm" onclick="go('leads')">View all leads</button></div>
  <div class="card" style="padding:0.4rem 0.4rem">
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Customer</th><th>Vehicle</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${state.leads.slice(0, 5).map(leadRow).join('')}</tbody>
    </table></div>
  </div>`;
}

function kpi(ico, bg, label, value, delta, dir) {
  return `<div class="card kpi">
    <div class="kpi-ico" style="background:${bg}">${ico}</div>
    <p class="label">${label}</p>
    <p class="value">${value}</p>
    ${delta ? `<span class="delta ${dir}">${dir === 'up' ? '▲' : ''} ${delta}</span>` : ''}
  </div>`;
}

function animateBars() {
  document.querySelectorAll('#barChart .bar').forEach(b => { b.style.height = b.dataset.h + 'px'; });
}

/* --------------------------- View: Inventory ---------------------------- */
let invFilter = { q: '', body: 'All', sort: 'featured' };

function viewInventory() {
  const bodies = ['All', ...new Set(state.inventory.map(v => v.body))];
  return `
  ${topbar('Inventory', 'Browse quality, certified vehicles ready to sell — no sourcing required.')}
  <div class="filters">
    <input class="input search-box" id="invSearch" placeholder="Search make or model…" value="${esc(invFilter.q)}">
    <select class="input" id="invBody">
      ${bodies.map(b => `<option ${b === invFilter.body ? 'selected' : ''}>${b}</option>`).join('')}
    </select>
    <select class="input" id="invSort">
      <option value="featured" ${invFilter.sort === 'featured' ? 'selected' : ''}>Featured</option>
      <option value="priceAsc" ${invFilter.sort === 'priceAsc' ? 'selected' : ''}>Price: low → high</option>
      <option value="priceDesc" ${invFilter.sort === 'priceDesc' ? 'selected' : ''}>Price: high → low</option>
      <option value="bonus" ${invFilter.sort === 'bonus' ? 'selected' : ''}>Bonus first</option>
    </select>
  </div>
  <div class="grid veh-grid" id="vehGrid">${renderVehicles()}</div>`;
}

function renderVehicles() {
  let list = state.inventory.filter(v => {
    const q = invFilter.q.toLowerCase();
    const matchQ = !q || `${v.make} ${v.model}`.toLowerCase().includes(q);
    const matchB = invFilter.body === 'All' || v.body === invFilter.body;
    return matchQ && matchB;
  });
  if (invFilter.sort === 'priceAsc') list.sort((a, b) => a.price - b.price);
  else if (invFilter.sort === 'priceDesc') list.sort((a, b) => b.price - a.price);
  else if (invFilter.sort === 'bonus') list.sort((a, b) => (b.targetBonus - a.targetBonus) || a.price - b.price);
  else list.sort((a, b) => (b.targetBonus - a.targetBonus) || (b.year - a.year));

  if (!list.length) return `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>No vehicles match your filters.</div>`;

  const m = metrics();
  return list.map(v => {
    const est = Math.round(v.price * m.tier.rate) + (v.targetBonus ? TARGET_BONUS : 0);
    const fav = state.favorites.includes(v.id);
    return `<div class="card veh-card">
      <div class="veh-img" style="background:${v.bg}">
        <div class="badges">
          ${v.targetBonus ? `<span class="pill amber">+${money(TARGET_BONUS)} bonus</span>` : ''}
          ${v.isElectric ? `<span class="pill blue">EV</span>` : ''}
        </div>
        <button class="fav" title="Save" onclick="toggleFav('${v.id}')">${fav ? '⭐' : '☆'}</button>
        <span>${v.emoji}</span>
      </div>
      <div class="veh-body">
        <h3>${v.year} ${esc(v.make)} ${esc(v.model)}</h3>
        <div class="veh-price">${money(v.price)}</div>
        <div class="veh-meta">
          <span>🛣️ ${v.mileage.toLocaleString()} mi</span>
          <span>🏷️ ${v.body}</span>
          <span class="pill green" style="padding:.15rem .5rem">✓ ${v.inspection}</span>
        </div>
        <div class="cell-muted" style="font-size:.82rem">Your est. earning: <strong style="color:var(--accent)">${money(est)}</strong>
          ${sharesForVehicle(v) ? `<span class="pill grey" style="margin-left:.4rem;padding:.1rem .5rem">📤 ${sharesForVehicle(v)} shared</span>` : ''}</div>
        <div class="veh-actions">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="claimVehicle('${v.id}')">Claim</button>
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openShareModal('${v.id}')">📤 Share</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function bindInventory() {
  const s = $('#invSearch'), b = $('#invBody'), so = $('#invSort');
  if (s) s.addEventListener('input', () => { invFilter.q = s.value; $('#vehGrid').innerHTML = renderVehicles(); });
  if (b) b.addEventListener('change', () => { invFilter.body = b.value; $('#vehGrid').innerHTML = renderVehicles(); });
  if (so) so.addEventListener('change', () => { invFilter.sort = so.value; $('#vehGrid').innerHTML = renderVehicles(); });
}

function toggleFav(id) {
  const i = state.favorites.indexOf(id);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
  save();
  $('#vehGrid').innerHTML = renderVehicles();
}

function claimVehicle(id) {
  const v = state.inventory.find(x => x.id === id);
  openLeadModal(`${v.make} ${v.model}`, v.price);
}

/* --------------------------- Share-to-earn ------------------------------ */
function sharesForVehicle(v) {
  const name = `${v.make} ${v.model}`;
  return (state.shares || []).filter(s => s.vehId === v.id || s.vehicle === name).length;
}

// Build a public, trackable share link. Car details are encoded so the page
// works even for recipients who have never opened the portal. `ref` attributes
// the buyer to the sharing partner.
function shareUrl(v) {
  let base;
  try { base = new URL('car.html', location.href); }
  catch { base = { searchParams: new URLSearchParams(), toString() { return 'car.html?' + this.searchParams; } }; }
  const p = base.searchParams;
  p.set('id', v.id);
  p.set('ref', state.referralCode);
  p.set('by', state.session.name);
  p.set('mk', v.make); p.set('mo', v.model); p.set('yr', v.year);
  p.set('pr', v.price); p.set('em', v.emoji); p.set('bd', v.body);
  p.set('mi', v.mileage); p.set('bn', v.targetBonus ? 1 : 0); p.set('ev', v.isElectric ? 1 : 0);
  p.set('bg', String(CARS.findIndex(c => c.bg === v.bg)));
  return base.toString();
}

function shareText(v) {
  return `🚗 ${v.year} ${v.make} ${v.model} — ${money(v.price)}, certified & inspected by NEJ Autos. Interested? Check it out:`;
}

function platformIntent(key, url, text) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  switch (key) {
    case 'whatsapp': return `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`;
    case 'x':        return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'email':    return `mailto:?subject=${encodeURIComponent('A car you might like from NEJ Autos')}&body=${encodeURIComponent(text + '\n\n' + url)}`;
    default:         return null; // copy
  }
}

function openShareModal(id) {
  const v = state.inventory.find(x => x.id === id);
  if (!v) return;
  const url = shareUrl(v);
  const host = document.createElement('div');
  host.className = 'modal-host';
  host.id = 'shareModal';
  host.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <span class="brand-mark" style="width:38px;height:38px;border-radius:11px;font-size:0.9rem">📤</span>
        <h3>Share &amp; earn</h3><span class="spacer"></span>
        <button class="x" onclick="closeShareModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="card" style="display:flex;gap:0.9rem;align-items:center;padding:0.9rem;box-shadow:none;margin-bottom:1.1rem">
          <div style="width:64px;height:64px;border-radius:14px;display:grid;place-items:center;font-size:2rem;background:${v.bg}">${v.emoji}</div>
          <div><strong>${v.year} ${esc(v.make)} ${esc(v.model)}</strong>
            <div class="cell-muted" style="font-size:0.85rem">${money(v.price)} · ${sharesForVehicle(v)} shares so far</div></div>
        </div>
        <p class="cell-muted" style="margin:0 0 0.6rem;font-size:0.88rem">Every share is tracked to <strong>you</strong> (${esc(state.referralCode)}) and earns <strong style="color:var(--accent)">${money(SHARE_REWARD)}</strong>. If the buyer buys through your link you also earn <strong style="color:var(--accent)">+${(CLOSER_BONUS_RATE*100).toFixed(0)}%</strong> commission, and the month's top sharer wins <strong style="color:var(--accent)">${money(TOP_SHARER_BONUS)}</strong>.</p>
        <p class="pill ${metrics().sharesLeftToday ? 'green' : 'amber'}" style="margin:0 0 0.9rem">⏳ ${metrics().sharesLeftToday} of ${SHARE_DAILY_LIMIT} daily shares left</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin-bottom:1rem">
          ${SHARE_PLATFORMS.map(pl => `
            <button class="btn btn-ghost" style="flex-direction:column;gap:0.3rem;padding:0.9rem 0.3rem;font-size:0.8rem"
              onclick="doShare('${v.id}','${pl.key}')">
              <span style="font-size:1.4rem">${pl.ico}</span>${pl.label}</button>`).join('')}
        </div>
        <div class="ref-code" style="font-size:0.8rem;word-break:break-all">${esc(url)}</div>
      </div>
    </div>`;
  document.body.appendChild(host);
  host.addEventListener('click', (e) => { if (e.target === host) closeShareModal(); });
}
function closeShareModal() { $('#shareModal')?.remove(); }

function doShare(id, platform) {
  const v = state.inventory.find(x => x.id === id);
  if (!v) return;
  // enforce the daily share cap before anything is counted
  if (sharesToday() >= SHARE_DAILY_LIMIT) {
    toast(`⏳ Daily limit reached — you can earn on ${SHARE_DAILY_LIMIT} shares per day. Come back tomorrow.`, 'info');
    return;
  }
  const url = shareUrl(v), text = shareText(v);

  if (platform === 'native' && navigator.share) {
    navigator.share({ title: `${v.make} ${v.model}`, text, url }).then(() => recordShare(v, 'device')).catch(() => {});
    return;
  }
  if (platform === 'copy') {
    (navigator.clipboard?.writeText(url) || Promise.reject()).then(
      () => { recordShare(v, 'copy'); toast('🔗 Share link copied — paste it anywhere!', 'good'); },
      () => toast('Copy: ' + url, 'info')
    );
    return;
  }
  const intent = platformIntent(platform, url, text);
  if (intent) window.open(intent, '_blank', 'noopener,noreferrer');
  recordShare(v, platform);
}

function recordShare(v, platform) {
  state.shares = state.shares || [];
  state.shares.push({ id: uid('sh'), vehId: v.id, vehicle: `${v.make} ${v.model}`, platform, date: today() });
  save();
  const pl = SHARE_PLATFORMS.find(p => p.key === platform);
  const left = Math.max(0, SHARE_DAILY_LIMIT - sharesToday());
  toast(`📤 Shared to ${pl ? pl.label : platform} — +${money(SHARE_REWARD)} tracked. ${left} share${left === 1 ? '' : 's'} left today.`, 'good');
  closeShareModal();
  renderShell(); // re-renders sidebar + current view with updated share counts
}

/* --------------------------- View: Share & Earn ------------------------- */
function viewShare() {
  const m = metrics();

  // group my shares by vehicle
  const byVeh = {};
  (state.shares || []).forEach(s => {
    const key = s.vehicle;
    (byVeh[key] = byVeh[key] || { name: key, count: 0, vehId: s.vehId }).count++;
    if (s.vehId) byVeh[key].vehId = s.vehId;
  });
  const sharedCars = Object.values(byVeh).sort((a, b) => b.count - a.count);

  // shares by platform
  const byPlat = {};
  (state.shares || []).forEach(s => { byPlat[s.platform] = (byPlat[s.platform] || 0) + 1; });

  // share leaderboard
  const roster = state.partners.map(p => ({ name: p.name, company: p.company, shares: p.shares, me: false }));
  roster.push({ name: state.session.name, company: state.session.company, shares: m.myShares, me: true });
  roster.sort((a, b) => b.shares - a.shares);
  const medals = ['🥇', '🥈', '🥉'];

  return `
  ${topbar('Share & Earn', 'Share cars to WhatsApp, Facebook & more — every share is tracked to you, and buyers who come through your link earn you extra.')}

  <div class="grid kpi-grid" style="margin-bottom:0.4rem">
    ${kpi('📤', 'var(--accent-soft)', 'My shares', m.myShares, `rank #${m.shareRank} of ${roster.length}`, m.shareRank <= 3 ? 'up' : '')}
    ${kpi('👤', 'var(--blue-soft)', 'Buyers via my links', m.attributedLeads.length, `${m.attributedWon.length} purchased`, 'up')}
    ${kpi('🛒', 'var(--green-soft)', 'Attributed sales', money(m.attributedValue), 'bought through you', 'up')}
    ${kpi('💸', 'rgba(255,255,255,0.06)', 'Share earnings', money(m.shareEarnings), m.isTopSharer ? 'incl. ' + money(TOP_SHARER_BONUS) + ' top-sharer' : money(SHARE_REWARD) + ' / share', m.shareEarnings ? 'up' : '')}
  </div>

  <div class="card" style="margin-top:1.1rem">
    <div class="section-title" style="margin:0 0 0.2rem">Road to ${money(SHARE_GOAL)}<span class="spacer"></span>
      <span class="pill ${m.sharesLeftToday ? 'green' : 'amber'}">${m.sharesLeftToday} of ${SHARE_DAILY_LIMIT} shares left today</span></div>
    <p class="cell-muted" style="margin:0 0 0.8rem;font-size:0.9rem">
      At ${money(SHARE_REWARD)} per share, <strong>${m.sharesToGoal} shares</strong> earns you <strong>${money(SHARE_GOAL)}</strong>.
      You've shared <strong>${m.myShares}</strong> (${money(m.sharePayout)} so far). Capped at ${SHARE_DAILY_LIMIT}/day, that's ~${Math.ceil(m.sharesToGoal / SHARE_DAILY_LIMIT)} days.</p>
    <div class="tier-seg" style="height:12px"><div class="fill" style="width:${m.goalPct}%"></div></div>
    <div class="tier-legend" style="margin-top:0.4rem"><span>${money(m.sharePayout)}</span><span>${money(SHARE_GOAL)}</span></div>
  </div>

  <div class="section-title">How sharing pays you</div>
  <div class="grid" style="grid-template-columns:repeat(2,1fr)">
    <div class="card reward-card">
      <div class="reward-ico" style="background:var(--green-soft)">🎯</div>
      <div><strong>Buyer buys through your link</strong>
        <p class="cell-muted" style="margin:0.35rem 0 0;font-size:0.9rem">When someone taps <em>your</em> share link and purchases, you're credited as the source and earn your full tier commission <strong style="color:var(--accent)">+${(CLOSER_BONUS_RATE*100).toFixed(0)}%</strong> closer bonus. The biggest reward.</p></div>
    </div>
    <div class="card reward-card">
      <div class="reward-ico" style="background:var(--accent-soft)">📣</div>
      <div><strong>Most shares wins</strong>
        <p class="cell-muted" style="margin:0.35rem 0 0;font-size:0.9rem">The partner with the most tracked shares each month wins a <strong style="color:var(--accent)">${money(TOP_SHARER_BONUS)}</strong> top-sharer bonus — reach is rewarded even when you don't close the deal yourself.</p></div>
    </div>
  </div>

  <div class="grid two-col" style="margin-top:1.1rem">
    <div class="card">
      <div class="section-title" style="margin:0 0 0.4rem">Top sharers — July<span class="spacer"></span><span class="pill amber">🏆 ${money(TOP_SHARER_BONUS)} to #1</span></div>
      ${roster.map((r, i) => `
        <div class="rank-row ${r.me ? 'me' : ''}">
          <div class="rank-num">${i < 3 ? `<span class="medal">${medals[i]}</span>` : (i + 1)}</div>
          <span class="avatar sm">${esc(initials(r.name))}</span>
          <div class="rank-info"><strong>${esc(r.name)}${r.me ? ' (You)' : ''}</strong><span>${esc(r.company)}</span></div>
          <div class="rank-metric"><strong>${r.shares}</strong><span>shares</span></div>
        </div>`).join('')}
    </div>

    <div style="display:grid;gap:1.1rem;align-content:start">
      <div class="card">
        <div class="section-title" style="margin:0 0 0.7rem">Shares by platform</div>
        ${SHARE_PLATFORMS.filter(p => byPlat[p.key] || byPlat[p.label?.toLowerCase()]).length
          ? SHARE_PLATFORMS.map(p => {
              const c = byPlat[p.key] || 0; if (!c) return '';
              const pct = Math.round(c / m.myShares * 100);
              return `<div style="margin-bottom:0.7rem">
                <div style="display:flex;justify-content:space-between;font-size:0.88rem"><span>${p.ico} ${p.label}</span><span class="cell-muted">${c}</span></div>
                <div class="tier-seg" style="margin-top:0.3rem"><div class="fill" style="width:${pct}%"></div></div></div>`;
            }).join('')
          : `<p class="cell-muted" style="font-size:0.9rem">No shares yet. Share a car below to start earning.</p>`}
      </div>
      <div class="card">
        <div class="section-title" style="margin:0 0 0.5rem">Your referral code</div>
        <div class="ref-code"><span>${esc(state.referralCode)}</span><span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="copyRef()">Copy</button></div>
      </div>
    </div>
  </div>

  <div class="section-title">Cars you've shared<span class="spacer"></span>
    <button class="btn btn-ghost btn-sm" onclick="go('inventory')">Share more cars</button></div>
  <div class="grid" style="grid-template-columns:repeat(2,1fr)">
    ${sharedCars.length ? sharedCars.map(sc => {
      const v = state.inventory.find(x => x.id === sc.vehId || `${x.make} ${x.model}` === sc.name);
      return `<div class="card" style="display:flex;gap:0.9rem;align-items:center">
        <div style="width:54px;height:54px;border-radius:13px;display:grid;place-items:center;font-size:1.7rem;background:${v ? v.bg : 'var(--surface-hi)'}">${v ? v.emoji : '🚗'}</div>
        <div style="flex:1;min-width:0"><strong>${esc(sc.name)}</strong>
          <div class="cell-muted" style="font-size:0.83rem">📤 ${sc.count} share${sc.count > 1 ? 's' : ''} tracked to you</div></div>
        ${v ? `<button class="btn btn-primary btn-sm" onclick="openShareModal('${v.id}')">Share again</button>` : ''}
      </div>`;
    }).join('') : `<div class="card empty" style="grid-column:1/-1"><div class="big">📤</div>You haven't shared any cars yet.<br><button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="go('inventory')">Browse inventory to share</button></div>`}
  </div>

  ${m.attributedLeads.length ? `
  <div class="section-title">Buyers who came through your links</div>
  <div class="card" style="padding:0.4rem">
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Buyer</th><th>Vehicle</th><th>Shared via</th><th>Value</th><th>Status</th></tr></thead>
      <tbody>${m.attributedLeads.map(l => `
        <tr class="row-hover">
          <td class="cell-strong">${esc(l.customer)}</td>
          <td class="cell-muted">${esc(l.vehicle)}</td>
          <td><span class="pill blue">${esc(String(l.viaShare))}</span></td>
          <td>${money(l.value)}</td>
          <td><span class="pill ${statusPill[l.status]}">${l.status}</span></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  </div>` : ''}
  `;
}

/* --------------------------- View: Leads -------------------------------- */
const LEAD_STATUSES = ['New', 'Contacted', 'Financing', 'Won', 'Lost'];
const statusPill = { New: 'blue', Contacted: 'amber', Financing: 'amber', Won: 'green', Lost: 'red' };

function leadRow(l) {
  return `<tr class="row-hover">
    <td class="cell-strong">${esc(l.customer)}</td>
    <td class="cell-muted">${esc(l.vehicle)}</td>
    <td>${money(l.value)}</td>
    <td><span class="pill ${statusPill[l.status]}">${l.status}</span></td>
    <td class="cell-muted">${fmtDate(l.date)}</td>
  </tr>`;
}

function viewLeads() {
  const open = state.leads.filter(l => !['Won', 'Lost'].includes(l.status));
  const won = state.leads.filter(l => l.status === 'Won');
  return `
  ${topbar('Leads', 'Submit new customer leads and track every deal to close.')}
  <div class="grid kpi-grid" style="margin-bottom:0.4rem">
    ${kpi('📥', 'var(--blue-soft)', 'Open leads', open.length, 'in progress', '')}
    ${kpi('✅', 'var(--green-soft)', 'Won this cycle', won.length, 'closed deals', 'up')}
    ${kpi('📈', 'var(--accent-soft)', 'Pipeline value', money(open.reduce((s, l) => s + l.value, 0)), 'potential', '')}
    ${kpi('🎯', 'rgba(255,255,255,0.06)', 'Conversion', state.leads.length ? Math.round(won.length / state.leads.length * 100) + '%' : '—', 'won / total', '')}
  </div>
  <div class="section-title">All leads<span class="spacer"></span>
    <button class="btn btn-primary btn-sm" onclick="openLeadModal()">+ New lead</button></div>
  <div class="card" style="padding:0.4rem">
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Customer</th><th>Vehicle</th><th>Value</th><th>Status</th><th>Date</th><th></th></tr></thead>
      <tbody>${state.leads.map(l => `
        <tr class="row-hover">
          <td class="cell-strong">${esc(l.customer)}</td>
          <td class="cell-muted">${esc(l.vehicle)}</td>
          <td>${money(l.value)}</td>
          <td>
            <select class="input" style="padding:0.35rem 0.5rem;min-width:120px" onchange="setLeadStatus('${l.id}', this.value)">
              ${LEAD_STATUSES.map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td class="cell-muted">${fmtDate(l.date)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="removeLead('${l.id}')">✕</button></td>
        </tr>`).join('') || emptyRow(6, 'No leads yet — submit your first one.')}
      </tbody>
    </table></div>
  </div>`;
}

function setLeadStatus(id, status) {
  const l = state.leads.find(x => x.id === id);
  if (!l) return;
  const wasWon = l.status === 'Won';
  l.status = status;
  if (status === 'Won' && !wasWon) {
    // reflect the new sale in monthly volume
    state.monthly[state.monthly.length - 1] += 1;
    const rate = metrics().tier.rate + (l.viaShare ? CLOSER_BONUS_RATE : 0);
    const est = Math.round(l.value * rate) + (isTargetVehicle(l.vehicle) ? TARGET_BONUS : 0);
    toast(l.viaShare
      ? `🎉 Buy-through sale won! ~${money(est)} incl. +${(CLOSER_BONUS_RATE*100).toFixed(0)}% share bonus.`
      : `🎉 Deal won! ~${money(est)} commission added.`, 'good');
  }
  save();
  renderShell();
}

function removeLead(id) {
  state.leads = state.leads.filter(l => l.id !== id);
  save();
  renderView();
  renderShell();
}

/* --------------------------- View: Commissions -------------------------- */
function viewCommissions() {
  const m = metrics();
  const paidPayouts = state.payouts.filter(p => p.status === 'Paid');
  const ytd = m.paid + m.pending;
  return `
  ${topbar('Commissions & Payouts', 'Transparent earnings — guaranteed payouts within 5 business days.')}
  <div class="grid kpi-grid" style="margin-bottom:0.4rem">
    ${kpi('💰', 'var(--green-soft)', 'Earned (YTD)', money(ytd), 'this year', 'up')}
    ${kpi('🏦', 'var(--accent-soft)', 'Paid out', money(m.paid), `${paidPayouts.length} payouts`, '')}
    ${kpi('⏳', 'var(--blue-soft)', 'Pending', money(m.pending), 'clears in 5 days', '')}
    ${kpi('📊', 'rgba(255,255,255,0.06)', 'Current rate', (m.tier.rate * 100).toFixed(0) + '%', m.tier.key + ' tier', '')}
  </div>

  <div class="grid two-col" style="margin-top:0.6rem">
    <div class="card" style="padding:0.4rem">
      <div class="section-title" style="margin:0.8rem 0.8rem 0.4rem">Payout history</div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${state.payouts.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => `
          <tr class="row-hover">
            <td class="cell-muted">${fmtDate(p.date)}</td>
            <td class="cell-strong">${esc(p.desc)}</td>
            <td class="cell-muted" style="font-family:ui-monospace,monospace;font-size:0.82rem">${p.ref}</td>
            <td class="cell-strong">${money(p.amount)}</td>
            <td><span class="pill ${p.status === 'Paid' ? 'green' : 'amber'}">${p.status}</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="section-title" style="margin:0 0 0.6rem">How your commission is built</div>
      <div class="summary-row"><span class="k">Won sales value</span><span class="v">${money(m.salesValue)}</span></div>
      <div class="summary-row"><span class="k">Base rate (${m.tier.key})</span><span class="v">${(m.tier.rate * 100).toFixed(0)}%</span></div>
      <div class="summary-row"><span class="k">Commission on sales</span><span class="v">${money(m.commissionMTD)}</span></div>
      <div class="summary-row"><span class="k">Target-model bonus (${m.bonusUnits} × ${money(TARGET_BONUS)})</span><span class="v">${money(m.bonus)}</span></div>
      <div class="summary-row"><span class="k">Buy-through bonus (+${(CLOSER_BONUS_RATE*100).toFixed(0)}% on ${m.attributedWon.length} shared sale${m.attributedWon.length === 1 ? '' : 's'})</span><span class="v">${money(m.closerBonus)}</span></div>
      ${m.isTopSharer ? `<div class="summary-row"><span class="k">Top-sharer bonus 🏆</span><span class="v">${money(TOP_SHARER_BONUS)}</span></div>` : ''}
      <div class="summary-row total"><span class="k">Estimated this cycle</span><span class="v">${money(m.commissionMTD + m.bonus + m.shareEarnings)}</span></div>
      <p class="tier-next" style="margin-top:1rem">Payouts are processed weekly and land in your account within <strong>5 business days</strong>. Move up a tier to raise every future commission.</p>
    </div>
  </div>`;
}

/* --------------------------- View: Leaderboard -------------------------- */
function viewLeaderboard() {
  const me = state.session;
  const m = metrics();
  // build combined roster with the current user
  const roster = state.partners.map(p => ({ ...p, me: false }));
  roster.push({
    id: 'me', name: me.name, company: me.company,
    units: m.unitsMonth, ytd: state.monthly.reduce((s, v) => s + v, 0),
    commission: m.commissionMTD + m.bonus, referrals: 2, me: true,
  });
  roster.sort((a, b) => b.units - a.units);
  const myRank = roster.findIndex(r => r.me) + 1;
  const medals = ['🥇', '🥈', '🥉'];

  return `
  ${topbar('Leaderboard & Rewards', 'Compete monthly, climb tiers, and earn bonus cash and referral rewards.')}
  <div class="grid kpi-grid" style="margin-bottom:0.4rem">
    ${kpi('🏅', 'var(--accent-soft)', 'Your rank', '#' + myRank, `of ${roster.length} partners`, myRank <= 3 ? 'up' : '')}
    ${kpi('🚘', 'var(--green-soft)', 'Your units (Jul)', m.unitsMonth, m.tier.key + ' tier', 'up')}
    ${kpi('👥', 'var(--blue-soft)', 'Your referrals', 2, `+${money(REFERRAL_BONUS)} per close`, '')}
    ${kpi('🎁', 'rgba(255,255,255,0.06)', 'Model of the month', 'Ioniq 5', `+${money(TARGET_BONUS)} each`, '')}
  </div>

  <div class="grid two-col" style="margin-top:0.6rem">
    <div class="card">
      <div class="section-title" style="margin:0 0 0.4rem">July leaderboard<span class="spacer"></span><span class="pill amber">🏆 ${money(2500000)} prize pool</span></div>
      ${roster.map((r, i) => `
        <div class="rank-row ${r.me ? 'me' : ''}">
          <div class="rank-num">${i < 3 ? `<span class="medal">${medals[i]}</span>` : (i + 1)}</div>
          <span class="avatar sm">${esc(initials(r.name))}</span>
          <div class="rank-info"><strong>${esc(r.name)}${r.me ? ' (You)' : ''}</strong><span>${esc(r.company)}</span></div>
          <div class="rank-metric"><strong>${r.units}</strong><span>${money(r.commission)}</span></div>
        </div>`).join('')}
    </div>

    <div style="display:grid;gap:1.1rem;align-content:start">
      <div class="card">
        <div class="section-title" style="margin:0 0 0.7rem">Your referral link</div>
        <p class="cell-muted" style="margin:0 0 0.7rem;font-size:0.88rem">Earn <strong style="color:var(--accent)">${money(REFERRAL_BONUS)}</strong> every time a partner you refer closes their first NEJ Autos sale.</p>
        <div class="ref-code">
          <span>${state.referralCode}</span><span class="spacer"></span>
          <button class="btn btn-ghost btn-sm" onclick="copyRef()">Copy</button>
        </div>
      </div>
      <div class="card reward-card">
        <div class="reward-ico" style="background:var(--green-soft)">🚀</div>
        <div><strong>New partner boost</strong><p class="cell-muted" style="margin:0.3rem 0 0;font-size:0.88rem">First 3 sales by a new agent earn a higher commission rate.</p></div>
      </div>
      <div class="card reward-card">
        <div class="reward-ico" style="background:var(--accent-soft)">🏆</div>
        <div><strong>Top 3 monthly</strong><p class="cell-muted" style="margin:0.3rem 0 0;font-size:0.88rem">Win cash, marketing credits, or merchandise on the July leaderboard.</p></div>
      </div>
      <div class="card reward-card">
        <div class="reward-ico" style="background:var(--blue-soft)">💎</div>
        <div><strong>Loyalty rewards</strong><p class="cell-muted" style="margin:0.3rem 0 0;font-size:0.88rem">Annual bonuses for partners who hold their tier all year.</p></div>
      </div>
    </div>
  </div>`;
}

function copyRef() {
  navigator.clipboard?.writeText(state.referralCode).then(
    () => toast('🔗 Referral code copied!', 'good'),
    () => toast('Copy: ' + state.referralCode, 'info')
  );
}

/* --------------------------- Lead modal --------------------------------- */
function openLeadModal(vehicle = '', value = '') {
  const opts = state.inventory.map(v => {
    const label = `${v.year} ${v.make} ${v.model} — ${money(v.price)}`;
    const val = `${v.make} ${v.model}`;
    return `<option value="${esc(val)}" data-price="${v.price}" ${val === vehicle ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');

  const host = document.createElement('div');
  host.className = 'modal-host';
  host.id = 'leadModal';
  host.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <span class="brand-mark" style="width:38px;height:38px;border-radius:11px;font-size:0.9rem">NEJ</span>
        <h3>New lead</h3><span class="spacer"></span>
        <button class="x" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Customer name</label><input class="input" id="ldName" placeholder="e.g. Jordan Blake"></div>
        <div class="field"><label>Phone</label><input class="input" id="ldPhone" placeholder="555-555-0100"></div>
        <div class="field"><label>Vehicle of interest</label>
          <select class="input" id="ldVehicle" onchange="syncLeadValue()">${opts}</select></div>
        <div class="field"><label>Estimated deal value</label><input class="input" id="ldValue" type="number" value="${value || ''}"></div>
        <div class="field"><label>Status</label>
          <select class="input" id="ldStatus">${LEAD_STATUSES.map(s => `<option ${s === 'New' ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div id="ldEst" class="install-hint" style="background:var(--accent-soft);color:var(--accent)"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitLead()">Submit lead</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  host.addEventListener('click', (e) => { if (e.target === host) closeModal(); });
  syncLeadValue();
}

function syncLeadValue() {
  const sel = $('#ldVehicle');
  if (!sel) return;
  const price = +sel.selectedOptions[0]?.dataset.price || 0;
  const valInput = $('#ldValue');
  if (valInput && !valInput.value) valInput.value = price;
  const v = +($('#ldValue').value || price);
  const m = metrics();
  const bonus = isTargetVehicle(sel.value) ? TARGET_BONUS : 0;
  const est = Math.round(v * m.tier.rate) + bonus;
  $('#ldEst').innerHTML = `💡 Est. earning if won: <strong>${money(est)}</strong> (${(m.tier.rate * 100).toFixed(0)}% + ${bonus ? money(bonus) + ' bonus' : 'no bonus'})`;
}

function submitLead() {
  const name = $('#ldName').value.trim();
  const vehicle = $('#ldVehicle').value;
  const value = +$('#ldValue').value || 0;
  if (!name) { toast('Enter a customer name.', 'info'); $('#ldName').focus(); return; }
  const lead = {
    id: uid('lead'), customer: name, vehicle,
    phone: $('#ldPhone').value.trim() || '—',
    value, status: $('#ldStatus').value, date: '2026-07-12',
  };
  state.leads.unshift(lead);
  if (lead.status === 'Won') state.monthly[state.monthly.length - 1] += 1;
  save();
  closeModal();
  toast('✅ Lead submitted!', 'good');
  renderShell();
}

function closeModal() { $('#leadModal')?.remove(); }

/* --------------------------- Toast -------------------------------------- */
function toast(msg, kind = 'info') {
  let host = $('#toastHost');
  if (!host) { host = document.createElement('div'); host.id = 'toastHost'; host.className = 'toast-host'; document.body.appendChild(host); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = esc(msg).replace(/&#39;/g, "'");
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 250); }, 3200);
}

/* --------------------------- Helpers ------------------------------------ */
function fmtDate(d) {
  const [y, mo, day] = d.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1]} ${+day}`;
}
function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}"><div class="empty"><div class="big">📭</div>${msg}</div></td></tr>`;
}

/* --------------------------- Auth --------------------------------------- */
const DEMO_PARTNERS = [
  { name: 'Jordan Blake', company: 'Blake Auto Sales', email: 'jordan@blakeauto.com' },
  { name: 'Priya Nair', company: 'Nair Auto Brokers', email: 'priya@nairbrokers.com' },
];

function renderAuth(mode = 'login') {
  const isSignup = mode === 'signup';
  $('#auth').innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-mark">NEJ</span>
        <div><h1>NEJ Autos</h1><p>Partner Network</p></div>
      </div>
      <h2>${isSignup ? 'Join the network' : 'Partner sign in'}</h2>
      <p class="sub">${isSignup ? 'Start selling premium inventory in minutes.' : 'Access your dashboard, inventory, and payouts.'}</p>
      ${isSignup ? `
        <div class="field"><label>Full name</label><input class="input" id="auName" placeholder="Your name"></div>
        <div class="field"><label>Company</label><input class="input" id="auCompany" placeholder="Dealership or agency"></div>
      ` : ''}
      <div class="field"><label>Email</label><input class="input" id="auEmail" placeholder="you@example.com"></div>
      <div class="field"><label>Password</label><input class="input" id="auPass" type="password" placeholder="••••••••"></div>
      <button class="btn btn-primary btn-block" onclick="${isSignup ? 'doSignup()' : 'doLogin()'}">${isSignup ? 'Create account' : 'Sign in'}</button>
      <div class="auth-switch">
        ${isSignup ? `Already a partner? <button onclick="renderAuth('login')">Sign in</button>`
                   : `New to NEJ Autos? <button onclick="renderAuth('signup')">Apply to join</button>`}
      </div>
      ${!isSignup ? `
      <div class="auth-demo">
        <p>Quick demo login</p>
        <div class="demo-chips">
          ${DEMO_PARTNERS.map((p, i) => `<button class="demo-chip" onclick="demoLogin(${i})">
            <span class="avatar sm" style="width:26px;height:26px;font-size:0.65rem">${esc(initials(p.name))}</span>${esc(p.name)}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>`;
}

function startSession(profile) {
  const existing = load();
  if (existing && existing.session && existing.session.email === profile.email) {
    state = existing;
    migrate();
  } else {
    state = freshState(profile);
    save();
  }
  currentView = (location.hash || '#dashboard').slice(1);
  if (!NAV.some(n => n.id === currentView)) currentView = 'dashboard';
  renderShell();
}

function doLogin() {
  const email = $('#auEmail').value.trim();
  if (!email) { toast('Enter your email.', 'info'); return; }
  const known = DEMO_PARTNERS.find(p => p.email === email);
  startSession(known || { name: 'Jordan Blake', company: 'Blake Auto Sales', email });
}
function demoLogin(i) { startSession(DEMO_PARTNERS[i]); }
function doSignup() {
  const name = $('#auName').value.trim(), company = $('#auCompany').value.trim(), email = $('#auEmail').value.trim();
  if (!name || !email) { toast('Name and email are required.', 'info'); return; }
  localStorage.removeItem(STORE_KEY);
  startSession({ name, company: company || 'Independent Agent', email });
  toast('🎉 Welcome to the NEJ Autos Partner Network!', 'good');
}
function logout() {
  $('#app').classList.remove('active');
  $('#auth').classList.remove('hidden');
  $('#mobile-nav').innerHTML = '';
  state = null;
  location.hash = '';
  renderAuth('login');
}

/* --------------------------- Boot --------------------------------------- */
window.addEventListener('hashchange', () => {
  if (!state) return;
  const v = location.hash.slice(1);
  if (NAV.some(n => n.id === v) && v !== currentView) go(v);
});

function boot() {
  const existing = load();
  if (existing && existing.session) {
    state = existing;
    migrate();
    currentView = (location.hash || '#dashboard').slice(1);
    if (!NAV.some(n => n.id === currentView)) currentView = 'dashboard';
    renderShell();
  } else {
    renderAuth('login');
  }
  // proactively remove any old caching service worker so files are always fresh
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

// expose handlers used in inline onclick
Object.assign(window, {
  go, logout, renderAuth, doLogin, doSignup, demoLogin,
  toggleFav, claimVehicle, openLeadModal, submitLead, closeModal, syncLeadValue,
  setLeadStatus, removeLead, copyRef,
  openShareModal, closeShareModal, doShare,
});

boot();
