<?php
/* =========================================================================
   NEJ Autos Admin API — shared bootstrap
   PDO connection, JSON helpers, session, and the auth guard.
   Every endpoint starts with:  require __DIR__ . '/_bootstrap.php';
   ========================================================================= */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');           // never leak errors to the client
mb_internal_encoding('UTF-8');

/* ------------------------------- config --------------------------------- */
$__cfgPath = dirname(__DIR__) . '/config.php';
if (!is_file($__cfgPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'not_configured',
        'message' => 'admin/config.php is missing. Copy config.sample.php to config.php and fill in your database credentials.']);
    exit;
}
$CONFIG = require $__cfgPath;

/* ---------------------------- JSON helpers ------------------------------ */
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function json_err(string $msg, int $code = 400, array $extra = []): void {
    json_out(array_merge(['error' => true, 'message' => $msg], $extra), $code);
}

/** Body params for JSON or form posts. */
function input(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = file_get_contents('php://input');
    $ct  = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false && $raw !== '') {
        $d = json_decode($raw, true);
        $cache = is_array($d) ? $d : [];
    } else {
        $cache = $_POST ?: [];
    }
    return $cache;
}

function method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }
function param(string $k, $default = null) {
    if (array_key_exists($k, $_GET)) return $_GET[$k];
    $b = input();
    return array_key_exists($k, $b) ? $b[$k] : $default;
}

/* ------------------------------- database ------------------------------- */
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    global $CONFIG;
    $dsn = "mysql:host={$CONFIG['db_host']};dbname={$CONFIG['db_name']};charset={$CONFIG['db_charset']}";
    try {
        $pdo = new PDO($dsn, $CONFIG['db_user'], $CONFIG['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        json_err('Database connection failed. Check credentials in admin/config.php.', 500);
    }
    return $pdo;
}

/* ------------------------------- session -------------------------------- */
function start_session(): void {
    global $CONFIG;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name($CONFIG['session_name'] ?? 'nej_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => (bool)($CONFIG['cookie_secure'] ?? true),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function current_admin(): ?array {
    start_session();
    if (empty($_SESSION['admin_id'])) return null;
    return [
        'id'   => (int)$_SESSION['admin_id'],
        'name' => $_SESSION['admin_name'] ?? 'Administrator',
        'username' => $_SESSION['admin_user'] ?? '',
    ];
}

/**
 * Require a logged-in admin. Also enforces a same-origin check on any
 * state-changing request so a third-party site cannot ride the session cookie.
 */
function require_admin(): array {
    $a = current_admin();
    if (!$a) json_err('Not authenticated.', 401);
    if (method() !== 'GET') {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $host   = $_SERVER['HTTP_HOST'] ?? '';
        if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
            json_err('Cross-origin request blocked.', 403);
        }
    }
    return $a;
}

/* ------------------------------ misc utils ------------------------------ */
function clampInt($v, int $min, int $max, int $def = 0): int {
    if ($v === null || $v === '') return $def;
    $n = (int)$v;
    return max($min, min($max, $n));
}
function s($v): string { return trim((string)($v ?? '')); }

/* ==========================================================================
   Portal users (broker / distributor) — separate session from admins.
   ========================================================================== */
function start_user_session(): void {
    global $CONFIG;
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name(($CONFIG['session_name'] ?? 'nej_admin') . '_user');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/',
        'secure'   => (bool)($CONFIG['cookie_secure'] ?? true),
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

function current_user(): ?array {
    start_user_session();
    if (empty($_SESSION['uid'])) return null;
    // Re-read status each request so a suspended user is kicked immediately.
    $st = db()->prepare('SELECT id,name,email,role,status,referral_code,commission_pct FROM users WHERE id = :id');
    $st->execute([':id' => (int)$_SESSION['uid']]);
    $u = $st->fetch();
    if (!$u || $u['status'] !== 'Active') return null;
    return $u;
}

function require_user(?string $role = null): array {
    $u = current_user();
    if (!$u) json_err('Please sign in.', 401);
    if ($role && $u['role'] !== $role) json_err('Not allowed for your account type.', 403);
    if (method() !== 'GET') {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? ''; $host = $_SERVER['HTTP_HOST'] ?? '';
        if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) json_err('Cross-origin request blocked.', 403);
    }
    return $u;
}

/* ------------------------------- settings ------------------------------- */
function get_settings(): array {
    static $c = null;
    if ($c !== null) return $c;
    $c = [];
    try { foreach (db()->query('SELECT k,v FROM settings')->fetchAll() as $r) $c[$r['k']] = $r['v']; }
    catch (Throwable $e) { $c = []; }
    return $c;
}
function setting(string $k, $default = null) {
    $all = get_settings();
    return array_key_exists($k, $all) ? $all[$k] : $default;
}
function set_setting(string $k, string $v): void {
    db()->prepare('INSERT INTO settings (k,v) VALUES (:k,:v) ON DUPLICATE KEY UPDATE v = VALUES(v)')
        ->execute([':k' => $k, ':v' => $v]);
}

/* ----------------------------- site helpers ----------------------------- */
function site_base(): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') == 443);
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}
function iso_week(): string { return date('o') . '-W' . date('W'); }

/** Build the public /car detail URL (clean, absolute) with attribution. */
function car_dest_url(array $car, string $ref = '', string $by = 'NEJ Autos'): string {
    $base = site_base();
    $p = [
        'id' => 'veh-' . $car['id'], 'mk' => $car['make'], 'mo' => $car['model'],
        'yr' => $car['year'], 'pr' => $car['price'], 'em' => $car['emoji'],
        'bd' => $car['body'], 'mi' => $car['mileage'], 'bg' => $car['bg'], 'by' => $by,
    ];
    if (!empty($car['is_ev']))       $p['ev'] = '1';
    if (!empty($car['target_bonus'])) $p['bn'] = '1';
    if ($ref !== '') $p['ref'] = $ref;
    $photos = array_values(array_filter(array_map('trim', explode(',', (string)($car['photos'] ?? '')))));
    if ($photos) {
        $abs = array_map(fn($u) => preg_match('#^https?://#i', $u) ? $u : $base . '/' . ltrim($u, '/'), $photos);
        $p['imgs'] = implode(',', $abs);
    }
    return $base . '/car?' . http_build_query($p);
}

/* ==========================================================================
   Sale settlement — runs when a lead becomes 'Won'. Idempotent per lead.
   Broker  → commission = sale value × rate.
   Distributor → sale bonus + unlock that car's pending click points.
   ========================================================================== */
function settle_sale(int $leadId): void {
    if ($leadId <= 0) return;
    $pdo = db();

    $st = $pdo->prepare('SELECT * FROM leads WHERE id = :id');
    $st->execute([':id' => $leadId]);
    $lead = $st->fetch();
    if (!$lead || $lead['status'] !== 'Won') return;

    $ref = s($lead['ref'] ?? '');
    if ($ref === '') return;                         // unattributed / direct sale

    // Idempotency: already settled?
    $ex = $pdo->prepare('SELECT COUNT(*) FROM ledger WHERE lead_id = :lid');
    $ex->execute([':lid' => $leadId]);
    if ((int)$ex->fetchColumn() > 0) return;

    $us = $pdo->prepare('SELECT * FROM users WHERE referral_code = :c LIMIT 1');
    $us->execute([':c' => $ref]);
    $user = $us->fetch();
    if (!$user) return;

    $carId = (int)($lead['car_id'] ?? 0) ?: null;
    $value = (int)($lead['value'] ?? 0);
    $week  = iso_week();

    if ($user['role'] === 'broker') {
        $rate = $user['commission_pct'] !== null
            ? (float)$user['commission_pct']
            : (float)setting('broker_rate_pct', '12');
        $amount = (int)round($value * $rate / 100);
        $pdo->prepare(
            'INSERT INTO ledger (user_id,type,amount,status,car_id,lead_id,week,note)
             VALUES (:u,\'sale_commission\',:a,\'available\',:c,:l,:w,:n)'
        )->execute([':u' => $user['id'], ':a' => $amount, ':c' => $carId, ':l' => $leadId, ':w' => $week,
                    ':n' => 'Commission ' . rtrim(rtrim(number_format($rate, 2), '0'), '.') . '% on ' . $lead['vehicle']]);
    } else { // distributor
        $bonus = (int)setting('distributor_sale_bonus_ngn', '25000');
        $pdo->prepare(
            'INSERT INTO ledger (user_id,type,amount,status,car_id,lead_id,week,note)
             VALUES (:u,\'sale_bonus\',:a,\'available\',:c,:l,:w,:n)'
        )->execute([':u' => $user['id'], ':a' => $bonus, ':c' => $carId, ':l' => $leadId, ':w' => $week,
                    ':n' => 'Sale bonus — ' . $lead['vehicle']]);

        // Unlock pending click points earned on this car's links → withdrawable.
        if ($carId) {
            $pdo->prepare(
                "UPDATE ledger SET status='available'
                 WHERE user_id=:u AND car_id=:c AND type='click_points' AND status='pending'"
            )->execute([':u' => $user['id'], ':c' => $carId]);
        }
    }
}

/** Balance summary for a user: available (withdrawable), pending, points. */
function user_balance(int $userId): array {
    $pdo = db();
    $q = $pdo->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN status='available' THEN amount END),0) AS avail,
            COALESCE(SUM(CASE WHEN status='pending'   THEN amount END),0) AS pending,
            COALESCE(SUM(points),0) AS points
         FROM ledger WHERE user_id = :u");
    $q->execute([':u' => $userId]);
    $r = $q->fetch();
    $w = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM withdrawals
                        WHERE user_id=:u AND status IN ('Requested','Approved','Paid')");
    $w->execute([':u' => $userId]);
    $reserved = (int)$w->fetchColumn();
    return [
        'available'   => (int)$r['avail'],
        'pending'     => (int)$r['pending'],
        'points'      => (int)$r['points'],
        'reserved'    => $reserved,
        'withdrawable'=> max(0, (int)$r['avail'] - $reserved),
    ];
}
