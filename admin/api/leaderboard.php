<?php
/* =========================================================================
   NEJ Autos Admin API — top-sharer leaderboard bonus (admin only)
     GET   leaderboard.php?period=YYYY-MM  → ranking + computed split (+ paid?)
     POST  leaderboard.php?period=YYYY-MM  → pay the pool for that month
   Rewards the highest sharers by UNIQUE CLICKS their links drove — regardless
   of whether a sale closed through them — from a FIXED monthly pool, so total
   cost is capped no matter how much activity happens. Idempotent per month.
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

/* --------------------------- period handling ---------------------------- */
$period = (string)param('period', date('Y-m'));
if (!preg_match('/^(\d{4})-(\d{2})$/', $period, $m) || (int)$m[2] < 1 || (int)$m[2] > 12) {
    json_err('Bad period. Use YYYY-MM.', 422);
}
$year = (int)$m[1]; $mon = (int)$m[2];
$start   = sprintf('%04d-%02d-01 00:00:00', $year, $mon);
$end     = date('Y-m-01 00:00:00', strtotime("$start +1 month"));
$tag     = sprintf('%04d-M%02d', $year, $mon);          // ledger.week tag (CHAR(8), never an ISO week)
$label   = date('F Y', strtotime($start));
$isCurrent = ($period === date('Y-m'));
$isFuture  = ($start > date('Y-m-01 00:00:00'));

/* ------------------------------- config --------------------------------- */
$pool     = (int)setting('leaderboard_pool_ngn', '0');
$winners  = (int)setting('leaderboard_winners', '5');
$weighted = (int)setting('leaderboard_split_weighted', '1') === 1;
$minClk   = max(0, (int)setting('leaderboard_min_clicks', '1'));
$dayCap   = (int)setting('max_click_points_per_link_day', '20');   // reuse the anti-fraud per-link/day cap

$pdo = db();

/**
 * Ranking by unique clicks, with each link's daily uniques capped at $dayCap
 * (the same anti-fraud limit used for click points) so no single link — and no
 * VPN/embed farm — can dominate the board. Returns rows ordered best-first.
 */
function lb_ranking(PDO $pdo, string $start, string $end, int $dayCap, int $minClk, int $winners): array {
    $cap  = $dayCap > 0 ? (int)$dayCap : 1000000000;   // 0 = "no cap" → effectively unlimited
    $lim  = max(0, $winners);
    $sql =
        "SELECT t.user_id, SUM(t.capped) AS score, SUM(t.raw) AS raw_uniques
         FROM (
            SELECT tl.user_id AS user_id,
                   COUNT(*) AS raw,
                   LEAST(COUNT(*), $cap) AS capped
            FROM link_clicks lc
            JOIN tracked_links tl ON tl.id = lc.link_id
            JOIN users u ON u.id = tl.user_id
            WHERE lc.is_unique = 1
              AND lc.created_at >= :s AND lc.created_at < :e
              AND u.status = 'Active'
            GROUP BY tl.user_id, lc.link_id, DATE(lc.created_at)
         ) t
         GROUP BY t.user_id
         HAVING score >= $minClk
         ORDER BY score DESC, raw_uniques DESC, t.user_id ASC
         LIMIT $lim";
    if ($lim === 0) return [];
    $q = $pdo->prepare($sql);
    $q->execute([':s' => $start, ':e' => $end]);
    return $q->fetchAll();
}

/**
 * Split a fixed pool across ranked winners. Weighted = proportional to score;
 * otherwise equal. Any rounding remainder goes to rank #1 so the payouts sum
 * to exactly the pool. Returns the winner rows with an added 'payout'.
 */
function lb_split(array $rows, int $pool, bool $weighted): array {
    $n = count($rows);
    if ($n === 0 || $pool <= 0) return array_map(fn($r) => $r + ['payout' => 0], $rows);
    $totalScore = array_sum(array_map(fn($r) => (int)$r['score'], $rows));
    $alloc = []; $sum = 0;
    foreach ($rows as $i => $r) {
        $p = ($weighted && $totalScore > 0)
            ? (int)floor($pool * (int)$r['score'] / $totalScore)
            : (int)floor($pool / $n);
        $alloc[$i] = $p; $sum += $p;
    }
    $alloc[0] += ($pool - $sum);                 // remainder → top rank
    foreach ($rows as $i => &$r) $r['payout'] = $alloc[$i];
    return $rows;
}

/** Pull already-paid bonus rows for this period, keyed by user_id. */
function lb_paid(PDO $pdo, string $tag): array {
    $q = $pdo->prepare("SELECT user_id, amount, created_at FROM ledger
                        WHERE type='leaderboard_bonus' AND week=:w");
    $q->execute([':w' => $tag]);
    $out = [];
    foreach ($q->fetchAll() as $r) $out[(int)$r['user_id']] = $r;
    return $out;
}

/* Enrich ranking rows with the partner's public details. */
function lb_decorate(PDO $pdo, array $rows): array {
    if (!$rows) return [];
    $ids = array_map(fn($r) => (int)$r['user_id'], $rows);
    $ph  = implode(',', array_fill(0, count($ids), '?'));
    $uq  = $pdo->prepare("SELECT id,name,role,referral_code FROM users WHERE id IN ($ph)");
    $uq->execute($ids);
    $by = [];
    foreach ($uq->fetchAll() as $u) $by[(int)$u['id']] = $u;
    $out = [];
    foreach ($rows as $i => $r) {
        $u = $by[(int)$r['user_id']] ?? ['name' => 'Unknown', 'role' => '', 'referral_code' => ''];
        $out[] = [
            'rank' => $i + 1, 'user_id' => (int)$r['user_id'], 'name' => $u['name'],
            'role' => $u['role'], 'referral_code' => $u['referral_code'],
            'score' => (int)$r['score'], 'raw' => (int)$r['raw_uniques'],
            'payout' => (int)($r['payout'] ?? 0),
        ];
    }
    return $out;
}

/* ================================ GET ================================== */
if (method() === 'GET') {
    $paid = lb_paid($pdo, $tag);
    $rows = lb_split(lb_ranking($pdo, $start, $end, $dayCap, $minClk, $winners), $pool, $weighted);
    $dec  = lb_decorate($pdo, $rows);
    // overlay actual paid amounts if this period was already settled
    foreach ($dec as &$d) $d['paidAmount'] = isset($paid[$d['user_id']]) ? (int)$paid[$d['user_id']]['amount'] : null;

    $paidTotal = array_sum(array_map(fn($r) => (int)$r['amount'], $paid));
    $paidOn = $paid ? substr((string)reset($paid)['created_at'], 0, 10) : null;

    json_out(['ok' => true,
        'period' => $period, 'tag' => $tag, 'label' => $label,
        'isCurrent' => $isCurrent, 'isFuture' => $isFuture,
        'config' => ['pool' => $pool, 'winners' => $winners, 'weighted' => $weighted, 'minClicks' => $minClk, 'dayCap' => $dayCap],
        'paid' => (bool)$paid, 'paidOn' => $paidOn, 'paidTotal' => $paidTotal,
        'rows' => $dec,
        'totalPayout' => array_sum(array_map(fn($r) => (int)$r['payout'], $rows)),
    ]);
}

/* ================================ PAY ================================== */
if (method() === 'POST') {
    if ($isFuture) json_err('That month hasn\'t started yet.', 422);
    if ($pool <= 0) json_err('Set a leaderboard pool (Settings) before paying.', 422);

    // idempotency — never pay a month twice
    if (lb_paid($pdo, $tag)) json_err('This month has already been paid.', 409, ['period' => $period]);

    $rows = lb_split(lb_ranking($pdo, $start, $end, $dayCap, $minClk, $winners), $pool, $weighted);
    $winnersRows = array_values(array_filter($rows, fn($r) => (int)($r['payout'] ?? 0) > 0));
    if (!$winnersRows) json_err('No qualifying sharers for this period.', 422);

    $pdo->beginTransaction();
    try {
        // double-check inside the transaction to avoid a race paying twice
        $chk = $pdo->prepare("SELECT COUNT(*) FROM ledger WHERE type='leaderboard_bonus' AND week=:w");
        $chk->execute([':w' => $tag]);
        if ((int)$chk->fetchColumn() > 0) { $pdo->rollBack(); json_err('This month has already been paid.', 409); }

        $ins = $pdo->prepare(
            "INSERT INTO ledger (user_id,type,points,amount,status,week,note)
             VALUES (:u,'leaderboard_bonus',0,:a,'available',:w,:n)");
        $rank = 0; $total = 0;
        foreach ($winnersRows as $r) {
            $rank++;
            $ins->execute([':u' => (int)$r['user_id'], ':a' => (int)$r['payout'], ':w' => $tag,
                ':n' => "Top-sharer bonus — $label (rank #$rank, " . (int)$r['score'] . ' clicks)']);
            $total += (int)$r['payout'];
        }
        $pdo->commit();
        json_out(['ok' => true, 'paid' => true, 'period' => $period, 'winners' => count($winnersRows), 'total' => $total]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_err('Payout failed — nothing was charged. ' . $e->getMessage(), 500);
    }
}

json_err('Method not allowed.', 405);
