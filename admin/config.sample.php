<?php
/* =========================================================================
   NEJ Autos — Admin configuration
   ------------------------------------------------------------------------
   1. Copy this file to  config.php  (in the same /admin folder).
   2. Fill in your cPanel MySQL database name, user, and password.
      In cPanel → "MySQL Databases" create a database + user and ADD the user
      to the database with ALL PRIVILEGES. Names are usually prefixed with
      your cPanel username, e.g.  cpuser_nejautos  /  cpuser_admin.
   3. Set a long random INSTALL_TOKEN, visit install.php once, then blank it.
   config.php is git-ignored so your credentials never reach GitHub.
   ========================================================================= */

return [
    // ---- Database (cPanel → MySQL Databases) ----
    'db_host' => 'localhost',
    'db_name' => 'CPUSER_nejautos',
    'db_user' => 'CPUSER_admin',
    'db_pass' => 'CHANGE_ME',
    'db_charset' => 'utf8mb4',

    // ---- One-time installer guard ----
    // Any non-empty value here lets api/install.php run. Blank it after setup.
    'install_token' => '',

    // ---- Uploads ----
    // Folder (relative to /admin) where car photos are saved. Must be writable.
    'upload_dir' => 'uploads',
    'max_upload_mb' => 6,

    // ---- Session cookie ----
    'session_name' => 'nej_admin',
    // Set true only if the whole site is served over HTTPS (recommended).
    'cookie_secure' => true,
];
