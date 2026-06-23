<?php
defined('ABSPATH') || exit;

class BDS_API_Activity extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/activity', [
            'methods' => 'GET', 'callback' => [$this, 'get_items'],
            'permission_callback' => [$this, 'admin_permission'],
        ]);
        register_rest_route($ns, '/activity/me', [
            'methods' => 'GET', 'callback' => [$this, 'get_my_activity'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/activity/track', [
            'methods' => 'POST', 'callback' => [$this, 'track'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $where = []; $vals = [];

        if ($request->get_param('user_id')) {
            $where[] = 'l.user_id = %d';
            $vals[]  = (int) $request->get_param('user_id');
        }

        if ($request->get_param('action')) {
            $where[] = 'l.action = %s';
            $vals[]  = sanitize_text_field($request->get_param('action'));
        }

        if ($request->get_param('object_type')) {
            $where[] = 'l.object_type = %s';
            $vals[]  = sanitize_text_field($request->get_param('object_type'));
        }

        if ($request->get_param('date_from')) {
            $where[] = 'l.created_at >= %s';
            $vals[]  = sanitize_text_field($request->get_param('date_from')) . ' 00:00:00';
        }

        if ($request->get_param('date_to')) {
            $where[] = 'l.created_at <= %s';
            $vals[]  = sanitize_text_field($request->get_param('date_to')) . ' 23:59:59';
        }

        $where_sql = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);
        $page      = max(1, (int) ($request->get_param('page') ?: 1));
        $per_page  = min(100, max(1, (int) ($request->get_param('per_page') ?: 20)));
        $offset    = ($page - 1) * $per_page;

        $count_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}bds_activity_logs l {$where_sql}";
        $total     = (int) (!empty($vals) ? $wpdb->get_var($wpdb->prepare($count_sql, ...$vals)) : $wpdb->get_var($count_sql));

        $data_sql = "SELECT l.*, u.display_name as user_name
                     FROM {$wpdb->prefix}bds_activity_logs l
                     LEFT JOIN {$wpdb->users} u ON u.ID = l.user_id
                     {$where_sql}
                     ORDER BY l.created_at DESC
                     LIMIT %d OFFSET %d";

        $query_vals = array_merge($vals, [$per_page, $offset]);
        $items = !empty($query_vals) ? $wpdb->get_results($wpdb->prepare($data_sql, ...$query_vals)) : $wpdb->get_results($data_sql);

        $items = array_map(function ($item) {
            $item->id         = (int) $item->id;
            $item->user_id    = (int) $item->user_id;
            $item->object_id  = (int) $item->object_id;
            $item->action_label = BDS_Activity_Logger::get_action_label($item->action);
            return $item;
        }, $items);

        $response = new WP_REST_Response($items);
        $response->header('X-WP-Total', $total);
        $response->header('X-WP-TotalPages', (int) ceil($total / $per_page));
        return $response;
    }

    public function get_my_activity(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $uid = get_current_user_id();
        $page     = max(1, (int) ($request->get_param('page') ?: 1));
        $per_page = min(50, max(1, (int) ($request->get_param('per_page') ?: 10)));
        $offset   = ($page - 1) * $per_page;

        $total = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bds_activity_logs WHERE user_id = %d", $uid));
        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_activity_logs WHERE user_id = %d ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $uid, $per_page, $offset
        ));

        $items = array_map(function ($item) {
            $item->id = (int) $item->id;
            $item->action_label = BDS_Activity_Logger::get_action_label($item->action);
            return $item;
        }, $items);

        $response = new WP_REST_Response($items);
        $response->header('X-WP-Total', $total);
        return $response;
    }

    public function track(WP_REST_Request $request): WP_REST_Response {
        $action = sanitize_text_field($request->get_param('action') ?? 'page_view');
        $object_type = sanitize_text_field($request->get_param('object_type') ?? '');
        $object_id = (int) ($request->get_param('object_id') ?? 0);
        $desc = sanitize_text_field($request->get_param('description') ?? '');

        $id = BDS_Activity_Logger::log($action, $desc, $object_type, $object_id);
        return new WP_REST_Response(['logged' => true, 'id' => $id]);
    }
}
