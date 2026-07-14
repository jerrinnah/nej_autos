<?php
/* =========================================================================
   NEJ Autos — portal user authentication (broker / distributor)
     GET   portal_auth.php            → current session { user } or 401
     POST  portal_auth.php?signup=1   → register { name,email,phone,role,password }
     POST  portal_auth.php            → login  { email, password }
     POST  portal_auth.php?logout=1   → destroy session
   New accounts are created 'Pending' and must be approved by an admin.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
start_user_session();

/* ------------------------------- logout --------------------------------- */
if (method() === 'POST' && (string)param('logout', '') === '1') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_out(['ok' => true, 'loggedOut' => true]);
}

/* ------------------------------- signup --------------------------------- */
if (method() === 'POST' && (string)param('signup', '') === '1') {
    $b = input();
    $name  = s($b['name'] ?? '');
    $email = strtolower(s($b['email'] ?? ''));
    $phone = s($b['phone'] ?? '');
    $company = s($b['company'] ?? '');
    $role  = in_array(s($b['role'] ?? ''), ['broker', 'distributor'], true) ? s($b['role']) : '';
    $pass  = (string)($b['password'] ?? '');

    if ($name === '' || $email === '' || $role === '') json_err('Name, email and account type are required.', 422);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Enter a valid email address.', 422);
    if (strlen($pass) < 6) json_err('Password must be at least 6 characters.', 422);

    // unique referral code from initials + a numeric tail
    $code = gen_user_code($name, $role);

    try {
        $st = db()->prepare(
            'INSERT INTO users (name,email,phone,company,password_hash,role,status,referral_code)
             VALUES (:n,:e,:p,:co,:h,:r,\'Pending\',:c)');
        $st->execute([
            ':n' => $name, ':e' => $email, ':p' => $phone, ':co' => $company,
            ':h' => password_hash($pass, PASSWORD_DEFAULT), ':r' => $role, ':c' => $code,
        ]);
    } catch (PDOException $e) {
        if ((int)$e->getCode() === 23000) json_err('An account with that email already exists.', 409);
        json_err('Could not create the account.', 500);
    }

    json_out(['ok' => true, 'registered' => true,
        'message' => 'Account created. An admin will review and activate it shortly.'], 201);
}

/* -------------------------------- login --------------------------------- */
if (method() === 'POST') {
    $b = input();
    $email = strtolower(s($b['email'] ?? ''));
    $pass  = (string)($b['password'] ?? '');
    if ($email === '' || $pass === '') json_err('Email and password are required.', 422);

    $st = db()->prepare('SELECT * FROM users WHERE email = :e LIMIT 1');
    $st->execute([':e' => $email]);
    $u = $st->fetch();
    if (!$u || !password_verify($pass, $u['password_hash'])) json_err('Invalid email or password.', 401);

    if ($u['status'] === 'Pending')   json_err('Your account is awaiting admin approval.', 403, ['pending' => true]);
    if ($u['status'] === 'Suspended') json_err('Your account has been suspended. Contact NEJ Autos.', 403);

    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE users SET password_hash=:h WHERE id=:id')
            ->execute([':h' => password_hash($pass, PASSWORD_DEFAULT), ':id' => $u['id']]);
    }

    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    db()->prepare('UPDATE users SET last_login = NOW() WHERE id = :id')->execute([':id' => $u['id']]);

    json_out(['ok' => true, 'user' => pub_user($u)]);
}

/* ---------------------------- session check ----------------------------- */
if (method() === 'GET') {
    $u = current_user();
    if (!$u) json_err('Not authenticated.', 401);
    json_out(['ok' => true, 'user' => pub_user($u)]);
}

json_err('Method not allowed.', 405);

/* ------------------------------- helpers -------------------------------- */
function pub_user(array $u): array {
    return [
        'id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'],
        'role' => $u['role'], 'status' => $u['status'], 'referral_code' => $u['referral_code'],
    ];
}
function gen_user_code(string $name, string $role): string {
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $ini = '';
    foreach (array_slice($parts, 0, 2) as $p) $ini .= strtoupper(mb_substr($p, 0, 1));
    if ($ini === '') $ini = 'NJ';
    $prefix = $role === 'broker' ? 'BRK' : 'DST';
    // find a free numeric suffix
    for ($i = 0; $i < 50; $i++) {
        $code = 'NEJ-' . $prefix . '-' . $ini . random_int(100, 999);
        $st = db()->prepare('SELECT 1 FROM users WHERE referral_code = :c');
        $st->execute([':c' => $code]);
        if (!$st->fetch()) return $code;
    }
    return 'NEJ-' . $prefix . '-' . $ini . random_int(1000, 9999);
}
