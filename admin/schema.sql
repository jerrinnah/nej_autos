-- =========================================================================
-- NEJ Autos — Admin database schema (MySQL / MariaDB)
-- Import this once via cPanel → phpMyAdmin (select your database first),
-- or let admin/api/install.php create it for you.
-- =========================================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ---------------------------------------------------------------- admins ---
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(60)  NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name`          VARCHAR(120) NOT NULL DEFAULT 'Administrator',
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'admin',
  `last_login`    DATETIME     NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ cars ---
CREATE TABLE IF NOT EXISTS `cars` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `make`         VARCHAR(80)  NOT NULL,
  `model`        VARCHAR(120) NOT NULL,
  `year`         SMALLINT     NOT NULL DEFAULT 2024,
  `price`        BIGINT       NOT NULL DEFAULT 0,       -- naira, whole units
  `mileage`      INT          NOT NULL DEFAULT 0,       -- km
  `body`         VARCHAR(40)  NOT NULL DEFAULT 'Vehicle',
  `emoji`        VARCHAR(16)  NOT NULL DEFAULT '🚗',
  `bg`           TINYINT      NOT NULL DEFAULT 0,       -- gradient index used by car.js
  `is_ev`        TINYINT(1)   NOT NULL DEFAULT 0,
  `is_premium`   TINYINT(1)   NOT NULL DEFAULT 0,
  `target_bonus` TINYINT(1)   NOT NULL DEFAULT 0,       -- eligible for EV/premium bonus
  `cond_score`   TINYINT      NOT NULL DEFAULT 5,       -- 0..5 reconditioning score
  `inspection`   VARCHAR(40)  NOT NULL DEFAULT 'Certified',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'Available', -- Available | Reserved | Sold | Draft
  `photos`       TEXT         NULL,                     -- comma-separated URLs (consumed by car.js ?imgs=)
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cars_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- partners ---
CREATE TABLE IF NOT EXISTS `partners` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120) NOT NULL,
  `company`       VARCHAR(160) NOT NULL DEFAULT '',
  `email`         VARCHAR(160) NOT NULL DEFAULT '',
  `phone`         VARCHAR(40)  NOT NULL DEFAULT '',
  `referral_code` VARCHAR(60)  NOT NULL DEFAULT '',
  `units`         INT          NOT NULL DEFAULT 0,      -- units this month
  `ytd`           INT          NOT NULL DEFAULT 0,      -- units year to date
  `commission`    BIGINT       NOT NULL DEFAULT 0,      -- naira earned
  `referrals`     INT          NOT NULL DEFAULT 0,
  `shares`        INT          NOT NULL DEFAULT 0,
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'Active', -- Active | Pending | Suspended
  `joined`        DATE         NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_partner_code` (`referral_code`),
  KEY `idx_partner_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------ leads ---
CREATE TABLE IF NOT EXISTS `leads` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer`   VARCHAR(160) NOT NULL,
  `vehicle`    VARCHAR(200) NOT NULL DEFAULT '',
  `car_id`     INT UNSIGNED NULL,
  `phone`      VARCHAR(80)  NOT NULL DEFAULT '',
  `value`      BIGINT       NOT NULL DEFAULT 0,
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'New',     -- New | Contacted | Financing | Won | Lost
  `via_share`  VARCHAR(40)  NULL,                       -- platform if lead came via a share link
  `ref`        VARCHAR(60)  NULL,                       -- referral code of attributing partner
  `note`       TEXT         NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leads_status` (`status`),
  KEY `idx_leads_ref` (`ref`),
  KEY `idx_leads_car` (`car_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- payouts ---
CREATE TABLE IF NOT EXISTS `payouts` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `partner_id` INT UNSIGNED NULL,
  `descr`      VARCHAR(200) NOT NULL DEFAULT 'Commission run',
  `amount`     BIGINT       NOT NULL DEFAULT 0,
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'Pending', -- Pending | Paid | Failed
  `ref`        VARCHAR(60)  NOT NULL DEFAULT '',
  `paid_on`    DATE         NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_status` (`status`),
  KEY `idx_payout_partner` (`partner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------- shares ---
CREATE TABLE IF NOT EXISTS `shares` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `partner_id` INT UNSIGNED NULL,
  `user_id`    INT UNSIGNED NULL,             -- portal user (broker/distributor) who shared
  `car_id`     INT UNSIGNED NULL,
  `link_id`    INT UNSIGNED NULL,             -- tracked link used, when shared from the portal
  `vehicle`    VARCHAR(200) NOT NULL DEFAULT '',
  `platform`   VARCHAR(30)  NOT NULL DEFAULT 'whatsapp',
  `ref`        VARCHAR(60)  NULL,
  `counted`    TINYINT      NOT NULL DEFAULT 0, -- 1 = counted toward the daily reward
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_share_platform` (`platform`),
  KEY `idx_share_partner` (`partner_id`),
  KEY `idx_share_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;
