<?php
/* =========================================================================
   NEJ Autos Admin API — shares (share-to-earn activity)
     GET    shares.php               → list recent shares
     POST   shares.php               → record a share (public — from car page)
     POST   shares.php?id=N&_delete=1→ delete  (admin)  [DELETE accepted]
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$id = (int)param('id', 0);
$PLATFORMS = ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'copy', 'other'];

/* ---- public: record a share event ---- */
if (method() === 'POST' && (string)param('_delete', '') !== '1') {
    $b = input();
    $platform = strtolower(s($b['platform'] ?? 'other'));
    if (!in_array($platform, $PLATFORMS, true)) $platform = 'other';
    db()->prepare(
        'INSERT INTO shares (partner_id, car_id, vehicle, platform, ref)
         VALUES (:pid, :cid, :veh, :plat, :ref)'
    )->execute([
        ':pid'  => (int)($b['partner_id'] ?? 0) ?: null,
        ':cid'  => (int)($b['car_id'] ?? 0) ?: null,
        ':veh'  => s($b['vehicle'] ?? ''),
        ':plat' => $platform,
        ':ref'  => s($b['ref'] ?? '') ?: null,
    ]);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true], 201);
}

/* ---- admin below ---- */
require_admin();

if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Share id is required.', 422);
    db()->prepare('DELETE FROM shares WHERE id = :id')->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

if (method() === 'GET') {
    $rows = db()->query(
        'SELECT s.*, p.name AS partner_name FROM shares s
         LEFT JOIN partners p ON p.id = s.partner_id
         ORDER BY s.created_at DESC LIMIT 200')->fetchAll();
    json_out(['ok' => true, 'shares' => array_map(function ($r) {
        return [
            'id' => (int)$r['id'], 'partner_id' => $r['partner_id'] !== null ? (int)$r['partner_id'] : null,
            'partner_name' => $r['partner_name'] ?? null, 'car_id' => $r['car_id'] !== null ? (int)$r['car_id'] : null,
            'vehicle' => $r['vehicle'], 'platform' => $r['platform'], 'ref' => $r['ref'],
            'date' => substr((string)$r['created_at'], 0, 10),
        ];
    }, $rows)]);
}

json_err('Method not allowed.', 405);
