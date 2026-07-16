<?php
/* =========================================================================
   NEJ Autos — portal dashboard summary for the logged-in user
     GET  me.php  → profile, balance, weekly earnings, click totals, activity
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
$user = require_user();
$pdo = db();
$uid = (int)$user['id'];

$bal = user_balance($uid);

/* link totals */
$lt = $pdo->prepare('SELECT COUNT(*) links, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(uniques),0) uniques
                     FROM tracked_links WHERE user_id = :u');
$lt->execute([':u' => $uid]);
$links = $lt->fetch();

/* share totals (guarded: shares columns exist only after the v2.1 migration) */
$shares = ['total' => 0, 'counted' => 0, 'today' => 0];
try {
    $shq = $pdo->prepare("SELECT COUNT(*) total,
            COALESCE(SUM(counted),0) counted,
            COALESCE(SUM(CASE WHEN DATE(created_at)=CURDATE() THEN counted ELSE 0 END),0) today
         FROM shares WHERE user_id = :u");
    $shq->execute([':u' => $uid]);
    $r = $shq->fetch();
    if ($r) $shares = ['total' => (int)$r['total'], 'counted' => (int)$r['counted'], 'today' => (int)$r['today']];
} catch (Throwable $e) { /* not migrated yet → zeros */ }

/* this ISO week's earnings (all ledger movement dated this week) */
$wk = $pdo->prepare("SELECT COALESCE(SUM(amount),0) amt, COALESCE(SUM(points),0) pts
                     FROM ledger WHERE user_id=:u AND week=:w");
$wk->execute([':u' => $uid, ':w' => iso_week()]);
$week = $wk->fetch();

/* attributed sales (Won leads under this user's code) */
$sales = $pdo->prepare("SELECT COUNT(*) FROM leads WHERE ref=:c AND status='Won'");
$sales->execute([':c' => $user['referral_code']]);
$salesWon = (int)$sales->fetchColumn();

/* recent ledger entries */
$led = $pdo->prepare('SELECT type,points,amount,status,note,week,created_at
                      FROM ledger WHERE user_id=:u ORDER BY id DESC LIMIT 15');
$led->execute([':u' => $uid]);

/* pending withdrawals */
$wd = $pdo->prepare('SELECT id,amount,status,requested_at,processed_at FROM withdrawals
                     WHERE user_id=:u ORDER BY id DESC LIMIT 10');
$wd->execute([':u' => $uid]);

$rate = $user['commission_pct'] !== null ? (float)$user['commission_pct'] : (float)setting('broker_rate_pct', '12');

json_out(['ok' => true,
    'user' => [
        'id' => $uid, 'name' => $user['name'], 'email' => $user['email'],
        'role' => $user['role'], 'referral_code' => $user['referral_code'],
    ],
    'balance' => $bal,
    'links'   => ['count' => (int)$links['links'], 'clicks' => (int)$links['clicks'], 'uniques' => (int)$links['uniques']],
    'shares'  => ['total' => $shares['total'], 'counted' => $shares['counted'], 'today' => $shares['today'],
                  'cap' => (int)setting('max_counted_shares_per_day', '2')],
    'week'    => ['label' => iso_week(), 'amount' => (int)$week['amt'], 'points' => (int)$week['pts']],
    'salesWon' => $salesWon,
    'config'  => [
        'broker_rate_pct'  => $rate,
        'click_points'     => (int)setting('click_points', '5'),
        'point_value_ngn'  => (int)setting('point_value_ngn', '50'),
        'sale_bonus_ngn'   => (int)setting('distributor_sale_bonus_ngn', '25000'),
        'share_reward_ngn' => (int)setting('share_reward_ngn', '800'),
        'min_withdrawal'   => (int)setting('min_withdrawal_ngn', '10000'),
    ],
    'ledger'  => array_map(function ($r) {
        return ['type' => $r['type'], 'points' => (int)$r['points'], 'amount' => (int)$r['amount'],
                'status' => $r['status'], 'note' => $r['note'], 'week' => $r['week'],
                'date' => substr((string)$r['created_at'], 0, 10)];
    }, $led->fetchAll()),
    'withdrawals' => array_map(function ($r) {
        return ['id' => (int)$r['id'], 'amount' => (int)$r['amount'], 'status' => $r['status'],
                'requested' => substr((string)$r['requested_at'], 0, 10),
                'processed' => $r['processed_at'] ? substr((string)$r['processed_at'], 0, 10) : null];
    }, $wd->fetchAll()),
]);
