<?php
defined('ABSPATH') || exit;

class BDS_API_Care_Logs extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/care-logs', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/care-logs/(?P<id>\d+)', [
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $customer_id = (int) ($request->get_param('customer_id') ?? 0);
        if (!$customer_id) return $this->bad_request('Thiếu customer_id');
        if (!$this->can_access_customer($customer_id)) return $this->forbidden();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_care_logs WHERE customer_id = %d ORDER BY log_date ASC, id ASC",
            $customer_id
        ));

        $data = array_map(function ($item) {
            $this->enrich_with_user($item, ['created_by' => 'created_by_name']);
            return $item;
        }, $this->format_items($rows));

        return new WP_REST_Response($data);
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $uid = get_current_user_id();
        $customer_id = (int) ($request->get_param('customer_id') ?? 0);
        $content = sanitize_textarea_field($request->get_param('content') ?? '');
        if (!$customer_id || $content === '') return $this->bad_request('Thiếu customer_id hoặc nội dung');
        if (!$this->can_access_customer($customer_id)) return $this->forbidden();

        $data = [
            'customer_id' => $customer_id,
            'log_type'    => sanitize_text_field($request->get_param('log_type') ?? 'note'),
            'content'     => $content,
            'log_date'    => $request->get_param('log_date') ? sanitize_text_field($request->get_param('log_date')) : current_time('mysql'),
            'created_by'  => $uid,
            'created_at'  => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_care_logs', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('care_log', $id, $content);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_care_logs WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, customer_id FROM {$wpdb->prefix}bds_care_logs WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_access_customer((int) $existing->customer_id)) return $this->forbidden();
        $wpdb->delete($wpdb->prefix . 'bds_care_logs', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('care_log', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
