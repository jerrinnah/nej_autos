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
    'click_points'              => [0, 100000],
    'point_value_ngn'           => [0, 1000000],
    'distributor_sale_bonus_ngn'=> [0, 100000000],
    'min_withdrawal_ngn'        => [0, 100000000],
    'max_click_points_per_link_day' => [0, 100000],
    'click_unlock_cap_pct'      => [0, 100],
];

if (method() === 'GET') {
    $out = [];
    foreach ($ALLOWED as $k => $_) $out[$k] = (float)setting($k, '0');
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
