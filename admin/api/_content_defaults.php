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
    'links'       => "Fleet | #fleet\nShare & Earn | #share\nTiers | #tiers\nPortal | portal",
    'login_label' => 'Partner Login',
],

/* ---------------------------------- hero -------------------------------- */
/* Used when no slides are active. With slides, each slide supplies its own
   headline / lead / button and this block only provides the tabs. */
'hero' => [
    'headline'  => "The car is\nwaiting for you",
    'lead'      => 'Certified, inspected vehicles — sourced, reconditioned and sold through the NEJ Autos partner network.',
    'cta_label' => 'More information',
    'cta_href'  => '#fleet',
    'tabs'      => "Buy a car\nFinance & warranty\nBecome a partner",
],

/* ------------------------------ booking bar ----------------------------- */
'booking' => [
    'location_label' => 'Location',
    'location_ph'    => 'Your city or region',
    'type_label'     => 'Car type',
    'types'          => "Any type\nSedan\nSUV\nElectric\nTruck\nPremium",
    'budget_label'   => 'Budget',
    'budgets'        => "Any budget\nUnder ₦25M\n₦25M – ₦40M\n₦40M – ₦60M\n₦60M+",
    'btn'            => 'Find a car',
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
         'text' => 'One tap sends a trackable listing to *WhatsApp, Facebook, X or Telegram*. Every share is counted to your account.'],
        ['ico' => '👤', 'title' => 'A buyer taps your link',
         'text' => "They land on the car's page and enquire — automatically *credited to you* as the source of the sale."],
        ['ico' => '💸', 'title' => 'You get paid',
         'text' => "Earn *₦800 per share* plus your full commission *+2%* if the buyer buys through your link. The month's top sharer wins *₦300,000*."],
    ],
    'chips' => [
        ['v' => '₦800',     'k' => 'Per counted share (max 2/day)'],
        ['v' => '₦300,000', 'k' => 'Monthly top-sharer prize'],
        ['v' => '₦100,000', 'k' => 'Per referred partner who sells'],
        ['v' => '₦250,000', 'k' => 'Bonus per EV / premium sold'],
    ],
],

/* --------------------------------- tiers -------------------------------- */
'tiers' => [
    'kicker'      => '',
    'title'       => 'Partner',
    'title_em'    => 'Tiers',
    'title_after' => '',
    'text'        => 'The more you sell each month, the higher your commission on every single car — automatically.',
    'items' => [
        ['tone' => 'bronze', 'medal' => '🥉', 'name' => 'Bronze', 'units' => '0–4 cars / month',
         'rate' => '3%', 'lbl' => 'base commission', 'featured' => 0,
         'perks' => "Digital partner dashboard\nFull inventory access\nShare & earn tools"],
        ['tone' => 'silver', 'medal' => '🥈', 'name' => 'Silver', 'units' => '5–12 cars / month',
         'rate' => '5%', 'lbl' => 'commission', 'featured' => 0,
         'perks' => "Faster payouts\nMarketing support\nDedicated account manager"],
        ['tone' => 'gold', 'medal' => '🥇', 'name' => 'Gold', 'units' => '13–25 cars / month',
         'rate' => '6%', 'lbl' => 'commission', 'featured' => 1,
         'perks' => "Co-branded leads\nInventory previews\nPriority payouts"],
        ['tone' => 'plat', 'medal' => '💎', 'name' => 'Platinum', 'units' => '26+ cars / month',
         'rate' => '7%', 'lbl' => 'top commission', 'featured' => 0,
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
    'title'      => 'Earn up to 7% selling cars you never had to source.',
    'text'       => 'Join the network, share inventory, and get paid on every sale — plus bonuses for top sellers, referrals, and the most-shared cars each month.',
    'btn_label'  => 'Open the Partner Portal',
    'btn_href'   => 'portal',
    'stats' => [
        ['n' => '7%',     'l' => 'Top commission'],
        ['n' => '5 days', 'l' => 'To payout'],
        ['n' => '250+',   'l' => 'Partners'],
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
    'col1_links' => "Our fleet | #fleet\nShare & earn | #share\nPartner tiers | #tiers\nThe portal | portal",
    'col2_title' => 'Partners',
    'col2_links' => "Partner login | portal\nApply to join | #apply\nShare & earn | portal#share",
    'col3_title' => 'Contact',
    'email'      => 'partners@nejautos.com',
    'phone'      => '+1 (000) 000-0000',
    'copyright'  => 'NEJ Autos © 2026. All rights reserved.',
    'tagline'    => 'Designed for dealers, brokers & independent agents.',
],

];
