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

/* ---- share-to-earn: extend the shares table for portal-user tracking ----
   Idempotent: only adds columns/settings that aren't already there. */
try {
    $hasCol = function (string $table, string $name): bool {
        $q = db()->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c");
        $q->execute([':t' => $table, ':c' => $name]);
        return (int)$q->fetchColumn() > 0;
    };
    if (!$hasCol('shares', 'user_id')) {
        db()->exec("ALTER TABLE shares ADD COLUMN user_id INT UNSIGNED NULL AFTER partner_id,
                    ADD KEY idx_share_user (user_id)");
    }
    if (!$hasCol('shares', 'link_id')) {
        db()->exec("ALTER TABLE shares ADD COLUMN link_id INT UNSIGNED NULL AFTER car_id");
    }
    if (!$hasCol('shares', 'counted')) {
        db()->exec("ALTER TABLE shares ADD COLUMN counted TINYINT NOT NULL DEFAULT 0");
    }
    // Defaults for the per-share reward — never overwrite an admin's custom value.
    $ins = db()->prepare("INSERT IGNORE INTO settings (k, v) VALUES (:k, :v)");
    $ins->execute([':k' => 'share_reward_ngn', ':v' => '2500']);
    $ins->execute([':k' => 'max_counted_shares_per_day', ':v' => '2']);
} catch (Throwable $e) {
    json_err('Share-tracking migration failed: ' . $e->getMessage(), 500);
}

$tables = ['users', 'tracked_links', 'link_clicks', 'ledger', 'withdrawals', 'settings', 'shares'];
$report = [];
foreach ($tables as $t) {
    $report[$t] = (int)db()->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
}

json_out(['ok' => true, 'migrated' => true, 'row_counts' => $report,
    'settings' => get_settings()]);
