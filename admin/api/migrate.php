<?php
/* =========================================================================
   NEJ Autos Admin API — apply schema v2 (broker/distributor system)
   Admin-only. Visit once while logged into the admin panel:
       /admin/api/migrate.php
   Safe to re-run (CREATE TABLE IF NOT EXISTS / INSERT IGNORE).
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$sqlFile = dirname(__DIR__) . '/schema_v2.sql';
if (!is_file($sqlFile)) json_err('schema_v2.sql not found next to /admin.', 500);

try {
    db()->exec(file_get_contents($sqlFile));
} catch (Throwable $e) {
    json_err('Migration failed: ' . $e->getMessage(), 500);
}

$tables = ['users', 'tracked_links', 'link_clicks', 'ledger', 'withdrawals', 'settings'];
$report = [];
foreach ($tables as $t) {
    $report[$t] = (int)db()->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
}

json_out(['ok' => true, 'migrated' => true, 'row_counts' => $report,
    'settings' => get_settings()]);
