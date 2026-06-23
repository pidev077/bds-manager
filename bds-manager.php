<?php
/**
 * Plugin Name: BDS Manager
 * Description: Hệ thống quản lý bất động sản - CRM cho đại lý
 * Version: 1.0.0
 * Author: BDS Team
 * Text Domain: bds-manager
 */

defined('ABSPATH') || exit;

define('BDS_VERSION', '1.0.0');
define('BDS_PLUGIN_FILE', __FILE__);
define('BDS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BDS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BDS_API_NAMESPACE', 'bds/v1');

require_once BDS_PLUGIN_DIR . 'includes/class-bds-database.php';
require_once BDS_PLUGIN_DIR . 'includes/class-bds-roles.php';
require_once BDS_PLUGIN_DIR . 'includes/class-bds-activity-logger.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-base.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-properties.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-customers.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-needs.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-appointments.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-deposits.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-transactions.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-kpi.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-activity.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-notifications.php';
require_once BDS_PLUGIN_DIR . 'includes/api/class-bds-api-users.php';

register_activation_hook(__FILE__, function () {
    BDS_Database::create_tables();
    BDS_Roles::add_roles();
    update_option('bds_version', BDS_VERSION);
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

add_action('rest_api_init', function () {
    (new BDS_API_Properties())->register_routes();
    (new BDS_API_Customers())->register_routes();
    (new BDS_API_Needs())->register_routes();
    (new BDS_API_Appointments())->register_routes();
    (new BDS_API_Deposits())->register_routes();
    (new BDS_API_Transactions())->register_routes();
    (new BDS_API_KPI())->register_routes();
    (new BDS_API_Activity())->register_routes();
    (new BDS_API_Notifications())->register_routes();
    (new BDS_API_Users())->register_routes();
});

add_action('admin_menu', function () {
    add_menu_page(
        'BDS Manager',
        'BDS Manager',
        'read',
        'bds-manager',
        function () { echo '<div id="bds-root"></div>'; },
        'dashicons-admin-home',
        2
    );
    remove_submenu_page('bds-manager', 'bds-manager');
});

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, 'bds-manager') === false) return;

    $manifest_path = BDS_PLUGIN_DIR . 'assets/dist/.vite/manifest.json';
    $is_dev = !file_exists($manifest_path);

    if ($is_dev) {
        wp_enqueue_script('bds-vite-client', 'http://localhost:5173/@vite/client', [], null, true);
        wp_enqueue_script('bds-app', 'http://localhost:5173/src/main.tsx', [], null, true);
        add_filter('script_loader_tag', function ($tag, $handle) {
            if (in_array($handle, ['bds-vite-client', 'bds-app'])) {
                $tag = str_replace('<script ', '<script type="module" ', $tag);
            }
            return $tag;
        }, 10, 2);
    } else {
        $manifest = json_decode(file_get_contents($manifest_path), true);
        if (!isset($manifest['src/main.tsx'])) return;
        $entry = $manifest['src/main.tsx'];

        if (!empty($entry['css'])) {
            foreach ($entry['css'] as $i => $css) {
                wp_enqueue_style("bds-style-$i", BDS_PLUGIN_URL . 'assets/dist/' . $css, [], BDS_VERSION);
            }
        }
        wp_enqueue_script('bds-app', BDS_PLUGIN_URL . 'assets/dist/' . $entry['file'], [], BDS_VERSION, true);
        add_filter('script_loader_tag', function ($tag, $handle) {
            if ($handle === 'bds-app') {
                $tag = str_replace('<script ', '<script type="module" ', $tag);
            }
            return $tag;
        }, 10, 2);
    }

    $user = wp_get_current_user();
    wp_localize_script('bds-app', 'bdsConfig', [
        'apiUrl'    => rest_url(BDS_API_NAMESPACE),
        'nonce'     => wp_create_nonce('wp_rest'),
        'siteUrl'   => get_site_url(),
        'adminUrl'  => admin_url(),
        'pluginUrl' => BDS_PLUGIN_URL,
        'user'      => [
            'id'         => $user->ID,
            'name'       => $user->display_name,
            'email'      => $user->user_email,
            'roles'      => array_values($user->roles),
            'avatar'     => get_avatar_url($user->ID, ['size' => 64]),
            'is_admin'   => BDS_Roles::is_admin($user->ID),
            'is_manager' => BDS_Roles::is_manager($user->ID),
        ],
    ]);
});

// Full-screen mode for BDS Manager page
add_action('admin_head', function () {
    global $pagenow;
    if ($pagenow !== 'admin.php' || !isset($_GET['page']) || $_GET['page'] !== 'bds-manager') return;
    ?>
    <style>
        #adminmenuwrap, #adminmenuback { display: none !important; }
        #wpcontent { margin-left: 0 !important; }
        #wpbody-content { padding-bottom: 0 !important; }
        .wrap { margin: 0 !important; }
        #wpfooter { display: none !important; }
        #bds-root { min-height: calc(100vh - 32px); background: #f0f2f5; }
    </style>
    <?php
});
