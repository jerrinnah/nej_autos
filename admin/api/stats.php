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
$attributed  = $one("SELECT COUNT(*) FROM leads WHERE via_share IS NOT NULL AND via_share <> ''");

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
    'shares'    => ['total' => $sharesTotal, 'byPlatform' => $sharesByPlatform],
    'payouts'   => ['paid' => $payoutPaid, 'pending' => $payoutPending],
    'leadsByStatus' => $leadsByStatus,
    'bodyMix'   => $bodyMix,
    'trend'     => $trend,
]]);
