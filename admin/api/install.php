<?php
/* =========================================================================
   NEJ Autos Admin — one-time installer
   Creates all tables and (optionally) the first admin user + demo data.

   USAGE (once):
     1. Set a non-empty 'install_token' in config.php.
     2. Visit:
        /admin/api/install.php?token=YOUR_TOKEN&user=admin&pass=YourPassword&demo=1
     3. Blank out 'install_token' in config.php afterwards.
   Safe to re-run: tables use IF NOT EXISTS and the admin user is upserted.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$token = (string)($CONFIG['install_token'] ?? '');
if ($token === '' || !hash_equals($token, (string)param('token', ''))) {
    json_err('Installer is locked. Set a matching install_token in config.php.', 403);
}

$pdo = db();

/* ------------------------- 1. create schema ----------------------------- */
$sqlFile = dirname(__DIR__) . '/schema.sql';
if (!is_file($sqlFile)) json_err('schema.sql not found next to /admin.', 500);
$sql = file_get_contents($sqlFile);
try {
    // Run the whole schema; multi-statement is fine over the mysql PDO driver.
    $pdo->exec($sql);
} catch (Throwable $e) {
    json_err('Schema creation failed: ' . $e->getMessage(), 500);
}

$report = ['tables_created' => true];

/* --------------------- 2. first admin user (upsert) --------------------- */
$user = s(param('user', 'admin'));
$pass = (string)param('pass', '');
if ($user !== '' && $pass !== '') {
    if (strlen($pass) < 6) json_err('Password must be at least 6 characters.', 422);
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $st = $pdo->prepare(
        'INSERT INTO admin_users (username, password_hash, name)
         VALUES (:u, :h, :n)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
    );
    $st->execute([':u' => $user, ':h' => $hash, ':n' => ucfirst($user)]);
    $report['admin_user'] = $user;
}

/* --------------------------- 3. demo data ------------------------------- */
if ((string)param('demo', '') === '1') {
    $count = (int)$pdo->query('SELECT COUNT(*) FROM cars')->fetchColumn();
    if ($count === 0) {
        seed_demo($pdo);
        $report['demo_seeded'] = true;
    } else {
        $report['demo_seeded'] = false;
        $report['demo_note'] = 'cars table already had rows; skipped seeding.';
    }
}

json_out(['ok' => true, 'installed' => $report,
    'next' => 'Blank out install_token in config.php, then open /admin/ to log in.']);


/* ----------------------------------------------------------------------- */
function seed_demo(PDO $pdo): void {
    $cars = [
        // make, model, year, price, mileage, body, ev, premium, bonus, cond, emoji, bg
        ['Tesla','Model 3 Long Range',2024,41990000,8200,'EV',1,1,1,5,'⚡',5],
        ['BMW','i4 eDrive40',2023,47500000,12400,'EV',1,1,1,5,'⚡',5],
        ['Toyota','RAV4 Hybrid XLE',2023,32400000,18900,'SUV',0,0,1,4,'🚙',1],
        ['Honda','Civic Sport',2022,24800000,27500,'Sedan',0,0,0,4,'🚗',0],
        ['Ford','F-150 Lariat',2023,52300000,15100,'Truck',0,1,1,4,'🛻',4],
        ['Mercedes-Benz','C 300',2023,46900000,9800,'Premium',0,1,1,5,'🚗',3],
        ['Hyundai','Ioniq 5 SEL',2024,45200000,6400,'EV',1,1,1,5,'⚡',5],
        ['Audi','Q5 Premium Plus',2023,49800000,11700,'Premium',0,1,1,4,'🚙',2],
    ];
    $cs = $pdo->prepare(
        'INSERT INTO cars (make,model,year,price,mileage,body,is_ev,is_premium,target_bonus,cond_score,emoji,bg,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,\'Available\')');
    foreach ($cars as $c) $cs->execute($c);

    $partners = [
        ['Ava Thompson','Summit Auto Group','ava@summit.example','','NEJ-AT-2612',31,214,18420000,6,142,'Active','2026-03-14'],
        ['Marcus Reid','Reid Motors','marcus@reid.example','','NEJ-MR-2611',24,168,13980000,4,98,'Active','2026-03-20'],
        ['Lena Ortiz','Coastline Cars','lena@coastline.example','','NEJ-LO-2610',19,141,10240000,3,76,'Active','2026-04-02'],
        ['Devon Clarke','Clarke Independent','devon@clarke.example','','NEJ-DC-2613',15,98,8110000,2,54,'Active','2026-04-11'],
        ['Priya Nair','Nair Auto Brokers','priya@nair.example','','NEJ-PN-2609',11,77,5340000,5,61,'Pending','2026-05-01'],
    ];
    $ps = $pdo->prepare(
        'INSERT INTO partners (name,company,email,phone,referral_code,units,ytd,commission,referrals,shares,status,joined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($partners as $p) $ps->execute($p);

    $leads = [
        ['Robert Hale','Tesla Model 3 Long Range','0803-555-0192',41990000,'Financing',null,null],
        ['Jasmine Cole','Toyota RAV4 Hybrid XLE','0806-555-0114',32400000,'Contacted',null,null],
        ['Derek Nunez','Ford F-150 Lariat','0810-555-0177',52300000,'Won','whatsapp','NEJ-AT-2612'],
        ['Amara Singh','Honda Civic Sport','0708-555-0136',24800000,'New',null,null],
        ['Leo Vance','BMW i4 eDrive40','0705-555-0159',47500000,'Won',null,null],
    ];
    $ls = $pdo->prepare(
        'INSERT INTO leads (customer,vehicle,phone,value,status,via_share,ref) VALUES (?,?,?,?,?,?,?)');
    foreach ($leads as $l) $ls->execute($l);

    $payouts = [
        [1,'Weekly commission run',2196000,'Paid','NEJ-PO-4821','2026-07-05'],
        [2,'Weekly commission + EV bonus',3110000,'Paid','NEJ-PO-4762','2026-06-28'],
        [3,'Weekly commission run',1840000,'Paid','NEJ-PO-4698','2026-06-21'],
        [1,'Pending — clears in 5 business days',2620000,'Pending','NEJ-PO-4890',null],
    ];
    $pos = $pdo->prepare(
        'INSERT INTO payouts (partner_id,descr,amount,status,ref,paid_on) VALUES (?,?,?,?,?,?)');
    foreach ($payouts as $p) $pos->execute($p);

    $shares = [
        [1,'Tesla Model 3 Long Range','whatsapp'],
        [1,'Tesla Model 3 Long Range','facebook'],
        [2,'Ford F-150 Lariat','whatsapp'],
        [3,'BMW i4 eDrive40','x'],
        [1,'Hyundai Ioniq 5 SEL','telegram'],
    ];
    $ss = $pdo->prepare(
        'INSERT INTO shares (partner_id,vehicle,platform) VALUES (?,?,?)');
    foreach ($shares as $sh) $ss->execute($sh);
}
