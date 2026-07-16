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

/* ---- record a share event ----
   Public (marketing site) shares are logged for analytics only. When a portal
   user is signed in, the share is attributed to them and — up to a daily cap,
   once per car per day — "counts" and earns a PENDING reward that unlocks when
   a car they shared sells (see settle_sale). Everything is logged either way. */
if (method() === 'POST' && (string)param('_delete', '') !== '1') {
    $b = input();
    $platform = strtolower(s($b['platform'] ?? 'other'));
    if (!in_array($platform, $PLATFORMS, true)) $platform = 'other';

    $carId   = (int)($b['car_id'] ?? 0) ?: null;
    $linkId  = (int)($b['link_id'] ?? 0) ?: null;
    $vehicle = s($b['vehicle'] ?? '');

    $user    = current_user();          // null for public / marketing-site shares
    $userId  = null;
    $ref     = null;
    $counted = 0;

    if ($user) {
        // Same-origin guard: block a third-party page from spending the session.
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $host   = $_SERVER['HTTP_HOST'] ?? '';
        if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
            json_err('Cross-origin request blocked.', 403);
        }

        $userId = (int)$user['id'];
        $ref    = $user['referral_code'];

        // A supplied link must belong to this user; adopt its car for accuracy.
        if ($linkId) {
            $lk = db()->prepare('SELECT car_id FROM tracked_links WHERE id=:l AND user_id=:u LIMIT 1');
            $lk->execute([':l' => $linkId, ':u' => $userId]);
            $row = $lk->fetch();
            if ($row) $carId = (int)$row['car_id']; else $linkId = null;
        }

        // Counts up to N/day, and at most once per car per day.
        $cap = (int)setting('max_counted_shares_per_day', '2');
        $todayCounted = (int)db()->query(
            "SELECT COUNT(*) FROM shares WHERE user_id=$userId AND counted=1 AND DATE(created_at)=CURDATE()"
        )->fetchColumn();
        $carDup = 0;
        if ($carId) {
            $cd = db()->prepare("SELECT COUNT(*) FROM shares
                                 WHERE user_id=:u AND car_id=:c AND counted=1 AND DATE(created_at)=CURDATE()");
            $cd->execute([':u' => $userId, ':c' => $carId]);
            $carDup = (int)$cd->fetchColumn();
        }
        if ($todayCounted < $cap && $carDup === 0) $counted = 1;
    } else {
        $ref = s($b['ref'] ?? '') ?: null;
    }

    db()->prepare(
        'INSERT INTO shares (partner_id, user_id, car_id, link_id, vehicle, platform, ref, counted)
         VALUES (:pid, :uid, :cid, :lid, :veh, :plat, :ref, :cnt)'
    )->execute([
        ':pid'  => (int)($b['partner_id'] ?? 0) ?: null,
        ':uid'  => $userId,
        ':cid'  => $carId,
        ':lid'  => $linkId,
        ':veh'  => $vehicle,
        ':plat' => $platform,
        ':ref'  => $ref,
        ':cnt'  => $counted,
    ]);
    $shareId = (int)db()->lastInsertId();

    if ($user && $counted) {
        $reward = (int)setting('share_reward_ngn', '800');
        if ($reward > 0) {
            db()->prepare(
                "INSERT INTO ledger (user_id,type,amount,status,car_id,link_id,week,note)
                 VALUES (:u,'share_reward',:a,'pending',:c,:l,:w,:n)"
            )->execute([':u' => $userId, ':a' => $reward, ':c' => $carId, ':l' => $linkId,
                        ':w' => iso_week(), ':n' => 'Share reward — ' . ($vehicle ?: 'car')]);
        }
    }

    json_out(['ok' => true, 'id' => $shareId, 'counted' => (bool)$counted, 'created' => true], 201);
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
