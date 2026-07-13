<?php
/* =========================================================================
   NEJ Autos Admin API — partners
     GET    partners.php               → list (leaderboard order)
     POST   partners.php               → create
     POST   partners.php?id=N          → update   [PUT accepted]
     POST   partners.php?id=N&_delete=1→ delete    [DELETE accepted]
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$id = (int)param('id', 0);
$STATUSES = ['Active', 'Pending', 'Suspended'];

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Partner id is required.', 422);
    db()->prepare('DELETE FROM partners WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $rows = db()->query('SELECT * FROM partners ORDER BY units DESC, commission DESC')->fetchAll();
    json_out(['ok' => true, 'partners' => array_map('shape_partner', $rows)]);
}

if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $fields = [
        'name'          => s($b['name'] ?? ''),
        'company'       => s($b['company'] ?? ''),
        'email'         => s($b['email'] ?? ''),
        'phone'         => s($b['phone'] ?? ''),
        'referral_code' => s($b['referral_code'] ?? '') ?: gen_code($b['name'] ?? 'NEJ'),
        'units'         => max(0, (int)($b['units'] ?? 0)),
        'ytd'           => max(0, (int)($b['ytd'] ?? 0)),
        'commission'    => max(0, (int)($b['commission'] ?? 0)),
        'referrals'     => max(0, (int)($b['referrals'] ?? 0)),
        'shares'        => max(0, (int)($b['shares'] ?? 0)),
        'status'        => in_array(s($b['status'] ?? 'Active'), $STATUSES, true) ? s($b['status'] ?? 'Active') : 'Active',
    ];
    if ($fields['name'] === '') json_err('Partner name is required.', 422);

    $bind = [];
    foreach ($fields as $k => $v) $bind[":$k"] = $v;

    try {
        if ($id > 0) {
            $sets = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($fields)));
            $bind[':id'] = $id;
            db()->prepare("UPDATE partners SET $sets WHERE id = :id")->execute($bind);
            json_out(['ok' => true, 'id' => $id, 'updated' => true]);
        } else {
            $cols = implode(', ', array_keys($fields));
            $ph   = implode(', ', array_map(fn($k) => ":$k", array_keys($fields)));
            db()->prepare("INSERT INTO partners ($cols) VALUES ($ph)")->execute($bind);
            json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true]);
        }
    } catch (PDOException $e) {
        if ((int)$e->getCode() === 23000) json_err('That referral code is already in use.', 409);
        json_err('Could not save partner.', 500);
    }
}

json_err('Method not allowed.', 405);

function shape_partner(array $r): array {
    return [
        'id' => (int)$r['id'], 'name' => $r['name'], 'company' => $r['company'],
        'email' => $r['email'], 'phone' => $r['phone'], 'referral_code' => $r['referral_code'],
        'units' => (int)$r['units'], 'ytd' => (int)$r['ytd'], 'commission' => (int)$r['commission'],
        'referrals' => (int)$r['referrals'], 'shares' => (int)$r['shares'], 'status' => $r['status'],
        'joined' => $r['joined'],
    ];
}

function gen_code(string $name): string {
    $name = trim($name) ?: 'NEJ';
    $parts = preg_split('/\s+/', $name);
    $ini = '';
    foreach (array_slice($parts, 0, 2) as $p) $ini .= strtoupper($p[0] ?? '');
    if ($ini === '') $ini = 'XX';
    return 'NEJ-' . $ini . '-' . (2600 + mb_strlen($name));
}
