<?php
define( 'WP_CACHE', false ); // Added by WP Rocket

/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'richardkim_wp18' );

/** Database username */
define( 'DB_USER', 'richardkim_wp18' );

/** Database password */
define( 'DB_PASSWORD', '8S!Xpy56.6' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'bqs2xl9axwq1ccgt4kwpqo7xikqyturns3akgt4ftd3llqua7tksncwvuzaytk72' );
define( 'SECURE_AUTH_KEY',  '4pngj2i6ybohftlex3bla1wit84rq7cyqzcycyynne87ndffdaua29zr9kttyggl' );
define( 'LOGGED_IN_KEY',    'r1s0mnna29g49rc31u0lkaltd4gp5eqtoaeh1o0t1yiuvtkpvsq4jvctdddczdxm' );
define( 'NONCE_KEY',        'j8a0a6k0bkiaj0iejvfyleiwgg5zhf3cpx10vgyp9zgklxuebn3g5dw5bifkq4lk' );
define( 'AUTH_SALT',        'iqa6qlfx2bt8skj4eapzvah41g1zuwpftuutcfuyomnjssnk4xip0w60kvw5in4c' );
define( 'SECURE_AUTH_SALT', 'ebxqx8cuqkdq11pqxczkphqsfqlcmehuqpumu9ci7vkl474izsmeiblqtjn8rgar' );
define( 'LOGGED_IN_SALT',   'kttzsiwsllf48jc77ogxnszd3jpjmd3soxhnxjsfugjya7vfzvjjrrac8ehwyuvm' );
define( 'NONCE_SALT',       'hcsy5ztlz4fuqc5qsxoahtrcn8hgifmpbuqfw1uzhguqecg2n3lvnlgul6sii0xk' );
define( 'RK_CACHE_SECRET', 'random-long-string-for-cache' );
/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp4i_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */


/* Add any custom values between this line and the "stop editing" line. */

define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
@ini_set( 'display_errors', 0 );

// Add this line - specify exact path
define( 'WP_DEBUG_LOG', ABSPATH . 'wp-content/debug.log' );
/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
