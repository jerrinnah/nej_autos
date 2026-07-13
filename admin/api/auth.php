<?php
/* =========================================================================
   NEJ Autos Admin API — authentication
     GET   auth.php            → current session { admin } or 401
     POST  auth.php            → login  { username, password }
     POST  auth.php?logout=1   → destroy session
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
start_session();

// ---- logout ----
if (method() === 'POST' && (string)param('logout', '') === '1') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_out(['ok' => true, 'loggedOut' => true]);
}

// ---- session check ----
if (method() === 'GET') {
    $a = current_admin();
    if (!$a) json_err('Not authenticated.', 401);
    json_out(['ok' => true, 'admin' => $a]);
}

// ---- login ----
if (method() === 'POST') {
    $user = s(param('username', ''));
    $pass = (string)param('password', '');
    if ($user === '' || $pass === '') json_err('Username and password are required.', 422);

    $st = db()->prepare('SELECT * FROM admin_users WHERE username = :u LIMIT 1');
    $st->execute([':u' => $user]);
    $row = $st->fetch();

    // constant-ish response time whether or not the user exists
    if (!$row || !password_verify($pass, $row['password_hash'])) {
        json_err('Invalid username or password.', 401);
    }

    // rehash if the algorithm/cost changed
    if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
        $up = db()->prepare('UPDATE admin_users SET password_hash = :h WHERE id = :id');
        $up->execute([':h' => password_hash($pass, PASSWORD_DEFAULT), ':id' => $row['id']]);
    }

    session_regenerate_id(true);
    $_SESSION['admin_id']   = (int)$row['id'];
    $_SESSION['admin_name'] = $row['name'];
    $_SESSION['admin_user'] = $row['username'];

    db()->prepare('UPDATE admin_users SET last_login = NOW() WHERE id = :id')
        ->execute([':id' => $row['id']]);

    json_out(['ok' => true, 'admin' => [
        'id' => (int)$row['id'], 'name' => $row['name'], 'username' => $row['username'],
    ]]);
}

json_err('Method not allowed.', 405);
