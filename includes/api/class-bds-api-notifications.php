<?php
defined('ABSPATH') || exit;

class BDS_API_Notifications extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/notifications', [
            'methods' => 'GET', 'callback' => [$this, 'get_items'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/notifications/unread-count', [
            'methods' => 'GET', 'callback' => [$this, 'unread_count'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/notifications/(?P<id>\d+)/read', [
            'methods' => 'PUT', 'callback' => [$this, 'mark_read'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/notifications/read-all', [
            'methods' => 'POST', 'callback' => [$this, 'mark_all_read'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $uid      = get_current_user_id();
        $page     = max(1, (int) ($request->get_param('page') ?: 1));
        $per_page = min(50, max(1, (int) ($request->get_param('per_page') ?: 20)));
        $offset   = ($page - 1) * $per_page;

        $only_unread = $request->get_param('unread') === '1';
        $where_extra  = $only_unread ? 'AND is_read = 0' : '';

        $total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}bds_notifications WHERE user_id = %d {$where_extra}",
            $uid
        ));

        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_notifications WHERE user_id = %d {$where_extra} ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $uid, $per_page, $offset
        ));

        $response = new WP_REST_Response($items);
        $response->header('X-WP-Total', $total);
        return $response;
    }

    public function unread_count(): WP_REST_Response {
        global $wpdb;
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}bds_notifications WHERE user_id = %d AND is_read = 0",
            get_current_user_id()
        ));
        return new WP_REST_Response(['count' => $count]);
    }

    public function mark_read(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id  = (int) $request['id'];
        $uid = get_current_user_id();

        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}bds_notifications WHERE id = %d AND user_id = %d",
            $id, $uid
        ));
        if (!$item) return $this->not_found();

        $wpdb->update(
            $wpdb->prefix . 'bds_notifications',
            ['is_read' => 1, 'read_at' => current_time('mysql')],
            ['id' => $id, 'user_id' => $uid],
            ['%d', '%s'],
            ['%d', '%d']
        );

        return new WP_REST_Response(['success' => true]);
    }

    public function mark_all_read(): WP_REST_Response {
        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'bds_notifications',
            ['is_read' => 1, 'read_at' => current_time('mysql')],
            ['user_id' => get_current_user_id(), 'is_read' => 0],
            ['%d', '%s'],
            ['%d', '%d']
        );
        return new WP_REST_Response(['success' => true]);
    }
}
