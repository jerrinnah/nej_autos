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
└── api/
    ├── _bootstrap.php  # DB connection, sessions, auth guard, JSON helpers
    ├── install.php     # one-time installer (creates tables + first admin)
    ├── auth.php        # login / session / logout
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
| **Overview** | Live KPIs: inventory value, sales won, open leads, partners, pending payouts, shares. Charts for lead pipeline, share platforms, stock mix, and a 6-month sales sparkline. |
| **Inventory** | Add / edit / delete vehicles, upload photos, set price/mileage/status, flag EV/Premium/Bonus, and **generate a shareable `car.html` link** (optionally attributed to a partner referral code). |
| **Leads** | Every enquiry, filter by status, change status inline (New → Contacted → Financing → Won/Lost), see which came via share links. |
| **Partners** | The network roster + leaderboard: units, YTD, commission, shares; add/edit/suspend partners; auto-generated referral codes. |
| **Payouts** | Record commission runs, mark them paid, track pending vs. paid totals. |
| **Shares** | Share-to-earn activity log by platform and partner. |

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

**The loop**
1. User signs up at `/portal` → you approve in **Admin → Accounts**.
2. User picks a car → gets a tracked link `nejautos.com/l/<slug>`.
3. Every click is logged (total + unique) and shown on their **My Links** tab.
4. A visitor enquires → a lead is created, attributed by the user's referral code.
5. You mark that lead **Won** in **Admin → Leads** → the system automatically
   pays the broker commission / unlocks the distributor's points + bonus.
6. The user requests a withdrawal → you approve/pay it under **Admin → Withdrawals**.

**Tunable settings** (Admin → Settings): broker %, points per click, ₦ per point,
distributor sale bonus, minimum withdrawal.

## Security notes

- Passwords are stored with `password_hash()` (bcrypt); never in plain text.
- All queries use PDO **prepared statements** (no SQL injection).
- Admin session is an HTTP-only, `SameSite=Strict` cookie; mutations also enforce a same-origin check.
- `config.php`, `schema.sql`, and this README are blocked from direct web access by `.htaccess`.
- The `uploads/` folder has PHP execution disabled and serves images only.
- Set `cookie_secure => true` (default) and serve the site over HTTPS.
