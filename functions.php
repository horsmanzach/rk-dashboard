<?php

//ADD CUSTOM LOGO TO WORDPRESS LOGIN SCREEN
add_action( 'login_enqueue_scripts', 'my_login_logo' );
function my_login_logo() { ?>
    <style type="text/css">
        #login h1 a, .login h1 a {
            background-image: url(<?php echo get_stylesheet_directory_uri(); ?>/images/RK-Logo-V2.png); /*replace file in path*/
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
 * Enqueue Ad Dashboard Scripts and Styles
 * Add this to your child theme's functions.php file
 */

function enqueue_ad_dashboard_assets() {
    // Enqueue GSAP Library from CDN
    wp_enqueue_script(
        'gsap',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
        array(),
        '3.12.5',
        true
    );
    
    // Enqueue Custom Dashboard Script
    wp_enqueue_script(
        'ad-dashboard-script',
        get_stylesheet_directory_uri() . '/js/dashboard-script.js',
        array('gsap'),
        '1.0.1', // Increment version to bust cache
        true
    );
    
    // CRITICAL: Pass PHP variables to JavaScript
    wp_localize_script('ad-dashboard-script', 'dashboardConfig', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('dashboard_nonce'),
        'n8nWebhookUrl' => 'YOUR_ACTUAL_N8N_WEBHOOK_URL_HERE' // Replace with your actual n8n webhook URL
    ));
}
add_action('wp_enqueue_scripts', 'enqueue_ad_dashboard_assets');

// Load in ApexCharets
function enqueue_apexcharts() {
    wp_enqueue_script(
        'apexcharts',
        'https://cdn.jsdelivr.net/npm/apexcharts',
        array(),
        '3.45.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'enqueue_apexcharts');

// ==== Enqueue Charts JS File

function enqueue_dashboard_chart_script() {
    wp_enqueue_script(
        'dashboard-chart',
        get_stylesheet_directory_uri() . '/js/dashboard-charts.js', // Note: dashboard-charts.js with 's'
        array('apexcharts', 'ad-dashboard-script'), // ← Must load AFTER both
        '1.0.3', // Increment to bust cache
        true
    );
    
    // CRITICAL: Pass dashboardConfig to chart script
    wp_localize_script('dashboard-chart', 'dashboardConfig', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('dashboard_nonce')
    ));
}
add_action('wp_enqueue_scripts', 'enqueue_dashboard_chart_script');


/**
 * AJAX endpoint for fetching WKRL data from n8n
 */
function fetch_tvradio_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/wkrl-data', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error',
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error',
            'type' => 'json_error'
        ));
        return;
    }
    
    // Extract orders object
    if (!isset($data['orders'])) {
        wp_send_json_error(array(
            'message' => 'No orders found in response',
            'type' => 'invalid_structure'
        ));
        return;
    }
    
    // Convert orders object to array of orders
    $ordersArray = array_values($data['orders']);
    
    // Validate that we have orders
    if (empty($ordersArray)) {
        wp_send_json_error(array(
            'message' => 'Orders array is empty',
            'type' => 'no_orders'
        ));
        return;
    }
    
    // Validate each order has required fields
    foreach ($ordersArray as $order) {
        if (!isset($order['orderNumber']) || !isset($order['dailyBreakdown']) || !isset($order['totalAds'])) {
            wp_send_json_error(array(
                'message' => 'Invalid order structure',
                'type' => 'invalid_order_structure'
            ));
            return;
        }
    }
    
    // Calculate summary stats across all orders
    $totalAds = 0;
    $earliestDate = null;
    $latestDate = null;
    
    foreach ($ordersArray as $order) {
    $totalAds += $order['totalAds'];
    
    // Convert MM/DD/YY to timestamp for proper comparison
    $startTimestamp = strtotime($order['dateRange']['start']);
    $endTimestamp = strtotime($order['dateRange']['end']);
    
    if (!$earliestDate || $startTimestamp < strtotime($earliestDate)) {
        $earliestDate = $order['dateRange']['start'];
    }
    if (!$latestDate || $endTimestamp > strtotime($latestDate)) {
        $latestDate = $order['dateRange']['end'];
    }
    }
    
    // Return the orders array plus summary stats
    wp_send_json_success(array(
        'orders' => $ordersArray, // Array of 4 separate orders
        'summary' => array(
            'totalAds' => $totalAds,
            'orderCount' => count($ordersArray),
            'dateRange' => array(
                'start' => $earliestDate,
                'end' => $latestDate
            )
        )
    ));
}
add_action('wp_ajax_fetch_tvradio_ads', 'fetch_tvradio_ads_data');
add_action('wp_ajax_nopriv_fetch_tvradio_ads', 'fetch_tvradio_ads_data');

/**
 * AJAX endpoint for fetching WTLA data from n8n
 */
function fetch_wtla_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/wtla-data', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error',
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error',
            'type' => 'json_error'
        ));
        return;
    }
    
    if (!isset($data['orders'])) {
        wp_send_json_error(array(
            'message' => 'No orders found in response',
            'type' => 'invalid_structure'
        ));
        return;
    }
    
    $ordersArray = array_values($data['orders']);
    
    if (empty($ordersArray)) {
        wp_send_json_error(array(
            'message' => 'Orders array is empty',
            'type' => 'no_orders'
        ));
        return;
    }
    
    foreach ($ordersArray as $order) {
        if (!isset($order['orderNumber']) || !isset($order['dailyBreakdown']) || !isset($order['totalAds'])) {
            wp_send_json_error(array(
                'message' => 'Invalid order structure',
                'type' => 'invalid_order_structure'
            ));
            return;
        }
    }
    
    $totalAds = 0;
    $earliestDate = null;
    $latestDate = null;
    
    foreach ($ordersArray as $order) {
    $totalAds += $order['totalAds'];
    
    // Convert MM/DD/YY to timestamp for proper comparison
    $startTimestamp = strtotime($order['dateRange']['start']);
    $endTimestamp = strtotime($order['dateRange']['end']);
    
    if (!$earliestDate || $startTimestamp < strtotime($earliestDate)) {
        $earliestDate = $order['dateRange']['start'];
    }
    if (!$latestDate || $endTimestamp > strtotime($latestDate)) {
        $latestDate = $order['dateRange']['end'];
    }
    }
    
    wp_send_json_success(array(
        'orders' => $ordersArray,
        'summary' => array(
            'totalAds' => $totalAds,
            'orderCount' => count($ordersArray),
            'dateRange' => array(
                'start' => $earliestDate,
                'end' => $latestDate
            )
        )
    ));
}
add_action('wp_ajax_fetch_wtla_ads', 'fetch_wtla_ads_data');
add_action('wp_ajax_nopriv_fetch_wtla_ads', 'fetch_wtla_ads_data');

/**
 * AJAX endpoint for fetching WKTW data from n8n
 */
function fetch_wktw_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/wktw-data', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error',
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error',
            'type' => 'json_error'
        ));
        return;
    }
    
    if (!isset($data['orders'])) {
        wp_send_json_error(array(
            'message' => 'No orders found in response',
            'type' => 'invalid_structure'
        ));
        return;
    }
    
    $ordersArray = array_values($data['orders']);
    
    if (empty($ordersArray)) {
        wp_send_json_error(array(
            'message' => 'Orders array is empty',
            'type' => 'no_orders'
        ));
        return;
    }
    
    foreach ($ordersArray as $order) {
        if (!isset($order['orderNumber']) || !isset($order['dailyBreakdown']) || !isset($order['totalAds'])) {
            wp_send_json_error(array(
                'message' => 'Invalid order structure',
                'type' => 'invalid_order_structure'
            ));
            return;
        }
    }
    
    $totalAds = 0;
    $earliestDate = null;
    $latestDate = null;
    
    foreach ($ordersArray as $order) {
    $totalAds += $order['totalAds'];
    
    // Convert MM/DD/YY to timestamp for proper comparison
    $startTimestamp = strtotime($order['dateRange']['start']);
    $endTimestamp = strtotime($order['dateRange']['end']);
    
    if (!$earliestDate || $startTimestamp < strtotime($earliestDate)) {
        $earliestDate = $order['dateRange']['start'];
    }
    if (!$latestDate || $endTimestamp > strtotime($latestDate)) {
        $latestDate = $order['dateRange']['end'];
    }
    }

    
    wp_send_json_success(array(
        'orders' => $ordersArray,
        'summary' => array(
            'totalAds' => $totalAds,
            'orderCount' => count($ordersArray),
            'dateRange' => array(
                'start' => $earliestDate,
                'end' => $latestDate
            )
        )
    ));
}
add_action('wp_ajax_fetch_wktw_ads', 'fetch_wktw_ads_data');
add_action('wp_ajax_nopriv_fetch_wktw_ads', 'fetch_wktw_ads_data');


/**
 * AJAX endpoint for fetching WZUN data from n8n
 */
function fetch_wzun_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/wzun-data', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error',
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error',
            'type' => 'json_error'
        ));
        return;
    }
    
    if (!isset($data['orders'])) {
        wp_send_json_error(array(
            'message' => 'No orders found in response',
            'type' => 'invalid_structure'
        ));
        return;
    }
    
    $ordersArray = array_values($data['orders']);
    
    if (empty($ordersArray)) {
        wp_send_json_error(array(
            'message' => 'Orders array is empty',
            'type' => 'no_orders'
        ));
        return;
    }
    
    foreach ($ordersArray as $order) {
        if (!isset($order['orderNumber']) || !isset($order['dailyBreakdown']) || !isset($order['totalAds'])) {
            wp_send_json_error(array(
                'message' => 'Invalid order structure',
                'type' => 'invalid_order_structure'
            ));
            return;
        }
    }
    
    $totalAds = 0;
    $earliestDate = null;
    $latestDate = null;
    
    foreach ($ordersArray as $order) {
        $totalAds += $order['totalAds'];
        
        // Convert MM/DD/YY to timestamp for proper comparison
        $startTimestamp = strtotime($order['dateRange']['start']);
        $endTimestamp = strtotime($order['dateRange']['end']);
        
        if (!$earliestDate || $startTimestamp < strtotime($earliestDate)) {
            $earliestDate = $order['dateRange']['start'];
        }
        if (!$latestDate || $endTimestamp > strtotime($latestDate)) {
            $latestDate = $order['dateRange']['end'];
        }
    }
    
    wp_send_json_success(array(
        'orders' => $ordersArray,
        'summary' => array(
            'totalAds' => $totalAds,
            'orderCount' => count($ordersArray),
            'dateRange' => array(
                'start' => $earliestDate,
                'end' => $latestDate
            )
        )
    ));
}
add_action('wp_ajax_fetch_wzun_ads', 'fetch_wzun_ads_data');
add_action('wp_ajax_nopriv_fetch_wzun_ads', 'fetch_wzun_ads_data');


/**
 * AJAX endpoint for fetching Google Ads campaigns from n8n
 */
function fetch_google_ads_campaigns() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/google-ads-campaigns', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        error_log('Google Ads Network Error: ' . $response->get_error_message());
        wp_send_json_error(array(
            'message' => 'Network error: ' . $response->get_error_message(),
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    // LOG THE RAW RESPONSE
    error_log('Google Ads Response Code: ' . $response_code);
    error_log('Google Ads Response Body: ' . $body);
    
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'body' => $body,  // Include the error body
            'type' => 'http_error'
        ));
        return;
    }
    
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('Google Ads JSON Error: ' . json_last_error_msg());
        error_log('Raw body was: ' . $body);
        wp_send_json_error(array(
            'message' => 'JSON error: ' . json_last_error_msg(),
            'raw_response' => substr($body, 0, 500),  // First 500 chars
            'type' => 'json_error'
        ));
        return;
    }
    
    if (!isset($data['campaigns'])) {
        error_log('Google Ads - No campaigns field in response');
        wp_send_json_error(array(
            'message' => 'No campaigns found in response',
            'type' => 'invalid_structure',
            'data' => $data  // Return what we got
        ));
        return;
    }
    
    wp_send_json_success($data);
}
add_action('wp_ajax_fetch_google_ads_campaigns', 'fetch_google_ads_campaigns');
add_action('wp_ajax_nopriv_fetch_google_ads_campaigns', 'fetch_google_ads_campaigns');

/**
 * ======== AJAX endpoint for fetching Google campaign metrics with date range
 */

 function fetch_google_campaign_metrics() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $campaign_id = isset($_POST['campaign_id']) ? sanitize_text_field($_POST['campaign_id']) : '';
    $days = isset($_POST['days']) ? intval($_POST['days']) : 30;
    
    if (empty($campaign_id)) {
        wp_send_json_error(array('message' => 'Campaign ID required'));
        return;
    }
    
    // Build URL with or without days parameter
    $url = 'https://automation.magnawebservices.com/webhook/google-campaign-metrics?campaign_id=' . urlencode($campaign_id);
    
    // If days is -1, it means "All Time" - don't send days parameter
    if ($days !== -1) {
        $url .= '&days=' . $days;
    }
    
    $response = wp_remote_get($url, array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array('message' => 'Network error'));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array('message' => 'JSON error'));
        return;
    }
    
    wp_send_json_success($data);
}
add_action('wp_ajax_fetch_google_campaign_metrics', 'fetch_google_campaign_metrics');
add_action('wp_ajax_nopriv_fetch_google_campaign_metrics', 'fetch_google_campaign_metrics');



/*Fetch Facebook Ads Data*/

function fetch_facebook_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $response = wp_remote_get('https://automation.magnawebservices.com/webhook/facebook-ads-data', array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error',
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error',
            'type' => 'json_error'
        ));
        return;
    }
    
    // Facebook Ads data is simpler - just return the data array
    wp_send_json_success($data);
}
add_action('wp_ajax_fetch_facebook_ads', 'fetch_facebook_ads_data');
add_action('wp_ajax_nopriv_fetch_facebook_ads', 'fetch_facebook_ads_data');


/**
 * AJAX endpoint for fetching Facebook campaign ad sets with time range filter
 */
function fetch_facebook_campaign_adsets_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    $campaign_id = isset($_POST['campaign_id']) ? sanitize_text_field($_POST['campaign_id']) : '';
    $days = isset($_POST['days']) ? intval($_POST['days']) : 30;

    // ADD DEBUG LOGGING
    error_log("📊 Facebook Ad Sets Request - Campaign: {$campaign_id}, Days: {$days}");
    
    if (empty($campaign_id)) {
        wp_send_json_error(array('message' => 'Campaign ID required'));
        return;
    }
    
    // Build the n8n webhook URL with parameters
    $webhook_url = 'https://automation.magnawebservices.com/webhook/facebook-campaign-adsets';
    $webhook_url = add_query_arg(array(
        'campaign_id' => $campaign_id,
        'days' => $days
    ), $webhook_url);
    
    error_log("Fetching Facebook ad sets from: " . $webhook_url);
    
    $response = wp_remote_get($webhook_url, array(
        'timeout' => 30,
        'sslverify' => true,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Network error: ' . $response->get_error_message(),
            'type' => 'network_error'
        ));
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    if ($response_code !== 200) {
        wp_send_json_error(array(
            'message' => 'HTTP error',
            'code' => $response_code,
            'type' => 'http_error'
        ));
        return;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array(
            'message' => 'JSON error: ' . json_last_error_msg(),
            'type' => 'json_error'
        ));
        return;
    }

    // ADD DEBUG INFO TO RESPONSE
    error_log("✅ Successfully processed ad sets data");
    
    // Return the data from n8n
    wp_send_json_success($data);
}
add_action('wp_ajax_fetch_facebook_campaign_adsets', 'fetch_facebook_campaign_adsets_data');
add_action('wp_ajax_nopriv_fetch_facebook_campaign_adsets', 'fetch_facebook_campaign_adsets_data');



/**
 * AJAX endpoint for Google Ads summary (for welcome chart)
 */
function fetch_google_ads_summary() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    // For now, return empty data structure
    // TODO: Fetch and aggregate real Google Ads data
    wp_send_json_success(array(
        'campaigns' => array(),
        'totalSpend' => 0,
        'weeklyData' => array()
    ));
}
add_action('wp_ajax_fetch_google_ads_summary', 'fetch_google_ads_summary');
add_action('wp_ajax_nopriv_fetch_google_ads_summary', 'fetch_google_ads_summary');

/**
 * AJAX endpoint for Facebook Ads summary (for welcome chart)
 */
function fetch_facebook_ads_summary() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    
    // For now, return empty data structure
    // TODO: Fetch and aggregate real Facebook Ads data
    wp_send_json_success(array(
        'campaigns' => array(),
        'totalSpend' => 0,
        'weeklyData' => array()
    ));
}
add_action('wp_ajax_fetch_facebook_ads_summary', 'fetch_facebook_ads_summary');
add_action('wp_ajax_nopriv_fetch_facebook_ads_summary', 'fetch_facebook_ads_summary');


/**
 * Future endpoints for Google and Facebook ads
 */
function fetch_google_ads_data() {
    check_ajax_referer('dashboard_nonce', 'nonce');
    // Redirect to campaigns endpoint
    fetch_google_ads_campaigns();
}
add_action('wp_ajax_fetch_google_ads', 'fetch_google_ads_data');
add_action('wp_ajax_nopriv_fetch_google_ads', 'fetch_google_ads_data');

