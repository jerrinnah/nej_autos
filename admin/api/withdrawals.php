<?php
/* =========================================================================
   NEJ Autos — withdrawals
     USER  side (portal session):
       GET  withdrawals.php            → my withdrawal requests
       POST withdrawals.php            → request  { amount, method, detail }
     ADMIN side (admin session):
       GET  withdrawals.php?admin=1              → all requests
       POST withdrawals.php?admin=1&id=N         → { status, admin_note }
   Withdrawable balance requires 'available' ledger funds — which for a
   distributor only exist after a shared car has sold.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$isAdminCall = (string)param('admin', '') === '1';

/* =============================== ADMIN ================================== */
if ($isAdminCall) {
    require_admin();

    if (method() === 'GET') {
        $rows = db()->query(
            'SELECT w.*, u.name, u.email, u.role FROM withdrawals w
             JOIN users u ON u.id = w.user_id ORDER BY w.status="Requested" DESC, w.id DESC')->fetchAll();
        json_out(['ok' => true, 'withdrawals' => array_map('shape_wd_admin', $rows)]);
    }

    if (method() === 'POST' || method() === 'PUT') {
        $id = (int)param('id', 0);
        if ($id <= 0) json_err('Withdrawal id required.', 422);
        $status = s(param('status', ''));
        if (!in_array($status, ['Approved', 'Paid', 'Rejected', 'Requested'], true)) json_err('Invalid status.', 422);
        $note = s(param('admin_note', ''));
        db()->prepare('UPDATE withdrawals SET status=:s, admin_note=:n,
                       processed_at = IF(:s2 IN ("Paid","Rejected"), NOW(), processed_at) WHERE id=:id')
            ->execute([':s' => $status, ':n' => $note ?: null, ':s2' => $status, ':id' => $id]);
        json_out(['ok' => true, 'id' => $id, 'status' => $status]);
    }
    json_err('Method not allowed.', 405);
}

/* =============================== USER =================================== */
$user = require_user();
$uid = (int)$user['id'];

if (method() === 'GET') {
    $st = db()->prepare('SELECT * FROM withdrawals WHERE user_id=:u ORDER BY id DESC');
    $st->execute([':u' => $uid]);
    json_out(['ok' => true, 'withdrawals' => array_map('shape_wd', $st->fetchAll()), 'balance' => user_balance($uid)]);
}

if (method() === 'POST') {
    $amount = max(0, (int)param('amount', 0));
    $method = s(param('method', ''));
    $detail = s(param('detail', ''));
    $min = (int)setting('min_withdrawal_ngn', '10000');
    $bal = user_balance($uid);

    if ($amount < $min) json_err('Minimum withdrawal is ' . $min . '.', 422);
    if ($amount > $bal['withdrawable']) {
        json_err($bal['withdrawable'] <= 0
            ? 'You have no withdrawable balance yet — earnings unlock once a shared car is sold.'
            : 'Amount exceeds your withdrawable balance.', 422, ['balance' => $bal]);
    }
    if ($method === '' || $detail === '') json_err('Payout method and account details are required.', 422);

    db()->prepare('INSERT INTO withdrawals (user_id,amount,method,detail) VALUES (:u,:a,:m,:d)')
        ->execute([':u' => $uid, ':a' => $amount, ':m' => $method, ':d' => $detail]);
    json_out(['ok' => true, 'requested' => true, 'id' => (int)db()->lastInsertId(),
        'balance' => user_balance($uid)], 201);
}

json_err('Method not allowed.', 405);

/* ------------------------------- helpers -------------------------------- */
function shape_wd(array $r): array {
    return ['id' => (int)$r['id'], 'amount' => (int)$r['amount'], 'status' => $r['status'],
            'method' => $r['method'], 'detail' => $r['detail'], 'admin_note' => $r['admin_note'],
            'requested' => substr((string)$r['requested_at'], 0, 10),
            'processed' => $r['processed_at'] ? substr((string)$r['processed_at'], 0, 10) : null];
}
function shape_wd_admin(array $r): array {
    return shape_wd($r) + ['user' => ['name' => $r['name'], 'email' => $r['email'], 'role' => $r['role']]];
}
