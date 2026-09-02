<?php
/* =========================================================================
   NEJ Autos Admin API — economics settings (admin only)
     GET   settings.php   → current values
     POST  settings.php   → update whitelisted keys { key: value, ... }
   ========================================================================= */

require __DIR__ . '/_bootstrap.php';
require_admin();

// key => [min, max] guard rails (naira / percent / points)
$ALLOWED = [
    'broker_rate_pct'            => [0, 100],
    'min_commission_ngn'        => [0, 100000000],
    'min_offer_pct'             => [0, 100],
    'click_points'              => [0, 100000],
    'point_value_ngn'           => [0, 1000000],
    'distributor_sale_bonus_ngn'=> [0, 100000000],
    'min_withdrawal_ngn'        => [0, 100000000],
    'max_click_points_per_link_day' => [0, 100000],
    'click_unlock_cap_pct'      => [0, 100],
    'share_reward_ngn'          => [0, 100000000],
    'max_counted_shares_per_day'=> [0, 100],
    'share_streak_days'         => [0, 365],
    'max_counted_shares_streak' => [0, 100],
    'share_unlock_cap_pct'      => [0, 100],
    'leaderboard_pool_ngn'      => [0, 100000000],
    'leaderboard_winners'       => [0, 100],
    'leaderboard_split_weighted'=> [0, 1],
    'leaderboard_min_clicks'    => [0, 100000],
    'leaderboard_public'        => [0, 1],
    'first_payout_same_day'     => [0, 1],
    'hero_autoplay_ms'          => [0, 60000],
];

// Fallbacks for a key the settings table doesn't hold yet (pre-migration), so
// the admin form never shows a 0 the admin didn't choose — and then saves it.
$DEFAULTS = [
    'broker_rate_pct' => '2',            'min_commission_ngn' => '250000',
    'click_points' => '5',               'point_value_ngn' => '50',
    'distributor_sale_bonus_ngn' => '25000', 'min_withdrawal_ngn' => '10000',
    'max_click_points_per_link_day' => '20', 'click_unlock_cap_pct' => '20',
    'share_reward_ngn' => '800',         'max_counted_shares_per_day' => '2',
    'share_streak_days' => '7',          'max_counted_shares_streak' => '4',
    'share_unlock_cap_pct' => '5',       'leaderboard_pool_ngn' => '0',
    'leaderboard_winners' => '5',        'leaderboard_split_weighted' => '1',
    'leaderboard_min_clicks' => '1',     'leaderboard_public' => '1',
    'first_payout_same_day' => '1',      'hero_autoplay_ms' => '6000',
    'min_offer_pct' => '85',
];

if (method() === 'GET') {
    $out = [];
    foreach ($ALLOWED as $k => $_) $out[$k] = (float)setting($k, $DEFAULTS[$k] ?? '0');
    json_out(['ok' => true, 'settings' => $out]);
}

if (method() === 'POST' || method() === 'PUT') {
    $b = input();
    $saved = [];
    foreach ($ALLOWED as $k => [$min, $max]) {
        if (!array_key_exists($k, $b)) continue;
        $n = (float)$b[$k];
        if ($n < $min || $n > $max) json_err("Value for $k is out of range.", 422);
        // store ints cleanly, allow one decimal for the percentage
        $val = $k === 'broker_rate_pct' ? rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.') : (string)(int)$n;
        set_setting($k, $val);
        $saved[$k] = $val;
    }
    if (!$saved) json_err('No valid settings provided.', 422);
    json_out(['ok' => true, 'saved' => $saved]);
}

json_err('Method not allowed.', 405);
