<?php
/* =========================================================================
   NEJ Autos — tracked link redirect  (public, no auth)
   Hit as /l/<slug> (rewritten to this) or /admin/api/go.php?l=<slug>.
   Records the click, awards distributor click-points on a unique visit,
   then 302-redirects the visitor to the car detail page.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';

$slug = preg_replace('/[^A-Za-z0-9]/', '', (string)param('l', ''));
$home = site_base() . '/';

if ($slug === '') { redirect($home); }

$pdo = db();
$st = $pdo->prepare('SELECT * FROM tracked_links WHERE slug = :s LIMIT 1');
$st->execute([':s' => $slug]);
$link = $st->fetch();
if (!$link) { redirect($home); }

/* ---- identify the visitor (privacy-preserving hash, not stored raw) ---- */
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ip = trim(explode(',', $ip)[0]);
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$salt = 'nej-clk-' . ($CONFIG['session_name'] ?? 'nej');
$ipHash = hash('sha256', $ip . '|' . $ua . '|' . $link['id'] . '|' . $salt);

$isBot = $ua === '' || preg_match('/bot|crawl|spider|slurp|facebookexternalhit|preview|monitor/i', $ua);

// unique = this hash hasn't hit this link before
$seen = $pdo->prepare('SELECT 1 FROM link_clicks WHERE link_id=:l AND ip_hash=:h LIMIT 1');
$seen->execute([':l' => $link['id'], ':h' => $ipHash]);
$isUnique = !$seen->fetch();

if (!$isBot) {
    $referer = substr((string)($_SERVER['HTTP_REFERER'] ?? ''), 0, 255) ?: null;
    $pdo->prepare('INSERT INTO link_clicks (link_id,ip_hash,is_unique,referer) VALUES (:l,:h,:u,:r)')
        ->execute([':l' => $link['id'], ':h' => $ipHash, ':u' => $isUnique ? 1 : 0, ':r' => $referer]);

    $pdo->prepare('UPDATE tracked_links SET clicks = clicks + 1' . ($isUnique ? ', uniques = uniques + 1' : '') . ' WHERE id = :id')
        ->execute([':id' => $link['id']]);

    // Award click points to distributors on unique visits (starts as 'pending';
    // becomes withdrawable only when the shared car is sold — see settle_sale()).
    if ($isUnique) {
        $u = $pdo->prepare('SELECT role FROM users WHERE id = :id');
        $u->execute([':id' => $link['user_id']]);
        $role = $u->fetchColumn();
        if ($role === 'distributor') {
            // FIX #1a: cap how many clicks a single link can earn per day, so a
            // distributor can't farm unlimited "unique" clicks (VPN / embeds).
            // The click is still logged above for analytics; only the reward is gated.
            $dayCap = (int)setting('max_click_points_per_link_day', '20');
            $rewarded = 0;
            if ($dayCap > 0) {
                $dc = $pdo->prepare("SELECT COUNT(*) FROM ledger
                                     WHERE link_id=:l AND type='click_points' AND DATE(created_at)=CURDATE()");
                $dc->execute([':l' => $link['id']]);
                $rewarded = (int)$dc->fetchColumn();
            }
            if ($dayCap === 0 || $rewarded < $dayCap) {
                $pts = (int)setting('click_points', '5');
                $val = $pts * (int)setting('point_value_ngn', '50');
                $pdo->prepare(
                    'INSERT INTO ledger (user_id,type,points,amount,status,car_id,link_id,week,note)
                     VALUES (:u,\'click_points\',:p,:a,\'pending\',:c,:l,:w,:n)'
                )->execute([':u' => $link['user_id'], ':p' => $pts, ':a' => $val, ':c' => $link['car_id'],
                            ':l' => $link['id'], ':w' => iso_week(), ':n' => 'Unique click']);
            }
        }
    }
}

redirect($link['dest']);

/* ----------------------------------------------------------------------- */
function redirect(string $url): void {
    header('Cache-Control: no-store');
    header('Location: ' . $url, true, 302);
    exit;
}
