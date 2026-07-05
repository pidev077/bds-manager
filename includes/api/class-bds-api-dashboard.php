<?php
defined('ABSPATH') || exit;

class BDS_API_Dashboard extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/dashboard/stats', [
            'methods' => 'GET', 'callback' => [$this, 'get_stats'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
    }

    public function get_stats(): WP_REST_Response {
        global $wpdb;
        $uid       = get_current_user_id();
        $is_priv   = BDS_Roles::is_admin($uid) || BDS_Roles::is_manager($uid);
        $today     = current_time('Y-m-d');
        $p         = $wpdb->prefix;
        $own_sql   = ' AND (assigned_to = %d OR created_by = %d)';

        $primary_count   = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$p}bds_properties WHERE fund_type = 'F0'");
        $secondary_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$p}bds_properties WHERE fund_type != 'F0' OR fund_type IS NULL");
        $total_properties = $primary_count + $secondary_count;
        $available_count  = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$p}bds_properties WHERE status = 'available'");
        $cancelled_count  = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$p}bds_properties WHERE status = 'cancelled'");
        $sold_count       = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$p}bds_properties WHERE status = 'sold'");

        $new_today_items = $wpdb->get_results($wpdb->prepare(
            "SELECT id, code, unit_number, title, project_name, status, price, updated_at
             FROM {$p}bds_properties WHERE DATE(created_at) = %s OR DATE(updated_at) = %s
             ORDER BY updated_at DESC LIMIT 5",
            $today, $today
        ));
        $new_today_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_properties WHERE DATE(created_at) = %s OR DATE(updated_at) = %s",
            $today, $today
        ));

        $needs_sql = "SELECT n.id, n.title, n.processing_status, n.activity_status, n.customer_id, c.full_name AS customer_name
                      FROM {$p}bds_needs n LEFT JOIN {$p}bds_customers c ON c.id = n.customer_id
                      WHERE n.activity_status = 'active'" . (!$is_priv ? $own_sql : '') . "
                      ORDER BY n.created_at DESC LIMIT 5";
        $needs_count_sql = "SELECT COUNT(*) FROM {$p}bds_needs WHERE activity_status = 'active'" . (!$is_priv ? $own_sql : '');

        if ($is_priv) {
            $needs_items = $wpdb->get_results($needs_sql);
            $needs_pending_count = (int) $wpdb->get_var($needs_count_sql);
        } else {
            $needs_items = $wpdb->get_results($wpdb->prepare($needs_sql, $uid, $uid));
            $needs_pending_count = (int) $wpdb->get_var($wpdb->prepare($needs_count_sql, $uid, $uid));
        }

        $appt_sql = "SELECT a.id, a.type, a.status, a.appointment_date, a.customer_id, c.full_name AS customer_name
                     FROM {$p}bds_appointments a LEFT JOIN {$p}bds_customers c ON c.id = a.customer_id
                     WHERE DATE(a.appointment_date) = %s" . (!$is_priv ? $own_sql : '') . "
                     ORDER BY a.appointment_date ASC LIMIT 5";
        $appt_count_sql = "SELECT COUNT(*) FROM {$p}bds_appointments WHERE DATE(appointment_date) = %s" . (!$is_priv ? $own_sql : '');

        if ($is_priv) {
            $appt_items = $wpdb->get_results($wpdb->prepare($appt_sql, $today));
            $appointments_today_count = (int) $wpdb->get_var($wpdb->prepare($appt_count_sql, $today));
        } else {
            $appt_items = $wpdb->get_results($wpdb->prepare($appt_sql, $today, $uid, $uid));
            $appointments_today_count = (int) $wpdb->get_var($wpdb->prepare($appt_count_sql, $today, $uid, $uid));
        }

        return new WP_REST_Response([
            'primary_count'             => $primary_count,
            'secondary_count'           => $secondary_count,
            'total_properties'          => $total_properties,
            'available_count'           => $available_count,
            'cancelled_count'           => $cancelled_count,
            'sold_count'                => $sold_count,
            'new_today_count'           => $new_today_count,
            'new_today_items'           => $this->format_items($new_today_items),
            'needs_pending_count'       => $needs_pending_count,
            'needs_pending_items'       => $this->format_items($needs_items),
            'appointments_today_count'  => $appointments_today_count,
            'appointments_today_items' => $this->format_items($appt_items),
        ]);
    }
}
