<?php
/* =========================================================================
   NEJ Autos — portal user self-service profile (broker / distributor)
     GET   profile.php   → my editable profile + saved payout details
     POST  profile.php   → update { phone, company, bank_name,
                                     account_number, account_name }
   Payout details can be saved at any time; the actual withdrawal stays gated
   on a ready (available) balance — see withdrawals.php.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
$user = require_user();
$uid  = (int)$user['id'];
$pdo  = db();

/* --------------------------------- GET ---------------------------------- */
if (method() === 'GET') {
    json_out(['ok' => true, 'profile' => load_profile($pdo, $uid)]);
}

/* --------------------------------- POST --------------------------------- */
if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $sets = []; $bind = [':id' => $uid];

    // free-text contact fields
    foreach (['phone' => 40, 'company' => 160, 'bank_name' => 120, 'account_name' => 160] as $k => $max) {
        if (array_key_exists($k, $b)) {
            $sets[] = "$k = :$k";
            $bind[":$k"] = mb_substr(s($b[$k]), 0, $max);
        }
    }

    // account number — digits only (spaces/dashes stripped). Nigerian NUBAN is
    // 10 digits; accept 5–20 to stay flexible for other banks/wallets.
    if (array_key_exists('account_number', $b)) {
        $acct = preg_replace('/\D+/', '', (string)$b['account_number']);
        if ($acct !== '' && (strlen($acct) < 5 || strlen($acct) > 20)) {
            json_err('Enter a valid account number (5–20 digits).', 422);
        }
        $sets[] = 'account_number = :account_number';
        $bind[':account_number'] = $acct;
    }

    if (!$sets) json_err('Nothing to update.', 422);

    $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($bind);
    json_out(['ok' => true, 'updated' => true, 'profile' => load_profile($pdo, $uid)]);
}

json_err('Method not allowed.', 405);

/* ------------------------------- helpers -------------------------------- */
function load_profile(PDO $pdo, int $uid): array {
    $st = $pdo->prepare('SELECT name,email,phone,company,role,referral_code,
                                bank_name,account_number,account_name
                         FROM users WHERE id = :id');
    $st->execute([':id' => $uid]);
    $r = $st->fetch() ?: [];
    $acct = (string)($r['account_number'] ?? '');
    return [
        'name' => $r['name'] ?? '', 'email' => $r['email'] ?? '',
        'phone' => $r['phone'] ?? '', 'company' => $r['company'] ?? '',
        'role' => $r['role'] ?? '', 'referral_code' => $r['referral_code'] ?? '',
        'bank_name' => $r['bank_name'] ?? '', 'account_number' => $acct,
        'account_name' => $r['account_name'] ?? '',
        'has_payout' => ($acct !== '' && ($r['bank_name'] ?? '') !== ''),
    ];
}
