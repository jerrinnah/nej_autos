<?php
/* =========================================================================
   NEJ Autos — default homepage content.

   Mirrors the copy that ships inside index.html, so the CMS opens pre-filled
   and the public page looks identical before anyone edits a word. Included by
   content.php (fallback for a block that has no row yet) and by migrate.php
   (the initial seed).

   Conventions used by the blocks below:
     - A section heading is  title + <b>title_em</b> + title_after.
     - "Lines" fields hold one item per line. Link lines are  Label | href.
     - Body copy supports *bold* — content.php/index.html render it as <b>,
       everything else is escaped. Never store raw HTML here.
   ========================================================================= */

return [

/* ------------------------------ header / nav ---------------------------- */
'nav' => [
    'mark'        => 'NEJ',
    'brand'       => 'nej',
    'brand_em'    => 'autos',
    'links'       => "Fleet | #fleet\nShare & Earn | #share\nPortal | portal",
    'login_label' => 'Partner Login',
],

/* ---------------------------------- hero -------------------------------- */
/* Used when no slides are active. With slides, each slide supplies its own
   headline / lead / button and this block only provides the tabs. */
'hero' => [
    'headline'  => "The car is\nwaiting for you",
    'lead'      => 'Certified, inspected vehicles — sourced, reconditioned and sold through the NEJ Autos partner network.',
    // Blank by default: the hero already has the tabs and the callback card, so
    // a third link here only splits the click. Set a label to bring it back.
    'cta_label' => '',
    'cta_href'  => '#fleet',
    'tabs'      => "Buy a car | #fleet\nShare & earn | #share\nBecome a partner | #apply",
    'call_label'=> 'Talk to a specialist',
],

/* --------------------------- callback request ---------------------------- */
/* The card that overlaps the hero. A submission creates a lead (leads.php) and
   lands on the admin Leads screen. */
'booking' => [
    'name_label'    => 'Your name',
    'name_ph'       => 'Full name',
    'phone_label'   => 'Phone or WhatsApp',
    'phone_ph'      => '0800 000 0000',
    'want_label'    => 'What are you after?',
    'wants'         => "A car to buy\nSedan\nSUV\nElectric\nTruck\nPremium\nJoining as a partner",
    'btn'           => 'Call me back',
    'note'          => 'No obligation — a specialist calls you back, usually the same day.',
    'success_title' => "Got it — we'll call you back.",
    'success_text'  => 'A specialist usually reaches out the same day.',
],

/* --------------------------------- fleet -------------------------------- */
'fleet' => [
    'kicker'      => 'Handpicked inventory',
    'title'       => 'Our',
    'title_em'    => 'Fleet',
    'title_after' => '',
    'text'        => 'Every vehicle is title-checked, inspected and reconditioned by NEJ Autos — ready for your customers.',
    'empty'       => 'New inventory is on its way — check back soon.',
],

/* ------------------------------ share & earn ---------------------------- */
'share' => [
    'kicker'      => 'Share & Earn',
    'title'       => 'Post a car. Get paid',
    'title_em'    => 'when it sells.',
    'title_after' => '',
    'text'        => 'Share any NEJ Autos listing to WhatsApp, Facebook or X. Every share is tracked to you — and buyers who come through your link earn you more.',
    'steps' => [
        ['ico' => '📤', 'title' => 'Share any car',
         'text' => 'One tap sends a trackable listing to *WhatsApp, Facebook, X or Telegram*. Two shares count each day — share *7 days running* and that doubles to four.'],
        ['ico' => '👤', 'title' => 'A buyer taps your link',
         'text' => "They land on the car's page and enquire — automatically *credited to you* as the source of the sale."],
        ['ico' => '💸', 'title' => 'You get paid',
         'text' => "Earn *₦800 per share* plus your full tier commission if the buyer buys through your link."],
    ],
    'chips' => [
        ['v' => '₦800',     'k' => 'Per counted share · 2/day, 4/day on a streak'],
        // {prize} is replaced with the live pool from Settings → Top-sharer bonus.
        // With the pool at 0 the bonus is switched off and this chip is dropped,
        // so the page can never advertise a prize nothing would pay out.
        ['v' => '{prize}',  'k' => 'Monthly top-sharer prize'],
        ['v' => '₦100,000', 'k' => 'Per referred partner who sells'],
        ['v' => '₦250,000', 'k' => 'Bonus per EV / premium sold'],
    ],
],

/* --------------------------- top-sharer board --------------------------- */
/* Live board on the homepage, fed by leaderboard.php?public=1. Switch it off
   under Settings → Top-sharer bonus (leaderboard_public). */
'board' => [
    'kicker'      => 'Live this month',
    'title'       => 'Top',
    'title_em'    => 'Sharers',
    'title_after' => '',
    'text'        => 'Ranked by the buyers their links actually brought in. The board resets on the 1st — every partner starts level.',
    'empty'       => 'The board is open and nobody has claimed a spot yet this month. Share one car and you are on it.',
    'prize_note'  => 'The month\'s top sharers split the prize pool.',
],

/* --------------------------------- tiers -------------------------------- */
'tiers' => [
    'kicker'      => '',
    'title'       => 'Partner',
    'title_em'    => 'Tiers',
    'title_after' => '',
    'text'        => 'The more you sell each month, the higher your commission on every single car — automatically. Every tier also carries the ₦250,000 minimum per sale.',
    'items' => [
        ['tone' => 'bronze', 'medal' => '🥉', 'name' => 'Bronze', 'units' => '0–4 cars / month',
         'rate' => '1%', 'lbl' => 'base commission', 'featured' => 0,
         'perks' => "Digital partner dashboard\nFull inventory access\nShare & earn tools"],
        ['tone' => 'silver', 'medal' => '🥈', 'name' => 'Silver', 'units' => '5–9 cars / month',
         'rate' => '1.4%', 'lbl' => 'commission', 'featured' => 0,
         'perks' => "Faster payouts\nMarketing support\nDedicated account manager"],
        ['tone' => 'gold', 'medal' => '🥇', 'name' => 'Gold', 'units' => '10–14 cars / month',
         'rate' => '1.7%', 'lbl' => 'commission', 'featured' => 1,
         'perks' => "Co-branded leads\nInventory previews\nPriority payouts"],
        ['tone' => 'plat', 'medal' => '💎', 'name' => 'Platinum', 'units' => '15+ cars / month',
         'rate' => '2%', 'lbl' => 'top commission', 'featured' => 0,
         'perks' => "Invitation-only inventory\nQuarterly bonuses\nIncentive trips"],
    ],
],

/* ------------------------------ testimonials ---------------------------- */
'quotes' => [
    'kicker'      => 'Trusted by partners',
    'title'       => 'What',
    'title_em'    => 'They Say',
    'title_after' => 'About Us',
    'text'        => '',
    'items' => [
        ['stars' => 5, 'name' => 'Ava Thompson', 'role' => 'Summit Auto Group',
         'text' => "I share NEJ listings to my WhatsApp groups and get paid when they sell. Fastest payouts I've had from any wholesaler."],
        ['stars' => 5, 'name' => 'Marcus Reid', 'role' => 'Reid Motors',
         'text' => 'No sourcing, no reconditioning headaches. I just pick quality cars, close the deal, and NEJ handles the rest.'],
        ['stars' => 4, 'name' => 'Lena Ortiz', 'role' => 'Coastline Cars',
         'text' => 'The tier system is real money. I hit Gold in two months and my commission on every car went up.'],
    ],
],

/* ------------------------------ partner CTA ----------------------------- */
'cta' => [
    'kicker'     => 'NEJ Autos Partner Network',
    'title'      => 'Earn ₦800,000 on a single ₦40M sale.',
    'text'       => "That's your *2% top commission* on a car you never had to source — and no sale pays you less than *₦250,000*, whatever the car is worth. Your first payout clears *the same day*.",
    'btn_label'  => 'Open the Partner Portal',
    'btn_href'   => 'portal',
    'stats' => [
        ['n' => '₦250,000', 'l' => 'Minimum per sale'],
        ['n' => '2%',       'l' => 'Top commission'],
        ['n' => 'Same day', 'l' => 'Your first payout'],
        ['n' => '250+',     'l' => 'Partners'],
    ],
    'form_title' => 'Apply to join',
    'form_text'  => 'A partner specialist replies within 24 hours.',
    'form_email' => 'partners@nejautos.com',
    'form_btn'   => 'Submit application',
],

/* --------------------------------- footer ------------------------------- */
'footer' => [
    'about'      => 'Certified vehicles and a partner network built for fast, reliable payouts and real growth.',
    'col1_title' => 'Explore',
    'col1_links' => "Our fleet | #fleet\nShare & earn | #share\nThe portal | portal",
    'col2_title' => 'Partners',
    'col2_links' => "Partner login | portal\nApply to join | #apply\nShare & earn | portal#share",
    'col3_title' => 'Contact',
    'email'      => 'partners@nejautos.com',
    'phone'      => '0802 603 8780',
    'copyright'  => 'NEJ Autos © 2026. All rights reserved.',
    'tagline'    => 'Designed for dealers, brokers & independent agents.',
],

];
