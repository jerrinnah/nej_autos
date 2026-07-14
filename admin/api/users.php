<?php
/* =========================================================================
   NEJ Autos Admin API — broker/distributor account management (admin only)
     GET    users.php                 → all accounts + balances
     POST   users.php?id=N            → update { status, commission_pct, role }
     POST   users.php?id=N&_delete=1  → delete account (and its data)
   Approving = set status 'Active'.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$id = (int)param('id', 0);

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('User id required.', 422);
    // clean up dependent rows first (no FKs defined, so do it explicitly)
    foreach (['ledger', 'withdrawals', 'tracked_links'] as $t) {
        db()->prepare("DELETE FROM `$t` WHERE user_id = :u")->execute([':u' => $id]);
    }
    db()->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $rows = db()->query('SELECT * FROM users ORDER BY status="Pending" DESC, created_at DESC')->fetchAll();
    $out = [];
    foreach ($rows as $r) {
        $bal = user_balance((int)$r['id']);
        $out[] = [
            'id' => (int)$r['id'], 'name' => $r['name'], 'email' => $r['email'], 'phone' => $r['phone'],
            'company' => $r['company'], 'role' => $r['role'], 'status' => $r['status'],
            'referral_code' => $r['referral_code'],
            'commission_pct' => $r['commission_pct'] !== null ? (float)$r['commission_pct'] : null,
            'joined' => substr((string)$r['created_at'], 0, 10),
            'last_login' => $r['last_login'] ? substr((string)$r['last_login'], 0, 10) : null,
            'balance' => $bal,
        ];
    }
    json_out(['ok' => true, 'users' => $out]);
}

if (method() === 'POST' || method() === 'PUT') {
    if ($id <= 0) json_err('User id required.', 422);
    $b = input();
    $sets = []; $bind = [':id' => $id];

    if (isset($b['status'])) {
        $v = s($b['status']);
        if (!in_array($v, ['Pending', 'Active', 'Suspended'], true)) json_err('Invalid status.', 422);
        $sets[] = 'status = :st'; $bind[':st'] = $v;
        if ($v === 'Active') $sets[] = 'approved_at = COALESCE(approved_at, NOW())';
    }
    if (array_key_exists('commission_pct', $b)) {
        if ($b['commission_pct'] === null || $b['commission_pct'] === '') {
            $sets[] = 'commission_pct = NULL';
        } else {
            $pct = (float)$b['commission_pct'];
            if ($pct < 0 || $pct > 100) json_err('Commission must be 0–100.', 422);
            $sets[] = 'commission_pct = :pct'; $bind[':pct'] = $pct;
        }
    }
    if (isset($b['role'])) {
        $v = s($b['role']);
        if (!in_array($v, ['broker', 'distributor'], true)) json_err('Invalid role.', 422);
        $sets[] = 'role = :role'; $bind[':role'] = $v;
    }
    if (!$sets) json_err('Nothing to update.', 422);

    db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($bind);
    json_out(['ok' => true, 'id' => $id, 'updated' => true]);
}

json_err('Method not allowed.', 405);
