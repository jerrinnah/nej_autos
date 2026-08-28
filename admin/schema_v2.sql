-- =========================================================================
-- NEJ Autos — schema v2: broker/distributor accounts, tracked links,
-- click analytics, earnings ledger, withdrawals, and tunable settings.
-- Safe to run repeatedly (IF NOT EXISTS). Applied via admin/api/migrate.php.
-- =========================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------- users ----
-- Self-service accounts. role = broker | distributor. Separate from the
-- admin_users table (admins) and the manual `partners` leaderboard.
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120) NOT NULL,
  `email`         VARCHAR(160) NOT NULL,
  `phone`         VARCHAR(40)  NOT NULL DEFAULT '',
  `company`       VARCHAR(160) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'distributor', -- broker | distributor
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'Pending',     -- Pending | Active | Suspended
  `referral_code` VARCHAR(60)  NOT NULL,
  `commission_pct` DECIMAL(5,2) NULL,                          -- broker override; NULL = use global
  `bank_name`      VARCHAR(120) NOT NULL DEFAULT '',           -- payout bank (self-service, Settings)
  `account_number` VARCHAR(40)  NOT NULL DEFAULT '',           -- payout account number
  `account_name`   VARCHAR(160) NOT NULL DEFAULT '',           -- payout account holder name
  `last_login`    DATETIME     NULL,
  `approved_at`   DATETIME     NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_code` (`referral_code`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------- tracked_links ----
-- One row per (user, car) share link. `slug` is the public short code used at
-- /l/<slug>. `dest` is the resolved car page URL to redirect to.
CREATE TABLE IF NOT EXISTS `tracked_links` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `car_id`     INT UNSIGNED NOT NULL,
  `slug`       VARCHAR(24)  NOT NULL,
  `dest`       TEXT         NOT NULL,
  `clicks`     INT UNSIGNED NOT NULL DEFAULT 0,   -- denormalised total for speed
  `uniques`    INT UNSIGNED NOT NULL DEFAULT 0,   -- denormalised unique count
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_link_slug` (`slug`),
  KEY `idx_link_user` (`user_id`),
  KEY `idx_link_car` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------- link_clicks ----
CREATE TABLE IF NOT EXISTS `link_clicks` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `link_id`    INT UNSIGNED NOT NULL,
  `ip_hash`    CHAR(64)     NOT NULL,             -- sha256(ip+ua+link) — visitor privacy
  `is_unique`  TINYINT(1)   NOT NULL DEFAULT 1,
  `referer`    VARCHAR(255) NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_click_link` (`link_id`),
  KEY `idx_click_iphash` (`link_id`, `ip_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- ledger ----
-- Every point/naira movement. Withdrawable balance = SUM(amount) of rows that
-- are 'available' minus reserved withdrawals. Distributor click points start
-- 'pending' and flip to 'available' only when the shared car is sold.
CREATE TABLE IF NOT EXISTS `ledger` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `type`       VARCHAR(24)  NOT NULL,   -- click_points | sale_commission | sale_bonus | adjustment
  `points`     INT          NOT NULL DEFAULT 0,
  `amount`     BIGINT       NOT NULL DEFAULT 0,   -- naira
  `status`     VARCHAR(16)  NOT NULL DEFAULT 'pending', -- pending | available
  `car_id`     INT UNSIGNED NULL,
  `link_id`    INT UNSIGNED NULL,
  `lead_id`    INT UNSIGNED NULL,
  `week`       CHAR(8)      NOT NULL DEFAULT '',  -- ISO year-week, e.g. 2026-W29
  `note`       VARCHAR(200) NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_user` (`user_id`, `status`),
  KEY `idx_ledger_car` (`car_id`),
  KEY `idx_ledger_lead` (`lead_id`),
  KEY `idx_ledger_week` (`user_id`, `week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------- withdrawals ----
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NOT NULL,
  `amount`      BIGINT       NOT NULL DEFAULT 0,
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'Requested', -- Requested | Approved | Paid | Rejected
  `method`      VARCHAR(60)  NOT NULL DEFAULT '',
  `detail`      VARCHAR(200) NOT NULL DEFAULT '',          -- bank / account note
  `admin_note`  VARCHAR(200) NULL,
  `requested_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wd_user` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------- settings ----
CREATE TABLE IF NOT EXISTS `settings` (
  `k` VARCHAR(60)  NOT NULL,
  `v` VARCHAR(200) NOT NULL,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tunable economics (admin-editable). INSERT IGNORE keeps existing values.
INSERT IGNORE INTO `settings` (`k`, `v`) VALUES
  ('broker_rate_pct',            '12'),      -- broker commission %
  ('click_points',               '5'),       -- points per unique click (distributor)
  ('point_value_ngn',            '50'),      -- ₦ per point
  ('distributor_sale_bonus_ngn', '25000'),   -- ₦ bonus when a shared car sells
  ('min_withdrawal_ngn',         '10000'),   -- minimum withdrawal
  ('max_click_points_per_link_day', '20'),   -- anti-fraud: rewarded clicks per link per day
  ('click_unlock_cap_pct',       '20'),      -- anti-fraud: unlock click points up to this % of sale value
  ('share_reward_ngn',           '800'),     -- ₦ per counted share (pending until a shared car sells)
  ('max_counted_shares_per_day', '2'),       -- shares that count toward the reward per user per day
  ('share_unlock_cap_pct',       '5'),       -- anti-fraud: unlock share rewards up to this % of sale value
  -- Top-sharer leaderboard bonus (paid regardless of a sale; cost is capped by the pool).
  ('leaderboard_pool_ngn',       '0'),       -- fixed ₦ pool per month (0 = feature off)
  ('leaderboard_winners',        '5'),       -- how many top sharers share the pool
  ('leaderboard_split_weighted', '1'),       -- 1 = split by clicks, 0 = equal shares
  ('leaderboard_min_clicks',     '1');       -- minimum capped unique clicks to qualify

-- Ready-to-use demo accounts (already Active). Passwords:
--   broker@nejautos.com      → BrokerDemo2026
--   distributor@nejautos.com → DistDemo2026
-- Change or delete these under Admin → Accounts once you're set up.
INSERT IGNORE INTO `users`
  (`name`,`email`,`phone`,`company`,`password_hash`,`role`,`status`,`referral_code`,`approved_at`)
VALUES
  ('Demo Broker','broker@nejautos.com','','NEJ Demo',
   '$2y$12$ZQsKuwzZZyqCRox6Zxg8bOhDtxxu797K9EU/JejQNujp63kOjvEq2','broker','Active','NEJ-BRK-DEMO',NOW()),
  ('Demo Distributor','distributor@nejautos.com','','NEJ Demo',
   '$2y$12$hSXVXljtL0eD3t6nz/1hFOh11MqOcb32KcMky.mwouRkNnli5WMPa','distributor','Active','NEJ-DST-DEMO',NOW());

-- --------------------------------------------------------- site_content ----
-- Editable homepage copy (the CMS). One row per block; `v` holds a JSON
-- document whose shape is owned by admin/api/_content_defaults.php. Kept
-- apart from `settings` because these values are paragraphs, not scalars.
CREATE TABLE IF NOT EXISTS `site_content` (
  `k`          VARCHAR(60) NOT NULL,
  `v`          LONGTEXT    NOT NULL,
  `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- slides ----
-- Hero slider. Ordered by `sort`; only `active` rows reach the public site.
-- With no active rows the homepage keeps its original static hero.
CREATE TABLE IF NOT EXISTS `slides` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `image`      VARCHAR(255) NOT NULL DEFAULT '',
  `title`      VARCHAR(160) NOT NULL DEFAULT '',
  `subtitle`   VARCHAR(400) NOT NULL DEFAULT '',
  `cta_label`  VARCHAR(60)  NOT NULL DEFAULT '',
  `cta_href`   VARCHAR(255) NOT NULL DEFAULT '',
  `align`      VARCHAR(10)  NOT NULL DEFAULT 'left',   -- left | center
  `overlay`    TINYINT UNSIGNED NOT NULL DEFAULT 55,   -- % darkening over the photo
  `active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_slides_order` (`active`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Slider behaviour (admin-editable on the Website screen).
INSERT IGNORE INTO `settings` (`k`, `v`) VALUES
  ('hero_autoplay_ms', '6000');             -- 0 = no autoplay
