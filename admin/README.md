# NEJ Autos — Admin Control Centre

A PHP + MySQL admin dashboard for managing the whole NEJ Autos operation:
**inventory/cars** (with photo upload), **leads & sales**, **partners & leaderboard**,
and **payouts & shares** — all live from your cPanel database.

Lives at `https://nejautos.com/admin/`. The public site and shareable car pages are unchanged.

```
admin/
├── index.html          # dashboard shell (login + SPA)
├── admin.css           # styles (matches the portal's dark-navy / amber theme)
├── admin.js            # single-page app logic
├── schema.sql          # database tables
├── config.sample.php   # copy to config.php and fill in DB credentials
├── README.md           # this file
├── uploads/cars/       # uploaded car photos land here (auto-created)
├── uploads/site/       # slider images land here (auto-created)
└── api/
    ├── _bootstrap.php  # DB connection, sessions, auth guard, JSON helpers
    ├── install.php     # one-time installer (creates tables + first admin)
    ├── auth.php        # login / session / logout
    ├── content.php     # homepage CMS: content blocks + hero slides
    ├── _content_defaults.php  # the copy the site ships with (CMS fallback + Reset)
    ├── cars.php        # inventory CRUD + photo upload + public read
    ├── leads.php       # leads CRUD + public enquiry create
    ├── partners.php    # partners CRUD
    ├── payouts.php     # payouts CRUD
    ├── shares.php      # share activity
    └── stats.php       # dashboard KPIs
```

---

## Setup (once, on your cPanel host)

### 1. Create the database
cPanel → **Databases** section. Depending on your cPanel theme the MySQL tool is
labelled **"MySQL® Databases"**, **"Manage My Databases"**, or **"Database Wizard"**
(all the same thing — *not* the PostgreSQL ones). The **Database Wizard** is easiest:

1. **Step 1:** name the database, e.g. `nejautos` (cPanel stores it as `youruser_nejautos`).
2. **Step 2:** create a database user + strong password.
3. **Step 3:** grant the user **ALL PRIVILEGES**, then finish.

Note the final names — they're prefixed with your cPanel username, e.g.
`cpuser_nejautos` (db) and `cpuser_admin` (user). Copy all three: db name, user, password.

### 2. Configure
In the `admin/` folder (via cPanel File Manager or SSH):
1. Copy `config.sample.php` → `config.php`.
2. Fill in `db_name`, `db_user`, `db_pass`.
3. Set a temporary `install_token` to any long random string.

`config.php` is git-ignored, so your credentials never reach GitHub.

### 3. Install (creates tables + your admin login)
Visit this URL once (replace the values):

```
https://nejautos.com/admin/api/install.php?token=YOUR_TOKEN&user=admin&pass=YourStrongPassword&demo=1
```

- `demo=1` seeds sample cars/partners/leads so the dashboard isn't empty. Drop it (or use `demo=0`) for a clean start.
- You should see a JSON `{"ok":true,...}` response.

### 4. Lock the installer
Edit `config.php` again and set `'install_token' => ''` (blank).
This disables `install.php` so it can never be re-run by anyone.

### 5. Log in
Open `https://nejautos.com/admin/` and sign in with the username/password from step 3.

---

## What each screen does

| Screen | Manage / monitor |
|--------|------------------|
| **Overview** | Live KPIs: inventory value, sales won, open leads, partners, pending payouts, and **shares today** (with 7-day / all-time context). Charts for lead pipeline, share platforms, stock mix, a **14-day shares-per-day** bar chart, and a 6-month sales sparkline. |
| **Inventory** | Add / edit / delete vehicles, upload photos, set price/mileage/status, flag EV/Premium/Bonus, and **generate a shareable `car.html` link** (optionally attributed to a partner referral code). |
| **Website** | The homepage CMS: build the **hero slider** (photo, headline, button, order, show/hide) and edit every block of copy — header menu, search bar, section headings, Share & Earn steps and reward band, partner tiers, testimonials, the partner call-to-action, and the footer. Each section has its own **Reset** back to the wording the site shipped with. |
| **Leads** | Every enquiry, filter by status, change status inline (New → Contacted → Financing → Won/Lost), see which came via share links. |
| **Partners** | The network roster + leaderboard: units, YTD, commission, shares; add/edit/suspend partners; auto-generated referral codes. |
| **Payouts** | Record commission runs, mark them paid, track pending vs. paid totals. |
| **Shares** | Share-to-earn activity log by platform and partner, with **today's share count** in the header. |
| **Top sharers** | Monthly **bonus-pool leaderboard**: ranks partners by unique clicks their links drove, shows each one's computed cut of the pool, and pays it out with one click. |

> **🔔 Notifications** — the sidebar bell shows a live count of **new signups** you
> haven't looked at yet. Open it for the recent-signup list (approve pending
> accounts inline) plus today's signup and share totals. The **Accounts** tab also
> carries a badge with the number awaiting approval. Everything is in-app — no email
> to configure. The "seen" mark is per-device (kept in your browser).

---

## Connecting the public site (optional, next step)

The API already exposes a **public, no-auth** read of live inventory:

```
GET /admin/api/cars.php?public=1   →  { "cars": [ ... ] }
```

and accepts **public enquiries + share events** (so `car.html`'s "I'm interested"
and share buttons can write straight to the database):

```
POST /admin/api/leads.php    { customer, vehicle, phone, value, car_id, ref, via_share }
POST /admin/api/shares.php   { vehicle, car_id, platform, ref }
```

To make `index.html` / `portal.html` show real inventory instead of the seeded
demo data, point their fetch at `cars.php?public=1`. Say the word and I'll wire it up.

---

## Broker & Distributor accounts (portal)

The public portal at `nejautos.com/portal` lets people **self-register** as a
**broker** or **distributor**. New accounts are `Pending` until you approve them
under **Admin → Accounts**.

**One-time setup:** after deploying, log into the admin panel and open the
**Accounts** tab → click **Set up now** (or visit `/admin/api/migrate.php` while
logged in). This creates the broker/distributor tables. Safe to re-run.

**How they earn**
- **Broker** — browses available cars, shares a tracked link, and earns a
  **commission** (default **12%**, editable in Admin → Settings, or per-broker)
  when the buyer's enquiry is marked **Won**.
- **Distributor** — shares tracked links and earns **points per unique click**
  (default 5 pts = ₦250) that accrue weekly, **plus a sale bonus** (default
  ₦25,000) when a shared car sells. Click earnings stay **locked until that car
  is sold**, then become withdrawable.
- **Share reward** — a signed-in partner earns a small **₦ reward per counted
  share** (default ₦800), capped at a few counted shares per day. Like click
  points, these stay **pending until a car they shared sells**.

**Top-sharer bonus (activity reward, capped)** — to keep partners motivated even
when a sale doesn't close through their own link, a **fixed monthly pool** is split
among the highest sharers, ranked by the **unique clicks** their links drove (each
link's daily clicks capped by the same anti-fraud limit, so it can't be farmed).
Configure it under **Settings → Top-sharer bonus** (pool, number of winners, split
method); set the pool to **0** to switch it off. Pay it out under **Admin → Top
sharers** — you see the ranking and each winner's cut, then approve with one click
(idempotent: a month can only be paid once). Because it's a fixed pool, your monthly
cost never exceeds what you set, no matter how much activity happens. This bonus is
paid **available** (immediately withdrawable) — it's the one reward not gated behind
a sale, which is why it's pool-capped and admin-approved.

**Keeping payouts moderate (anti-rip-off)** — aside from the capped top-sharer pool,
sharing never pays on its own; every share/click reward is gated behind a real sale.
Two caps in **Admin → Settings → Anti-fraud limits** bound the exposure per sale:
- **Click unlock cap (% of sale)** — releases pending click points only up to this
  share of the car's real price.
- **Share reward unlock cap (% of sale)** — new: when a shared car sells, releases
  pending share rewards for that car only up to this share of the car's real price
  (oldest first). Stops a month of stacked daily share rewards from all cashing out
  on one thin-margin sale; leftover rewards stay pending for future genuine sales.

**The loop**
1. User signs up at `/portal` → you approve in **Admin → Accounts**.
2. User picks a car → gets a tracked link `nejautos.com/l/<slug>`.
3. Every click is logged (total + unique) and shown on their **My Links** tab.
4. A visitor enquires → a lead is created, attributed by the user's referral code.
5. You mark that lead **Won** in **Admin → Leads** → the system automatically
   pays the broker commission / unlocks the distributor's points + bonus.
6. The user requests a withdrawal → you approve/pay it under **Admin → Withdrawals**.

**Payout details (self-service)** — brokers/distributors save their **bank account
number** (bank, account number, account name) any time under the portal's **Settings**
tab; it pre-fills every withdrawal so they don't retype it. The withdrawal button
still **unlocks only when their balance reaches the minimum**. You can see each
partner's saved account in **Admin → Accounts** (click a row) to verify before paying.

**Tunable settings** (Admin → Settings): broker %, points per click, ₦ per point,
distributor sale bonus, minimum withdrawal.

## Editing the website (Website screen)

Everything the homepage says now comes from the database, with the copy in
`index.html` acting as the fallback. If the API is unreachable, the database
isn't migrated, or a block has never been saved, the page renders exactly the
wording it shipped with — it never goes blank.

### Hero slider
`Website → Hero slider → ＋ Add slide`. Each slide has a photo, headline,
sub-heading, button (text + target), text position (left or centred), and a
darkening percentage over the photo so light images keep the text readable.

- Slides only appear on the site while they're **Live**. Hide or delete them
  all and the original animated hero comes straight back.
- `↑ / ↓` reorder; the order saves as soon as you click.
- **Autoplay delay** is in milliseconds — set it to `0` to make the slider
  manual only. It also pauses on hover, in a background tab, and for visitors
  who've asked their system to reduce motion.
- Wide, landscape photos work best. They go to `admin/uploads/site/`.

### Copy
Every other panel edits one block of the page. Type, then hit that panel's
**Save changes** — each panel saves on its own, so a half-finished edit in one
section never touches another.

- Headings are split into three fields: plain text, the **highlighted** part
  (rendered in the accent style), and anything after it. Leave the ones you
  don't need blank.
- Body text supports `*asterisks*` for **bold**. Everything else is escaped —
  HTML pasted into these fields shows up as literal text rather than markup,
  which is deliberate.
- "Lines" fields take one item per line. Link lines are `Label | target`,
  e.g. `Our fleet | #fleet` or `Portal | portal`.
- Lists (steps, tiers, quotes, stats…) can be added to, reordered and trimmed.
- **Reset** on a panel restores that section to the original wording. It only
  affects that one section.

Changes are live as soon as they save — reload the homepage to see them.

> **Scope:** this covers the homepage. The partner portal and car detail pages
> still read their wording from `portal.html` / `car.html`.

## Security notes

- Passwords are stored with `password_hash()` (bcrypt); never in plain text.
- All queries use PDO **prepared statements** (no SQL injection).
- Admin session is an HTTP-only, `SameSite=Strict` cookie; mutations also enforce a same-origin check.
- `config.php`, `schema.sql`, and this README are blocked from direct web access by `.htaccess`.
- The `uploads/` folder has PHP execution disabled and serves images only.
- Set `cookie_secure => true` (default) and serve the site over HTTPS.
