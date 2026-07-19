<?php

//ADD CUSTOM LOGO TO WORDPRESS LOGIN SCREEN
add_action( 'login_enqueue_scripts', 'my_login_logo' );
function my_login_logo() { ?>
    <style type="text/css">
        #login h1 a, .login h1 a {
            background-image: url(<?php echo get_stylesheet_directory_uri(); ?>/images/RK-Logo-V2.png);
            padding-bottom: 15px;
            background-size: 200px;
            background-position: center center;
            width: 200px;
        }
    </style>
<?php }

add_filter( 'login_headerurl', 'my_login_logo_url' );
function my_login_logo_url() {
    return home_url();
}

add_filter( 'login_headertitle', 'my_login_logo_url_title' );
function my_login_logo_url_title() {
    return 'Richard Kim MD';
}

/**
 * Redirect non-logged-in users away from the dashboard page
 */
function rk_protect_dashboard_page() {
    if ( is_page( 'dashboard' ) && ! is_user_logged_in() ) {
        wp_redirect( wp_login_url( get_permalink() ) );
        exit;
    }
}
add_action( 'template_redirect', 'rk_protect_dashboard_page' );

/**
 * Redirect all users to dashboard after login
 */
function rk_login_redirect( $redirect_to, $request, $user ) {
    return 'https://dashboard.richardkimmedicine.com/dashboard';
}
add_filter( 'login_redirect', 'rk_login_redirect', 10, 3 );


/**
 * Enqueue Ad Dashboard Scripts and Styles
 */
function enqueue_ad_dashboard_assets() {

    // GSAP from CDN
    wp_enqueue_script(
        'gsap',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
        array(),
        '3.12.5',
        true
    );

    // Main dashboard script
    // VERSION BUMPED: 1.1.7 -> 1.1.8 (sidebar update)
    wp_enqueue_script(
        'ad-dashboard-script',
        get_stylesheet_directory_uri() . '/js/dashboard-script.js',
        array('gsap'),
        '1.2.5',
        true
    );

    // Pass PHP variables to JS
    // displayName added: populates sidebar footer with logged-in user's name
    wp_localize_script( 'ad-dashboard-script', 'dashboardConfig', array(
        'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
        'nonce'         => wp_create_nonce( 'dashboard_nonce' ),
        'n8nWebhookUrl' => 'YOUR_ACTUAL_N8N_WEBHOOK_URL_HERE',
        'displayName'   => is_user_logged_in() ? wp_get_current_user()->display_name : '',
    ) );
}
add_action( 'wp_enqueue_scripts', 'enqueue_ad_dashboard_assets' );


function enqueue_apexcharts() {
    wp_enqueue_script(
        'apexcharts',
        'https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js',
        array(),
        '3.46.0',
        true
    );
}
add_action( 'wp_enqueue_scripts', 'enqueue_apexcharts' );


// Chart script
// VERSION BUMPED: 1.4.6 -> 1.4.7 (sidebar update)
function enqueue_dashboard_chart_script() {
    wp_enqueue_script(
        'dashboard-chart',
        get_stylesheet_directory_uri() . '/js/dashboard-charts.js',
        array( 'apexcharts', 'ad-dashboard-script' ),
        '1.5.1',
        true
    );

    wp_localize_script( 'dashboard-chart', 'dashboardConfig', array(
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'nonce'   => wp_create_nonce( 'dashboard_nonce' ),
		'displayName' => is_user_logged_in() ? wp_get_current_user()->display_name : '',
    ) );
}
add_action( 'wp_enqueue_scripts', 'enqueue_dashboard_chart_script' );


/**
 * Attribution Panel JS
 */
function enqueue_attribution_panel_script() {
    if ( ! is_page( 'dashboard' ) ) return;

    wp_enqueue_script(
        'attribution-panel',
        get_stylesheet_directory_uri() . '/js/attribution-panel.js',
        array( 'jquery', 'apexcharts', 'ad-dashboard-script' ),
        '1.2.0',
        true
    );
}
add_action( 'wp_enqueue_scripts', 'enqueue_attribution_panel_script' );


/**
 * Navbar JS — sidebar collapse, active states, username injection
 * Must load after ad-dashboard-script so navigateToSlide() exists to patch.
 */
function enqueue_navbar_script() {
    if ( ! is_page( 'dashboard' ) ) return;

    wp_enqueue_script(
        'rk-navbar',
        get_stylesheet_directory_uri() . '/js/navbar.js',
        array( 'gsap', 'ad-dashboard-script' ),
        '1.0.2',
        true
    );
}
add_action( 'wp_enqueue_scripts', 'enqueue_navbar_script' );


// =============================================================================
// SERVER-SIDE CACHE — Write Endpoint (called by n8n nightly workflow)
// =============================================================================

function rk_cache_allowed_keys() {
    return array(
        'rk_cache_google_ads',
        'rk_cache_meta_ads',
        'rk_cache_wtla',
        'rk_cache_wkrl',
        'rk_cache_wktw',
        'rk_cache_wzun',
        'rk_cache_new_patients',
    );
}

add_action( 'wp_ajax_nopriv_rk_set_dashboard_cache', 'rk_set_dashboard_cache' );
add_action( 'wp_ajax_rk_set_dashboard_cache',        'rk_set_dashboard_cache' );

function rk_set_dashboard_cache() {
    $secret = isset( $_POST['secret'] ) ? sanitize_text_field( $_POST['secret'] ) : '';
    if ( ! defined( 'RK_CACHE_SECRET' ) || ! hash_equals( RK_CACHE_SECRET, $secret ) ) {
        wp_send_json_error( array( 'message' => 'Unauthorized' ), 401 );
        return;
    }

    $cache_key = isset( $_POST['cache_key'] ) ? sanitize_text_field( $_POST['cache_key'] ) : '';
    if ( ! in_array( $cache_key, rk_cache_allowed_keys(), true ) ) {
        wp_send_json_error( array( 'message' => 'Invalid cache_key: ' . $cache_key ) );
        return;
    }

    $payload_raw = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';
    $payload     = json_decode( $payload_raw, true );
    if ( json_last_error() !== JSON_ERROR_NONE || empty( $payload ) ) {
        wp_send_json_error( array( 'message' => 'Invalid or empty payload JSON: ' . json_last_error_msg() ) );
        return;
    }

    $expiry = 25 * HOUR_IN_SECONDS;
    $stored = set_transient( $cache_key, $payload, $expiry );
    set_transient( $cache_key . '_cached_at', current_time( 'mysql' ), $expiry );

    if ( $stored ) {
        wp_send_json_success( array( 'message' => 'Cache set: ' . $cache_key, 'cached_at' => current_time( 'mysql' ) ) );
    } else {
        wp_send_json_error( array( 'message' => 'set_transient failed for: ' . $cache_key ) );
    }
}


// =============================================================================
// SERVER-SIDE CACHE — Status Endpoint
// =============================================================================

add_action( 'wp_ajax_rk_get_cache_status',        'rk_get_cache_status' );
add_action( 'wp_ajax_nopriv_rk_get_cache_status', 'rk_get_cache_status' );

function rk_get_cache_status() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $status = array();
    foreach ( rk_cache_allowed_keys() as $key ) {
        $cached_at      = get_transient( $key . '_cached_at' );
        $status[ $key ] = array(
            'cached'    => ( $cached_at !== false ),
            'cached_at' => $cached_at ? $cached_at : null,
        );
    }
    wp_send_json_success( $status );
}


// =============================================================================
// AJAX ENDPOINTS — Station data
// =============================================================================

function fetch_tvradio_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_wkrl' );
    if ( $cached !== false ) {
        $ordersArray = array_values( $cached['orders'] );
        $totalAds = 0; $earliestDate = null; $latestDate = null;
        foreach ( $ordersArray as $order ) {
            $totalAds += $order['totalAds'];
            $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
            if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
            if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
        }
        wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
        return;
    }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/wkrl-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['orders'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'json_error' ) ); return; }
    $ordersArray = array_values( $data['orders'] );
    $totalAds = 0; $earliestDate = null; $latestDate = null;
    foreach ( $ordersArray as $order ) {
        $totalAds += $order['totalAds'];
        $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
        if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
        if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
    }
    wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
}
add_action( 'wp_ajax_fetch_tvradio_ads',        'fetch_tvradio_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_tvradio_ads', 'fetch_tvradio_ads_data' );


function fetch_wtla_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_wtla' );
    if ( $cached !== false ) {
        $ordersArray = array_values( $cached['orders'] );
        $totalAds = 0; $earliestDate = null; $latestDate = null;
        foreach ( $ordersArray as $order ) {
            $totalAds += $order['totalAds'];
            $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
            if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
            if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
        }
        wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
        return;
    }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/wtla-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['orders'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'json_error' ) ); return; }
    $ordersArray = array_values( $data['orders'] );
    $totalAds = 0; $earliestDate = null; $latestDate = null;
    foreach ( $ordersArray as $order ) {
        $totalAds += $order['totalAds'];
        $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
        if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
        if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
    }
    wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
}
add_action( 'wp_ajax_fetch_wtla_ads',        'fetch_wtla_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_wtla_ads', 'fetch_wtla_ads_data' );


function fetch_wktw_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_wktw' );
    if ( $cached !== false ) {
        $ordersArray = array_values( $cached['orders'] );
        $totalAds = 0; $earliestDate = null; $latestDate = null;
        foreach ( $ordersArray as $order ) {
            $totalAds += $order['totalAds'];
            $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
            if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
            if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
        }
        wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
        return;
    }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/wktw-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['orders'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'json_error' ) ); return; }
    $ordersArray = array_values( $data['orders'] );
    $totalAds = 0; $earliestDate = null; $latestDate = null;
    foreach ( $ordersArray as $order ) {
        $totalAds += $order['totalAds'];
        $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
        if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
        if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
    }
    wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
}
add_action( 'wp_ajax_fetch_wktw_ads',        'fetch_wktw_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_wktw_ads', 'fetch_wktw_ads_data' );


function fetch_wzun_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_wzun' );
    if ( $cached !== false ) {
        $ordersArray = array_values( $cached['orders'] );
        $totalAds = 0; $earliestDate = null; $latestDate = null;
        foreach ( $ordersArray as $order ) {
            $totalAds += $order['totalAds'];
            $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
            if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
            if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
        }
        wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
        return;
    }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/wzun-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['orders'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'json_error' ) ); return; }
    $ordersArray = array_values( $data['orders'] );
    $totalAds = 0; $earliestDate = null; $latestDate = null;
    foreach ( $ordersArray as $order ) {
        $totalAds += $order['totalAds'];
        $s = strtotime( $order['dateRange']['start'] ); $e = strtotime( $order['dateRange']['end'] );
        if ( !$earliestDate || $s < strtotime( $earliestDate ) ) $earliestDate = $order['dateRange']['start'];
        if ( !$latestDate   || $e > strtotime( $latestDate ) )   $latestDate   = $order['dateRange']['end'];
    }
    wp_send_json_success( array( 'orders' => $ordersArray, 'summary' => array( 'totalAds' => $totalAds, 'orderCount' => count( $ordersArray ), 'dateRange' => array( 'start' => $earliestDate, 'end' => $latestDate ) ) ) );
}
add_action( 'wp_ajax_fetch_wzun_ads',        'fetch_wzun_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_wzun_ads', 'fetch_wzun_ads_data' );


// =============================================================================
// AJAX ENDPOINTS — Google Ads
// =============================================================================

function fetch_google_ads_campaigns() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_google_ads' );
    if ( $cached !== false ) { wp_send_json_success( $cached ); return; }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/google-ads-campaigns', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error: ' . $response->get_error_message(), 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );
    error_log( 'Google Ads Response Code: ' . $code );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'body' => $body, 'type' => 'http_error' ) ); return; }
    $data = json_decode( $body, true );
    if ( json_last_error() !== JSON_ERROR_NONE ) { wp_send_json_error( array( 'message' => 'JSON error: ' . json_last_error_msg(), 'type' => 'json_error' ) ); return; }
    if ( !isset( $data['campaigns'] ) ) { wp_send_json_error( array( 'message' => 'No campaigns found', 'type' => 'invalid_structure', 'data' => $data ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_google_ads_campaigns',        'fetch_google_ads_campaigns' );
add_action( 'wp_ajax_nopriv_fetch_google_ads_campaigns', 'fetch_google_ads_campaigns' );


function fetch_google_campaign_metrics() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $campaign_id = isset( $_POST['campaign_id'] ) ? sanitize_text_field( $_POST['campaign_id'] ) : '';
    $days        = isset( $_POST['days'] )        ? intval( $_POST['days'] )                      : 30;
    if ( empty( $campaign_id ) ) { wp_send_json_error( array( 'message' => 'Campaign ID required' ) ); return; }
    $url = 'https://automation.magnawebservices.com/webhook/google-campaign-metrics?campaign_id=' . urlencode( $campaign_id );
    if ( $days !== -1 ) $url .= '&days=' . $days;
    $response = wp_remote_get( $url, array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE ) { wp_send_json_error( array( 'message' => 'JSON error' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_google_campaign_metrics',        'fetch_google_campaign_metrics' );
add_action( 'wp_ajax_nopriv_fetch_google_campaign_metrics', 'fetch_google_campaign_metrics' );


function fetch_google_ads_summary() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_google_ads' );
    if ( $cached !== false ) { wp_send_json_success( $cached ); return; }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/google-ads-campaigns', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['campaigns'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'invalid_structure' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_google_ads_summary',        'fetch_google_ads_summary' );
add_action( 'wp_ajax_nopriv_fetch_google_ads_summary', 'fetch_google_ads_summary' );


// =============================================================================
// AJAX ENDPOINTS — Meta / Facebook Ads
// =============================================================================

function fetch_facebook_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_meta_ads' );
    if ( $cached !== false ) { wp_send_json_success( $cached ); return; }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/facebook-ads-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE ) { wp_send_json_error( array( 'message' => 'JSON error', 'type' => 'json_error' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_facebook_ads',        'fetch_facebook_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_facebook_ads', 'fetch_facebook_ads_data' );


function fetch_facebook_campaign_adsets_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $campaign_id = isset( $_POST['campaign_id'] ) ? sanitize_text_field( $_POST['campaign_id'] ) : '';
    $days        = isset( $_POST['days'] )        ? intval( $_POST['days'] )                      : 30;
    error_log( "Facebook Ad Sets Request - Campaign: {$campaign_id}, Days: {$days}" );
    if ( empty( $campaign_id ) ) { wp_send_json_error( array( 'message' => 'Campaign ID required' ) ); return; }
    $webhook_url = add_query_arg( array( 'campaign_id' => $campaign_id, 'days' => $days ), 'https://automation.magnawebservices.com/webhook/facebook-campaign-adsets' );
    $response = wp_remote_get( $webhook_url, array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error: ' . $response->get_error_message(), 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE ) { wp_send_json_error( array( 'message' => 'JSON error: ' . json_last_error_msg(), 'type' => 'json_error' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_facebook_campaign_adsets',        'fetch_facebook_campaign_adsets_data' );
add_action( 'wp_ajax_nopriv_fetch_facebook_campaign_adsets', 'fetch_facebook_campaign_adsets_data' );


function fetch_facebook_ads_summary() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_meta_ads' );
    if ( $cached !== false ) { wp_send_json_success( $cached ); return; }
    $response = wp_remote_get( 'https://automation.magnawebservices.com/webhook/facebook-ads-data', array( 'timeout' => 30, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error', 'type' => 'network_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE || !isset( $data['campaigns'] ) ) { wp_send_json_error( array( 'message' => 'Invalid response', 'type' => 'invalid_structure' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_facebook_ads_summary',        'fetch_facebook_ads_summary' );
add_action( 'wp_ajax_nopriv_fetch_facebook_ads_summary', 'fetch_facebook_ads_summary' );


// =============================================================================
// AJAX ENDPOINTS — New Patient Leads
// =============================================================================

add_action( 'wp_ajax_fetch_new_patients',        'fetch_new_patients_callback' );
add_action( 'wp_ajax_nopriv_fetch_new_patients', 'fetch_new_patients_callback' );

function fetch_new_patients_callback() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $cached = get_transient( 'rk_cache_new_patients' );
    if ( $cached !== false ) { wp_send_json_success( $cached ); return; }
    $response = wp_remote_post( 'https://automation.magnawebservices.com/webhook/new-patients', array(
        'timeout' => 30,
        'headers' => array( 'Content-Type' => 'application/json' ),
        'body'    => json_encode( array() ),
    ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( 'Webhook request failed: ' . $response->get_error_message() ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( ! $data ) { wp_send_json_error( 'Invalid JSON response from webhook' ); return; }
    wp_send_json_success( $data );
}


// =============================================================================
// AJAX ENDPOINTS — Commercial Attribution
// =============================================================================

function fetch_commercial_attribution() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    $date    = isset( $_POST['date'] )    ? sanitize_text_field( $_POST['date'] )    : '';
    $station = isset( $_POST['station'] ) ? sanitize_text_field( $_POST['station'] ) : '';
    if ( empty( $date ) || empty( $station ) ) { wp_send_json_error( array( 'message' => 'Date and station are required', 'type' => 'missing_params' ) ); return; }
    $webhook_url = add_query_arg( array( 'date' => $date, 'station' => $station ), 'https://automation.magnawebservices.com/webhook/ga4-attribution' );
    $response = wp_remote_get( $webhook_url, array( 'timeout' => 60, 'sslverify' => true, 'headers' => array( 'Accept' => 'application/json' ) ) );
    if ( is_wp_error( $response ) ) { wp_send_json_error( array( 'message' => 'Network error: ' . $response->get_error_message(), 'type' => 'network_error' ) ); return; }
    $code = wp_remote_retrieve_response_code( $response );
    if ( $code !== 200 ) { wp_send_json_error( array( 'message' => 'HTTP error', 'code' => $code, 'type' => 'http_error' ) ); return; }
    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( json_last_error() !== JSON_ERROR_NONE ) { wp_send_json_error( array( 'message' => 'JSON error: ' . json_last_error_msg(), 'type' => 'json_error' ) ); return; }
    wp_send_json_success( $data );
}
add_action( 'wp_ajax_fetch_commercial_attribution',        'fetch_commercial_attribution' );
add_action( 'wp_ajax_nopriv_fetch_commercial_attribution', 'fetch_commercial_attribution' );


/**
 * Alias — redirects to campaigns endpoint
 */
function fetch_google_ads_data() {
    check_ajax_referer( 'dashboard_nonce', 'nonce' );
    fetch_google_ads_campaigns();
}
add_action( 'wp_ajax_fetch_google_ads',        'fetch_google_ads_data' );
add_action( 'wp_ajax_nopriv_fetch_google_ads', 'fetch_google_ads_data' );

