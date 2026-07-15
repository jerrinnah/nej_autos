<?php
/* =========================================================================
   NEJ Autos Admin API — cars (inventory)
     GET    cars.php               → list all (admin)
     GET    cars.php?public=1      → list Available cars (no auth) for the site
     GET    cars.php?id=N          → one car
     POST   cars.php               → create   (JSON body)
     POST   cars.php?id=N          → update   (JSON body)  [PUT also accepted]
     POST   cars.php?id=N&_delete=1→ delete   [DELETE also accepted]
     POST   cars.php?upload=1      → multipart photo upload → { urls: [...] }
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$id = (int)param('id', 0);

/* ---- public read: the live site / car pages can consume this openly ---- */
if (method() === 'GET' && (string)param('public', '') === '1') {
    $cols = "id, make, model, year, price, mileage, body, emoji, bg, is_ev, is_premium,
             target_bonus, cond_score, inspection, status, photos";
    // Single car by id (used by the shareable car page: /car?id=N) — Available only.
    if ($id > 0) {
        $st = db()->prepare("SELECT $cols FROM cars WHERE id = :id AND status = 'Available'");
        $st->execute([':id' => $id]);
        $row = $st->fetch();
        if (!$row) json_err('Car not available.', 404);
        json_out(['ok' => true, 'car' => shape_car($row)]);
    }
    $rows = db()->query(
        "SELECT $cols FROM cars WHERE status = 'Available' ORDER BY updated_at DESC")->fetchAll();
    json_out(['ok' => true, 'cars' => array_map('shape_car', $rows)]);
}

/* ------------- everything below requires an authenticated admin --------- */
require_admin();

/* ---- photo upload ---- */
if (method() === 'POST' && (string)param('upload', '') === '1') {
    handle_upload();
}

/* ---- delete ---- */
if (method() === 'DELETE' || (method() === 'POST' && (string)param('_delete', '') === '1')) {
    if ($id <= 0) json_err('Car id is required.', 422);
    $st = db()->prepare('DELETE FROM cars WHERE id = :id');
    $st->execute([':id' => $id]);
    json_out(['ok' => true, 'deleted' => $id]);
}

/* ---- read ---- */
if (method() === 'GET') {
    if ($id > 0) {
        $st = db()->prepare('SELECT * FROM cars WHERE id = :id');
        $st->execute([':id' => $id]);
        $row = $st->fetch();
        if (!$row) json_err('Car not found.', 404);
        json_out(['ok' => true, 'car' => shape_car($row)]);
    }
    $rows = db()->query('SELECT * FROM cars ORDER BY updated_at DESC')->fetchAll();
    json_out(['ok' => true, 'cars' => array_map('shape_car', $rows)]);
}

/* ---- create / update ---- */
if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $fields = [
        'make'         => s($b['make'] ?? ''),
        'model'        => s($b['model'] ?? ''),
        'year'         => clampInt($b['year'] ?? 2024, 1980, 2100, 2024),
        'price'        => max(0, (int)($b['price'] ?? 0)),
        'mileage'      => max(0, (int)($b['mileage'] ?? 0)),
        'body'         => s($b['body'] ?? 'Vehicle') ?: 'Vehicle',
        'emoji'        => mb_substr(s($b['emoji'] ?? '🚗') ?: '🚗', 0, 6),
        'bg'           => clampInt($b['bg'] ?? 0, 0, 5, 0),
        'is_ev'        => !empty($b['is_ev']) ? 1 : 0,
        'is_premium'   => !empty($b['is_premium']) ? 1 : 0,
        'target_bonus' => !empty($b['target_bonus']) ? 1 : 0,
        'cond_score'   => clampInt($b['cond_score'] ?? 5, 0, 5, 5),
        'inspection'   => s($b['inspection'] ?? 'Certified') ?: 'Certified',
        'status'       => allowed(s($b['status'] ?? 'Available'), ['Available','Reserved','Sold','Draft'], 'Available'),
        'photos'       => clean_photos($b['photos'] ?? ''),
    ];
    if ($fields['make'] === '' || $fields['model'] === '') {
        json_err('Make and model are required.', 422);
    }

    // named params keyed as :field
    $bind = [];
    foreach ($fields as $k => $v) $bind[":$k"] = $v;

    if ($id > 0) {
        $sets = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($fields)));
        $bind[':id'] = $id;
        db()->prepare("UPDATE cars SET $sets WHERE id = :id")->execute($bind);
        json_out(['ok' => true, 'id' => $id, 'updated' => true]);
    } else {
        $cols = implode(', ', array_keys($fields));
        $ph   = implode(', ', array_map(fn($k) => ":$k", array_keys($fields)));
        db()->prepare("INSERT INTO cars ($cols) VALUES ($ph)")->execute($bind);
        json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true]);
    }
}

json_err('Method not allowed.', 405);


/* ------------------------------- helpers -------------------------------- */
function shape_car(array $r): array {
    return [
        'id'          => (int)$r['id'],
        'make'        => $r['make'],
        'model'       => $r['model'],
        'year'        => (int)$r['year'],
        'price'       => (int)$r['price'],
        'mileage'     => (int)$r['mileage'],
        'body'        => $r['body'],
        'emoji'       => $r['emoji'],
        'bg'          => (int)$r['bg'],
        'is_ev'       => (bool)$r['is_ev'],
        'is_premium'  => (bool)$r['is_premium'],
        'target_bonus'=> (bool)$r['target_bonus'],
        'cond_score'  => (int)$r['cond_score'],
        'inspection'  => $r['inspection'],
        'status'      => $r['status'],
        'photos'      => array_values(array_filter(array_map('trim', explode(',', (string)($r['photos'] ?? ''))))),
    ];
}

function allowed(string $v, array $set, string $def): string {
    return in_array($v, $set, true) ? $v : $def;
}

/** Accepts an array or comma string of URLs; keeps http(s) or site-relative paths. */
function clean_photos($v): string {
    $list = is_array($v) ? $v : explode(',', (string)$v);
    $out = [];
    foreach ($list as $u) {
        $u = trim((string)$u);
        if ($u === '') continue;
        if (preg_match('#^(https?://|/|uploads/)#i', $u)) $out[] = $u;
    }
    return implode(',', array_slice($out, 0, 12));
}

function handle_upload(): void {
    global $CONFIG;
    if (empty($_FILES['photos'])) json_err('No files received under field "photos".', 422);

    $base = dirname(__DIR__);
    $rel  = trim($CONFIG['upload_dir'] ?? 'uploads', '/') . '/cars';
    $dir  = $base . '/' . $rel;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        json_err('Upload folder is not writable: /admin/' . $rel, 500);
    }

    $maxBytes = (int)($CONFIG['max_upload_mb'] ?? 6) * 1024 * 1024;
    $allowed  = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    // normalise single vs. multiple file inputs
    $files = $_FILES['photos'];
    $names = (array)$files['name'];
    $tmps  = (array)$files['tmp_name'];
    $errs  = (array)$files['error'];
    $sizes = (array)$files['size'];

    $urls = [];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    for ($i = 0; $i < count($names); $i++) {
        if (($errs[$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
        if (($sizes[$i] ?? 0) > $maxBytes) json_err('A file exceeds the ' . ($CONFIG['max_upload_mb'] ?? 6) . 'MB limit.', 413);
        if (!is_uploaded_file($tmps[$i])) continue;
        $mime = $finfo->file($tmps[$i]);
        if (!isset($allowed[$mime])) json_err('Only JPG, PNG, WEBP or GIF images are allowed.', 415);
        $ext  = $allowed[$mime];
        $name = 'car_' . bin2hex(random_bytes(8)) . '.' . $ext;
        if (!move_uploaded_file($tmps[$i], $dir . '/' . $name)) json_err('Failed to save an upload.', 500);
        $urls[] = '/admin/' . $rel . '/' . $name;   // site-absolute, works from any page
    }
    if (!$urls) json_err('No valid images were uploaded.', 422);
    json_out(['ok' => true, 'urls' => $urls]);
}
