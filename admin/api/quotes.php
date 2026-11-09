<?php
/* =========================================================================
   NEJ Autos Admin API — saved Import calculator quotes (admin only)
     GET    quotes.php                 → list, newest first
     POST   quotes.php                 → create  { label, inputs, total_ngn, fx }
     POST   quotes.php?id=N            → update  [PUT accepted]
     POST   quotes.php?id=N&_delete=1  → delete  [DELETE accepted]
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

$id = (int)param('id', 0);

// The calculator fields we keep, by type. Anything else in `inputs` is dropped.
const QUOTE_NUM = ['buy_usd', 'truck_usd', 'ship_usd', 'wire_usd', 'comm_usd', 'clearing_ngn',
    'miles', 'base_rate', 'ins_pct', 'duty_pct', 'levy_pct', 'surcharge_pct', 'etls_pct', 'ciss_pct', 'vat_pct',
    'agent_ngn', 'port_ngn', 'transport_ngn', 'reg_ngn', 'prep_ngn', 'markup_pct'];
const QUOTE_BOOL = ['use_truck_est', 'door', 'protect', 'use_customs', 'use_local', 'use_markup'];
const QUOTE_ENUM = ['vtype' => ['sedan', 'suv', 'pickup', 'luxury'], 'ship' => ['open', 'enclosed', 'expedited']];

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Quote id is required.', 422);
    db()->prepare('DELETE FROM import_quotes WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $rows = db()->query('SELECT * FROM import_quotes ORDER BY updated_at DESC, id DESC LIMIT 500')->fetchAll();
    json_out(['ok' => true, 'quotes' => array_map('shape_quote', $rows)]);
}

if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $label = mb_substr(s($b['label'] ?? ''), 0, 120) ?: 'Untitled quote';
    $inputs = clean_inputs(is_array($b['inputs'] ?? null) ? $b['inputs'] : []);
    $inputs['label'] = $label;
    $bind = [
        ':label'  => $label,
        ':inputs' => json_encode($inputs, JSON_UNESCAPED_UNICODE),
        ':total'  => max(0, min(PHP_INT_MAX, (int)round((float)($b['total_ngn'] ?? 0)))),
        ':fx'     => clampInt($b['fx'] ?? 0, 0, 100000),
    ];

    if ($id > 0) {
        $bind[':id'] = $id;
        $st = db()->prepare('UPDATE import_quotes SET label = :label, inputs = :inputs, total_ngn = :total, fx = :fx WHERE id = :id');
        $st->execute($bind);
        $exists = db()->prepare('SELECT COUNT(*) FROM import_quotes WHERE id = :id');
        $exists->execute([':id' => $id]);
        if (!(int)$exists->fetchColumn()) json_err('That quote no longer exists.', 404);
        json_out(['ok' => true, 'id' => $id, 'updated' => true]);
    }
    db()->prepare('INSERT INTO import_quotes (label, inputs, total_ngn, fx) VALUES (:label, :inputs, :total, :fx)')->execute($bind);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true]);
}

json_err('Method not allowed.', 405);

function clean_inputs(array $in): array {
    $out = [];
    foreach (QUOTE_NUM as $k) if (array_key_exists($k, $in) && is_numeric($in[$k])) $out[$k] = max(0, min(1e12, (float)$in[$k]));
    foreach (QUOTE_BOOL as $k) if (array_key_exists($k, $in)) $out[$k] = (bool)$in[$k];
    foreach (QUOTE_ENUM as $k => $ok) if (in_array($in[$k] ?? null, $ok, true)) $out[$k] = $in[$k];
    return $out;
}

function shape_quote(array $r): array {
    $inputs = json_decode((string)$r['inputs'], true);
    return [
        'id' => (int)$r['id'], 'label' => $r['label'],
        'inputs' => is_array($inputs) ? $inputs : [],
        'total_ngn' => (int)$r['total_ngn'], 'fx' => (int)$r['fx'],
        'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
    ];
}
