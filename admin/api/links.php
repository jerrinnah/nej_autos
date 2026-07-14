<?php
/* =========================================================================
   NEJ Autos — tracked share links (broker / distributor)
     GET   links.php            → my links + click stats
     GET   links.php?id=N       → one link + recent clicks
     POST  links.php            → create a tracked link { car_id }
   A link is unique per (user, car): creating one that exists returns it.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
$user = require_user();

$id = (int)param('id', 0);

/* ------------------------------- create --------------------------------- */
if (method() === 'POST') {
    $carId = (int)param('car_id', 0);
    if ($carId <= 0) json_err('A car is required.', 422);

    $cs = db()->prepare("SELECT * FROM cars WHERE id = :id");
    $cs->execute([':id' => $carId]);
    $car = $cs->fetch();
    if (!$car) json_err('Car not found.', 404);

    // reuse an existing link for this (user, car)
    $ex = db()->prepare('SELECT * FROM tracked_links WHERE user_id=:u AND car_id=:c LIMIT 1');
    $ex->execute([':u' => $user['id'], ':c' => $carId]);
    if ($row = $ex->fetch()) json_out(['ok' => true, 'link' => shape_link($row), 'existing' => true]);

    $dest = car_dest_url($car, $user['referral_code'], $user['name']);
    $slug = make_slug();
    db()->prepare(
        'INSERT INTO tracked_links (user_id,car_id,slug,dest) VALUES (:u,:c,:s,:d)'
    )->execute([':u' => $user['id'], ':c' => $carId, ':s' => $slug, ':d' => $dest]);

    $lid = (int)db()->lastInsertId();
    $st = db()->prepare('SELECT * FROM tracked_links WHERE id = :id');
    $st->execute([':id' => $lid]);
    json_out(['ok' => true, 'link' => shape_link($st->fetch()), 'created' => true], 201);
}

/* -------------------------------- read ---------------------------------- */
if (method() === 'GET' && $id > 0) {
    $st = db()->prepare('SELECT * FROM tracked_links WHERE id=:id AND user_id=:u');
    $st->execute([':id' => $id, ':u' => $user['id']]);
    $row = $st->fetch();
    if (!$row) json_err('Link not found.', 404);
    // recent clicks
    $cl = db()->prepare('SELECT is_unique, referer, created_at FROM link_clicks WHERE link_id=:l ORDER BY id DESC LIMIT 50');
    $cl->execute([':l' => $id]);
    json_out(['ok' => true, 'link' => shape_link($row), 'clicks' => $cl->fetchAll()]);
}

if (method() === 'GET') {
    $st = db()->prepare(
        'SELECT tl.*, c.make, c.model, c.year, c.price, c.emoji, c.status AS car_status
         FROM tracked_links tl JOIN cars c ON c.id = tl.car_id
         WHERE tl.user_id = :u ORDER BY tl.created_at DESC');
    $st->execute([':u' => $user['id']]);
    json_out(['ok' => true, 'links' => array_map('shape_link', $st->fetchAll())]);
}

json_err('Method not allowed.', 405);

/* ------------------------------- helpers -------------------------------- */
function shape_link(array $r): array {
    $out = [
        'id' => (int)$r['id'], 'slug' => $r['slug'], 'car_id' => (int)$r['car_id'],
        'clicks' => (int)$r['clicks'], 'uniques' => (int)$r['uniques'],
        'short_url' => site_base() . '/l/' . $r['slug'],
        'dest' => $r['dest'], 'created_at' => substr((string)$r['created_at'], 0, 10),
    ];
    foreach (['make','model','year','price','emoji','car_status'] as $k) if (isset($r[$k])) $out[$k] = $r[$k];
    return $out;
}
function make_slug(): string {
    $alphabet = 'abcdefghijklmnopqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($tries = 0; $tries < 40; $tries++) {
        $s = '';
        for ($i = 0; $i < 7; $i++) $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $st = db()->prepare('SELECT 1 FROM tracked_links WHERE slug = :s');
        $st->execute([':s' => $s]);
        if (!$st->fetch()) return $s;
    }
    return substr(bin2hex(random_bytes(6)), 0, 10);
}
