<?php
/* =========================================================================
   NEJ Autos Admin API — payouts
     GET    payouts.php               → list
     POST   payouts.php               → create
     POST   payouts.php?id=N          → update (e.g. mark Paid)  [PUT accepted]
     POST   payouts.php?id=N&_delete=1→ delete  [DELETE accepted]
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$id = (int)param('id', 0);
$STATUSES = ['Pending', 'Paid', 'Failed'];

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Payout id is required.', 422);
    db()->prepare('DELETE FROM payouts WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $rows = db()->query(
        'SELECT p.*, pa.name AS partner_name FROM payouts p
         LEFT JOIN partners pa ON pa.id = p.partner_id
         ORDER BY p.created_at DESC')->fetchAll();
    json_out(['ok' => true, 'payouts' => array_map('shape_payout', $rows)]);
}

if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $status = in_array(s($b['status'] ?? 'Pending'), $STATUSES, true) ? s($b['status'] ?? 'Pending') : 'Pending';
    $fields = [
        'partner_id' => (int)($b['partner_id'] ?? 0) ?: null,
        'descr'      => s($b['descr'] ?? 'Commission run') ?: 'Commission run',
        'amount'     => max(0, (int)($b['amount'] ?? 0)),
        'status'     => $status,
        'ref'        => s($b['ref'] ?? '') ?: gen_ref(),
        'paid_on'    => $status === 'Paid' ? (s($b['paid_on'] ?? '') ?: date('Y-m-d')) : (s($b['paid_on'] ?? '') ?: null),
    ];

    $bind = [];
    foreach ($fields as $k => $v) $bind[":$k"] = $v;

    if ($id > 0) {
        $sets = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($fields)));
        $bind[':id'] = $id;
        db()->prepare("UPDATE payouts SET $sets WHERE id = :id")->execute($bind);
        json_out(['ok' => true, 'id' => $id, 'updated' => true]);
    }
    $cols = implode(', ', array_keys($fields));
    $ph   = implode(', ', array_map(fn($k) => ":$k", array_keys($fields)));
    db()->prepare("INSERT INTO payouts ($cols) VALUES ($ph)")->execute($bind);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true]);
}

json_err('Method not allowed.', 405);

function shape_payout(array $r): array {
    return [
        'id' => (int)$r['id'], 'partner_id' => $r['partner_id'] !== null ? (int)$r['partner_id'] : null,
        'partner_name' => $r['partner_name'] ?? null,
        'descr' => $r['descr'], 'amount' => (int)$r['amount'], 'status' => $r['status'],
        'ref' => $r['ref'], 'paid_on' => $r['paid_on'],
        'date' => substr((string)$r['created_at'], 0, 10),
    ];
}

function gen_ref(): string { return 'NEJ-PO-' . random_int(4000, 9999); }
