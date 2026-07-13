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
