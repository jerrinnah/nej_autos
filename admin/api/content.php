<?php
/* =========================================================================
   NEJ Autos Admin API — website content (CMS)

     GET  content.php?public=1        → blocks + ACTIVE slides (no auth, for the site)
     GET  content.php                 → blocks + ALL slides + defaults (admin)
     POST content.php?block=<key>     → save one content block  (JSON body)
     POST content.php?block=<key>&reset=1 → restore that block to its default
     POST content.php?slide=1         → create a slide          (JSON body)
     POST content.php?slide=1&id=N    → update a slide
     POST content.php?slide=1&id=N&_delete=1 → delete a slide
     POST content.php?reorder=1       → { ids: [...] } → new slide order
     POST content.php?upload=1        → multipart field "image" → { url }

   Blocks are validated against admin/api/_content_defaults.php: any key the
   defaults don't declare is dropped, so the stored JSON can never grow a
   shape the public page doesn't expect.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

const CMS_MAX_SCALAR = 2000;   // chars in a single text field
const CMS_MAX_ROWS   = 12;     // rows in a repeatable list
const CMS_MAX_CELL   = 800;    // chars in one field of a list row
const CMS_MAX_SLIDES = 12;

$DEFAULTS = require __DIR__ . '/_content_defaults.php';
$id = (int)param('id', 0);

/* ======================= public read (no auth) =========================== */
if (method() === 'GET' && (string)param('public', '') === '1') {
    json_out([
        'ok'          => true,
        'content'     => content_all($DEFAULTS),
        'slides'      => slides_all(true),
        'autoplay_ms' => (int)setting('hero_autoplay_ms', '6000'),
    ]);
}

/* ------------- everything below requires an authenticated admin --------- */
require_admin();

/* ---- slide image upload ---- */
if (method() === 'POST' && (string)param('upload', '') === '1') {
    json_out(['ok' => true, 'url' => handle_slide_upload()]);
}

/* ---- slide reorder ---- */
if (method() === 'POST' && (string)param('reorder', '') === '1') {
    $ids = param('ids', []);
    if (!is_array($ids)) json_err('ids must be an array of slide ids.', 422);
    $st = db()->prepare('UPDATE slides SET sort = :s WHERE id = :id');
    foreach (array_values($ids) as $i => $sid) {
        if ((int)$sid > 0) $st->execute([':s' => $i, ':id' => (int)$sid]);
    }
    json_out(['ok' => true, 'slides' => slides_all(false)]);
}

/* ---- slide delete / create / update ---- */
if (method() === 'POST' && (string)param('slide', '') === '1') {
    if ((string)param('_delete', '') === '1') {
        if ($id <= 0) json_err('Slide id is required.', 422);
        db()->prepare('DELETE FROM slides WHERE id = :id')->execute([':id' => $id]);
        json_out(['ok' => true, 'deleted' => $id]);
    }

    $b = input();
    $f = [
        'image'     => cms_image_url(s($b['image'] ?? '')),
        'title'     => mb_substr(s($b['title'] ?? ''), 0, 160),
        'subtitle'  => mb_substr(s($b['subtitle'] ?? ''), 0, 400),
        'cta_label' => mb_substr(s($b['cta_label'] ?? ''), 0, 60),
        'cta_href'  => cms_url(s($b['cta_href'] ?? '')),
        'align'     => in_array(s($b['align'] ?? 'left'), ['left', 'center'], true) ? s($b['align']) : 'left',
        'overlay'   => clampInt($b['overlay'] ?? 55, 0, 90, 55),
        'active'    => !empty($b['active']) ? 1 : 0,
    ];
    if ($f['title'] === '' && $f['image'] === '') {
        json_err('A slide needs at least an image or a headline.', 422);
    }

    $bind = [];
    foreach ($f as $k => $v) $bind[":$k"] = $v;

    if ($id > 0) {
        $sets = implode(', ', array_map(fn($k) => "`$k` = :$k", array_keys($f)));
        $bind[':id'] = $id;
        db()->prepare("UPDATE slides SET $sets WHERE id = :id")->execute($bind);
        json_out(['ok' => true, 'id' => $id, 'updated' => true]);
    }

    $n = (int)db()->query('SELECT COUNT(*) FROM slides')->fetchColumn();
    if ($n >= CMS_MAX_SLIDES) json_err('You can have at most ' . CMS_MAX_SLIDES . ' slides.', 422);

    $f['sort'] = (int)db()->query('SELECT COALESCE(MAX(sort), -1) + 1 FROM slides')->fetchColumn();
    $bind[':sort'] = $f['sort'];
    $cols = implode(', ', array_map(fn($k) => "`$k`", array_keys($f)));
    $ph   = implode(', ', array_map(fn($k) => ":$k", array_keys($f)));
    db()->prepare("INSERT INTO slides ($cols) VALUES ($ph)")->execute($bind);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'created' => true]);
}

/* ---- save / reset one content block ---- */
if (method() === 'POST' || method() === 'PUT') {
    $key = s(param('block', ''));
    if ($key === '' || !isset($DEFAULTS[$key])) json_err('Unknown content block.', 422);

    if ((string)param('reset', '') === '1') {
        db()->prepare('DELETE FROM site_content WHERE k = :k')->execute([':k' => $key]);
        json_out(['ok' => true, 'block' => $key, 'reset' => true, 'value' => $DEFAULTS[$key]]);
    }

    $clean = cms_sanitize($DEFAULTS[$key], input());
    db()->prepare('INSERT INTO site_content (k, v) VALUES (:k, :v) ON DUPLICATE KEY UPDATE v = VALUES(v)')
        ->execute([':k' => $key, ':v' => json_encode($clean, JSON_UNESCAPED_UNICODE)]);
    json_out(['ok' => true, 'block' => $key, 'saved' => true, 'value' => $clean]);
}

/* ---- admin read ---- */
if (method() === 'GET') {
    // Unlike the public branch this fails loudly when the tables are missing,
    // so the admin screen can offer to run the migration instead of showing an
    // editor whose saves would all fail.
    try { db()->query('SELECT 1 FROM site_content LIMIT 1'); }
    catch (Throwable $e) { json_err('Website content tables are missing. Run the migration.', 500); }
    json_out([
        'ok'       => true,
        'content'  => content_all($DEFAULTS),
        'slides'   => slides_all(false),
        'defaults' => $DEFAULTS,
    ]);
}

json_err('Method not allowed.', 405);


/* ------------------------------- helpers -------------------------------- */

/** Stored blocks merged over the defaults, so new default keys always appear. */
function content_all(array $defaults): array {
    $stored = [];
    try {
        foreach (db()->query('SELECT k, v FROM site_content')->fetchAll() as $r) {
            $d = json_decode((string)$r['v'], true);
            if (is_array($d)) $stored[$r['k']] = $d;
        }
    } catch (Throwable $e) {
        $stored = [];                       // not migrated yet — defaults only
    }
    $out = [];
    foreach ($defaults as $k => $def) {
        $out[$k] = isset($stored[$k]) ? array_merge($def, $stored[$k]) : $def;
    }
    return $out;
}

/** @param bool $activeOnly true for the public site, false for the admin list. */
function slides_all(bool $activeOnly): array {
    try {
        $sql = 'SELECT id, image, title, subtitle, cta_label, cta_href, align, overlay, active, sort
                FROM slides ' . ($activeOnly ? 'WHERE active = 1 ' : '') . 'ORDER BY sort ASC, id ASC';
        $rows = db()->query($sql)->fetchAll();
    } catch (Throwable $e) {
        return [];                          // not migrated yet — no slider
    }
    return array_map(fn($r) => [
        'id'        => (int)$r['id'],
        'image'     => $r['image'],
        'title'     => $r['title'],
        'subtitle'  => $r['subtitle'],
        'cta_label' => $r['cta_label'],
        'cta_href'  => $r['cta_href'],
        'align'     => $r['align'],
        'overlay'   => (int)$r['overlay'],
        'active'    => (bool)$r['active'],
        'sort'      => (int)$r['sort'],
    ], $rows);
}

/**
 * Shape the submitted block against its default. Keys the default doesn't
 * declare are dropped; ints stay ints; lists are capped and their rows are
 * reduced to the fields the default row declares.
 */
function cms_sanitize(array $default, array $sent): array {
    $out = [];
    foreach ($default as $k => $def) {
        if (!array_key_exists($k, $sent)) { $out[$k] = $def; continue; }
        $v = $sent[$k];

        // repeatable list of rows
        if (is_array($def) && isset($def[0]) && is_array($def[0])) {
            $tpl  = $def[0];
            $rows = is_array($v) ? array_slice(array_values($v), 0, CMS_MAX_ROWS) : [];
            $list = [];
            foreach ($rows as $row) {
                if (!is_array($row)) continue;
                $one = [];
                foreach ($tpl as $ck => $cdef) {
                    $cv = $row[$ck] ?? $cdef;
                    $one[$ck] = is_int($cdef) ? (int)$cv : mb_substr(trim((string)$cv), 0, CMS_MAX_CELL);
                }
                $list[] = $one;
            }
            $out[$k] = $list;
            continue;
        }

        $out[$k] = is_int($def) ? (int)$v : mb_substr(trim((string)$v), 0, CMS_MAX_SCALAR);
    }
    return $out;
}

/** Keep http(s), site-relative, in-page anchors and mailto/tel — nothing else. */
function cms_url(string $u): string {
    if ($u === '') return '';
    return preg_match('#^(https?://|/|\#|mailto:|tel:|[A-Za-z0-9._~-]+(/|\?|\#|$))#', $u)
        ? mb_substr($u, 0, 255) : '';
}

/**
 * Slide images are interpolated into a CSS  url('…')  on the homepage, so they
 * are held to a tighter shape than a link: no quotes, parentheses, angle
 * brackets, backslashes or whitespace can survive this.
 */
function cms_image_url(string $u): string {
    if ($u === '') return '';
    return preg_match('#^(/|https?://)[A-Za-z0-9._~:/?\#\[\]@!$&*+,;=%-]+$#', $u)
        ? mb_substr($u, 0, 255) : '';
}

/** Single-image upload for a slide. Mirrors the car photo upload rules. */
function handle_slide_upload(): string {
    global $CONFIG;
    if (empty($_FILES['image'])) json_err('No file received under field "image".', 422);

    $rel = trim($CONFIG['upload_dir'] ?? 'uploads', '/') . '/site';
    $dir = dirname(__DIR__) . '/' . $rel;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        json_err('Upload folder is not writable: /admin/' . $rel, 500);
    }

    $file = $_FILES['image'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) json_err('Upload failed.', 422);
    $maxBytes = (int)($CONFIG['max_upload_mb'] ?? 6) * 1024 * 1024;
    if (($file['size'] ?? 0) > $maxBytes) {
        json_err('The file exceeds the ' . ($CONFIG['max_upload_mb'] ?? 6) . 'MB limit.', 413);
    }
    if (!is_uploaded_file($file['tmp_name'])) json_err('Upload failed.', 422);

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($allowed[$mime])) json_err('Only JPG, PNG, WEBP or GIF images are allowed.', 415);

    $name = 'site_' . bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) json_err('Failed to save the upload.', 500);
    return '/admin/' . $rel . '/' . $name;
}
