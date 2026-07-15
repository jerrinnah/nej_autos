<?php
/* =========================================================================
   NEJ Autos — server-rendered wrapper for the public car page.

   WhatsApp / Facebook / X crawlers do NOT run JavaScript, so the JS-rendered
   car.html shows a bare, image-less link preview. This wrapper looks the car
   up by id, injects Open Graph / Twitter meta (title, description, and the
   car's real photo) into car.html's <head>, then serves the exact same page —
   so humans still get the full interactive experience via car.js.
   ========================================================================= */

require __DIR__ . '/admin/api/_bootstrap.php';

$id = (int)($_GET['id'] ?? 0);

/* Look the car up (Available only). Any failure → generic preview, never an error. */
$car = null;
if ($id > 0) {
    try {
        $st = db()->prepare(
            "SELECT id, make, model, year, price, mileage, body, emoji, photos
             FROM cars WHERE id = :id AND status = 'Available' LIMIT 1"
        );
        $st->execute([':id' => $id]);
        $car = $st->fetch() ?: null;
    } catch (Throwable $e) { $car = null; }
}

/* Absolute base — force https so social crawlers accept the image/url. */
$host = $_SERVER['HTTP_HOST'] ?? 'www.nejautos.com';
$base = 'https://' . $host;

$ref = isset($_GET['ref']) ? preg_replace('/[^A-Za-z0-9\-]/', '', (string)$_GET['ref']) : '';
$pageUrl = $base . '/car?id=' . $id . ($ref !== '' ? '&ref=' . rawurlencode($ref) : '');

if ($car) {
    $name     = trim($car['make'] . ' ' . $car['model']);
    $priceStr = '₦' . number_format((int)$car['price']);
    $ogTitle  = ((int)$car['year'] ? $car['year'] . ' ' : '') . $name . ' — ' . $priceStr;
    $bits = [];
    if (!empty($car['body']))    $bits[] = $car['body'];
    if ((int)$car['mileage'] > 0) $bits[] = number_format((int)$car['mileage']) . ' KM';
    $bits[] = 'Certified & inspected by NEJ Autos.';
    $ogDesc = implode(' · ', $bits);

    $photos = array_values(array_filter(array_map('trim', explode(',', (string)$car['photos']))));
    $ogImage = '';
    if ($photos) {
        $p = $photos[0];
        $ogImage = preg_match('#^https?://#i', $p) ? $p : $base . '/' . ltrim($p, '/');
    }
} else {
    $ogTitle = 'NEJ Autos — Premium certified vehicles';
    $ogDesc  = 'Browse certified, inspected cars from NEJ Autos and share to earn.';
    $ogImage = '';
}

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

/* Build the <head> meta block that replaces car.html's static <title>. */
$meta  = '<title>' . h($ogTitle) . "</title>\n";
$meta .= '  <meta name="description" content="' . h($ogDesc) . "\" />\n";
$meta .= '  <meta property="og:type" content="website" />' . "\n";
$meta .= '  <meta property="og:site_name" content="NEJ Autos" />' . "\n";
$meta .= '  <meta property="og:title" content="' . h($ogTitle) . "\" />\n";
$meta .= '  <meta property="og:description" content="' . h($ogDesc) . "\" />\n";
$meta .= '  <meta property="og:url" content="' . h($pageUrl) . "\" />\n";
if ($ogImage !== '') {
    $meta .= '  <meta property="og:image" content="' . h($ogImage) . "\" />\n";
    $meta .= '  <meta property="og:image:alt" content="' . h($ogTitle) . "\" />\n";
    $meta .= '  <meta name="twitter:card" content="summary_large_image" />' . "\n";
    $meta .= '  <meta name="twitter:image" content="' . h($ogImage) . "\" />\n";
} else {
    $meta .= '  <meta name="twitter:card" content="summary" />' . "\n";
}
$meta .= '  <meta name="twitter:title" content="' . h($ogTitle) . "\" />\n";
$meta .= '  <meta name="twitter:description" content="' . h($ogDesc) . '" />';

/* Serve car.html with the meta injected in place of its <title>. */
$html = @file_get_contents(__DIR__ . '/car.html');
if ($html === false) {
    // car.html unavailable — emit a minimal valid page so the link still previews.
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">\n  $meta\n</head><body><script src=\"car.js\"></script></body></html>";
    exit;
}
$html = preg_replace('#<title>.*?</title>#is', $meta, $html, 1);

header('Content-Type: text/html; charset=utf-8');
echo $html;
