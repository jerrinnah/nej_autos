<?php
/* =========================================================================
   NEJ Autos Admin API — dashboard statistics
     GET  stats.php  → KPIs + breakdowns for the overview screen
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$pdo = db();
$one = fn(string $sql) => (int)$pdo->query($sql)->fetchColumn();

/* --------------------------- headline KPIs ------------------------------ */
$carsTotal      = $one('SELECT COUNT(*) FROM cars');
$carsAvailable  = $one("SELECT COUNT(*) FROM cars WHERE status='Available'");
$carsSold       = $one("SELECT COUNT(*) FROM cars WHERE status='Sold'");
$inventoryValue = (int)$pdo->query("SELECT COALESCE(SUM(price),0) FROM cars WHERE status='Available'")->fetchColumn();

$leadsTotal   = $one('SELECT COUNT(*) FROM leads');
$leadsOpen    = $one("SELECT COUNT(*) FROM leads WHERE status NOT IN ('Won','Lost')");
$leadsWon     = $one("SELECT COUNT(*) FROM leads WHERE status='Won'");
$salesValue   = (int)$pdo->query("SELECT COALESCE(SUM(value),0) FROM leads WHERE status='Won'")->fetchColumn();
$leadsNew     = $one("SELECT COUNT(*) FROM leads WHERE status='New'");

$partnersTotal   = $one('SELECT COUNT(*) FROM partners');
$partnersActive  = $one("SELECT COUNT(*) FROM partners WHERE status='Active'");
$partnersPending = $one("SELECT COUNT(*) FROM partners WHERE status='Pending'");

$sharesTotal = $one('SELECT COUNT(*) FROM shares');
$sharesToday = $one("SELECT COUNT(*) FROM shares WHERE DATE(created_at)=CURDATE()");
$sharesWeek  = $one("SELECT COUNT(*) FROM shares WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)");
$attributed  = $one("SELECT COUNT(*) FROM leads WHERE via_share IS NOT NULL AND via_share <> ''");

// last 14 days of share volume (daily bars) — always one row per day, zero-filled
$rawDaily = $pdo->query(
    "SELECT DATE(created_at) d, COUNT(*) c FROM shares
     WHERE created_at >= (CURDATE() - INTERVAL 13 DAY)
     GROUP BY DATE(created_at)")->fetchAll(PDO::FETCH_KEY_PAIR);
$sharesDaily = [];
for ($i = 13; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i day"));
    $sharesDaily[] = ['d' => $d, 'c' => (int)($rawDaily[$d] ?? 0)];
}

/* --------- portal signups (users table may not exist pre-migration) ------- */
$signups = ['pending' => 0, 'today' => 0, 'week' => 0, 'recent' => []];
try {
    $signups['pending'] = $one("SELECT COUNT(*) FROM users WHERE status='Pending'");
    $signups['today']   = $one("SELECT COUNT(*) FROM users WHERE DATE(created_at)=CURDATE()");
    $signups['week']    = $one("SELECT COUNT(*) FROM users WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)");
    $rc = $pdo->query(
        "SELECT id, name, email, role, status, created_at
         FROM users ORDER BY id DESC LIMIT 12")->fetchAll();
    $signups['recent'] = array_map(fn($r) => [
        'id' => (int)$r['id'], 'name' => $r['name'], 'email' => $r['email'],
        'role' => $r['role'], 'status' => $r['status'], 'created_at' => $r['created_at'],
    ], $rc);
} catch (Throwable $e) { /* users table not migrated yet — leave defaults */ }

$payoutPaid    = (int)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM payouts WHERE status='Paid'")->fetchColumn();
$payoutPending = (int)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM payouts WHERE status='Pending'")->fetchColumn();

$conv = $leadsTotal > 0 ? round($leadsWon / $leadsTotal * 100, 1) : 0.0;

/* -------------------------- breakdowns/charts --------------------------- */
$leadsByStatus = $pdo->query(
    "SELECT status, COUNT(*) c FROM leads GROUP BY status")->fetchAll(PDO::FETCH_KEY_PAIR);

$sharesByPlatform = $pdo->query(
    "SELECT platform, COUNT(*) c FROM shares GROUP BY platform ORDER BY c DESC")->fetchAll(PDO::FETCH_KEY_PAIR);

$bodyMix = $pdo->query(
    "SELECT body, COUNT(*) c FROM cars WHERE status='Available' GROUP BY body ORDER BY c DESC")->fetchAll();

// last 6 months of won-lead value (dashboard sparkline)
$trend = $pdo->query(
    "SELECT DATE_FORMAT(updated_at,'%Y-%m') ym, COUNT(*) won, COALESCE(SUM(value),0) val
     FROM leads WHERE status='Won'
     GROUP BY ym ORDER BY ym DESC LIMIT 6")->fetchAll();
$trend = array_reverse($trend);

json_out(['ok' => true, 'stats' => [
    'cars'      => ['total' => $carsTotal, 'available' => $carsAvailable, 'sold' => $carsSold, 'value' => $inventoryValue],
    'leads'     => ['total' => $leadsTotal, 'open' => $leadsOpen, 'won' => $leadsWon, 'new' => $leadsNew,
                    'salesValue' => $salesValue, 'conversion' => $conv, 'attributed' => $attributed],
    'partners'  => ['total' => $partnersTotal, 'active' => $partnersActive, 'pending' => $partnersPending],
    'shares'    => ['total' => $sharesTotal, 'today' => $sharesToday, 'week' => $sharesWeek,
                    'byPlatform' => $sharesByPlatform, 'daily' => $sharesDaily],
    'signups'   => $signups,
    'payouts'   => ['paid' => $payoutPaid, 'pending' => $payoutPending],
    'leadsByStatus' => $leadsByStatus,
    'bodyMix'   => $bodyMix,
    'trend'     => $trend,
]]);
