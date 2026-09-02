<?php
/* =========================================================================
   NEJ Autos Admin API — leads
     GET    leads.php               → list (optional ?status=Won&ref=CODE)
     POST   leads.php               → create  (public enquiry OR admin)
     POST   leads.php?id=N          → update  (admin)   [PUT accepted]
     POST   leads.php?id=N&_delete=1→ delete  (admin)   [DELETE accepted]
   Public visitors may CREATE a lead (an enquiry); everything else needs auth.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$id = (int)param('id', 0);
$STATUSES = ['New', 'Contacted', 'Financing', 'Won', 'Lost'];

/* ---- public enquiry create (from car.html "I'm interested") ---- */
if (method() === 'POST' && $id === 0 && (string)param('_delete', '') !== '1') {
    $b = input();
    $lead = [
        ':customer' => s($b['customer'] ?? ''),
        ':vehicle'  => s($b['vehicle'] ?? ''),
        ':car_id'   => (int)($b['car_id'] ?? 0) ?: null,
        ':phone'    => s($b['phone'] ?? ''),
        ':value'    => max(0, (int)($b['value'] ?? 0)),
        ':status'   => in_array(s($b['status'] ?? 'New'), $STATUSES, true) ? s($b['status'] ?? 'New') : 'New',
        ':via_share'=> ($vs = s($b['via_share'] ?? '')) !== '' ? $vs : null,
        ':ref'      => ($rf = s($b['ref'] ?? '')) !== '' ? $rf : null,
        ':note'     => s($b['note'] ?? '') ?: null,
    ];
    if ($lead[':customer'] === '') json_err('Customer name is required.', 422);

    /* ---- offer floor ----
       An offer is a negotiating position, not a payment, so it is stored on the
       lead and never used to compute money (see settle_sale). What it does need
       is a floor: without one a ₦40M car collects ₦2M offers and the admin stops
       reading them. Anonymous offers are checked against the car's REAL price. */
    if (!current_admin() && $lead[':value'] > 0 && $lead[':car_id']) {
        $cq = db()->prepare('SELECT price FROM cars WHERE id = :id');
        $cq->execute([':id' => $lead[':car_id']]);
        $ask = (int)$cq->fetchColumn();
        $pct = max(0, min(100, (int)setting('min_offer_pct', '85')));
        if ($ask > 0 && $pct > 0) {
            $floor = (int)ceil($ask * $pct / 100);
            if ($lead[':value'] < $floor) {
                json_err('That offer is below what we can consider on this car. The lowest we look at is '
                    . money_ngn($floor) . '.', 422, ['minOffer' => $floor, 'asking' => $ask]);
            }
        }
    }

    // An admin can set any status; anonymous enquiries are forced to 'New'.
    if (!current_admin()) $lead[':status'] = 'New';

    db()->prepare(
        'INSERT INTO leads (customer,vehicle,car_id,phone,value,status,via_share,ref,note)
         VALUES (:customer,:vehicle,:car_id,:phone,:value,:status,:via_share,:ref,:note)'
    )->execute($lead);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true], 201);
}

/* ------------------- everything else requires admin --------------------- */
require_admin();

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Lead id is required.', 422);
    db()->prepare('DELETE FROM leads WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $where = []; $args = [];
    if (($st = s(param('status', ''))) !== '') { $where[] = 'status = :st'; $args[':st'] = $st; }
    if (($rf = s(param('ref', '')))    !== '') { $where[] = 'ref = :rf';    $args[':rf'] = $rf; }
    $sql = 'SELECT * FROM leads' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY created_at DESC';
    $q = db()->prepare($sql); $q->execute($args);
    json_out(['ok' => true, 'leads' => array_map('shape_lead', $q->fetchAll())]);
}

if (method() === 'POST' || method() === 'PUT') {
    if ($id <= 0) json_err('Lead id is required.', 422);
    $b = input();
    $fields = [];
    if (isset($b['status'])) {
        $v = s($b['status']);
        if (!in_array($v, $STATUSES, true)) json_err('Invalid status.', 422);
        $fields['status'] = $v;
    }
    foreach (['customer','vehicle','phone','note'] as $k) if (isset($b[$k])) $fields[$k] = s($b[$k]);
    if (isset($b['value'])) $fields['value'] = max(0, (int)$b['value']);
    // Admin-only, and the only lead figure settle_sale will pay a commission on.
    if (isset($b['final_price'])) $fields['final_price'] = max(0, (int)$b['final_price']) ?: null;
    if (!$fields) json_err('Nothing to update.', 422);

    $sets = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($fields)));
    $bind = [':id' => $id];
    foreach ($fields as $k => $v) $bind[":$k"] = $v;
    db()->prepare("UPDATE leads SET $sets WHERE id = :id")->execute($bind);

    // Marking a lead 'Won' is the sale event: pay the attributed broker/distributor.
    $settled = false;
    if (($fields['status'] ?? '') === 'Won') {
        settle_sale($id);
        $settled = true;
    }
    json_out(['ok' => true, 'id' => $id, 'updated' => true, 'settled' => $settled]);
}

json_err('Method not allowed.', 405);

function shape_lead(array $r): array {
    return [
        'id' => (int)$r['id'], 'customer' => $r['customer'], 'vehicle' => $r['vehicle'],
        'car_id' => $r['car_id'] !== null ? (int)$r['car_id'] : null,
        'phone' => $r['phone'], 'value' => (int)$r['value'], 'status' => $r['status'],
        'final_price' => isset($r['final_price']) && $r['final_price'] !== null ? (int)$r['final_price'] : null,
        'via_share' => $r['via_share'], 'ref' => $r['ref'], 'note' => $r['note'],
        'date' => substr((string)$r['created_at'], 0, 10),
    ];
}
