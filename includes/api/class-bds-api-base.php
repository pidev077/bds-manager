<?php
defined('ABSPATH') || exit;

abstract class BDS_API_Base {

    protected $namespace = BDS_API_NAMESPACE;
    protected $rest_base = '';

    protected function auth_check(): bool {
        return is_user_logged_in();
    }

    public function permission_callback(): bool {
        return $this->auth_check();
    }

    public function admin_permission(): bool {
        return BDS_Roles::is_admin();
    }

    public function manager_permission(): bool {
        return BDS_Roles::is_manager();
    }

    protected function paginate(WP_REST_Request $request, string $table, array $where_parts, array $values, string $extra_sql = '', string $select = '*'): WP_REST_Response {
        global $wpdb;

        $page     = max(1, (int) $request->get_param('page') ?: 1);
        $per_page = min(100, max(1, (int) $request->get_param('per_page') ?: 20));
        $offset   = ($page - 1) * $per_page;

        $where_sql = empty($where_parts) ? '' : 'WHERE ' . implode(' AND ', $where_parts);

        $count_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}{$table} {$where_sql}";
        $total     = (int) (!empty($values) ? $wpdb->get_var($wpdb->prepare($count_sql, ...$values)) : $wpdb->get_var($count_sql));

        $data_sql  = "SELECT {$select} FROM {$wpdb->prefix}{$table} {$where_sql} {$extra_sql} LIMIT %d OFFSET %d";
        $query_values = array_merge($values, [$per_page, $offset]);
        $items     = !empty($query_values) ? $wpdb->get_results($wpdb->prepare($data_sql, ...$query_values)) : $wpdb->get_results($data_sql);

        $response = new WP_REST_Response($this->format_items($items));
        $response->header('X-WP-Total', $total);
        $response->header('X-WP-TotalPages', (int) ceil($total / $per_page));
        $response->header('X-WP-Page', $page);
        $response->header('X-WP-PerPage', $per_page);

        return $response;
    }

    protected function format_items(array $items): array {
        return array_map([$this, 'format_item'], $items);
    }

    protected function format_item($item): array {
        $data = (array) $item;
        foreach (['images', 'metadata', 'documents'] as $key) {
            if (isset($data[$key]) && is_string($data[$key])) {
                $decoded = json_decode($data[$key], true);
                $data[$key] = is_array($decoded) ? $decoded : null;
            }
        }
        foreach (['id', 'customer_id', 'property_id', 'need_id', 'created_by', 'updated_by', 'assigned_to'] as $int_key) {
            if (isset($data[$int_key])) $data[$int_key] = (int) $data[$int_key];
        }
        return $data;
    }

    protected function enrich_with_user(array &$item, array $user_fields): void {
        foreach ($user_fields as $field => $label_field) {
            if (!empty($item[$field])) {
                $u = get_userdata((int) $item[$field]);
                $item[$label_field] = $u ? $u->display_name : '';
            }
        }
    }

    protected function not_found(): WP_Error {
        return new WP_Error('not_found', 'Không tìm thấy dữ liệu', ['status' => 404]);
    }

    protected function forbidden(): WP_Error {
        return new WP_Error('forbidden', 'Không có quyền truy cập', ['status' => 403]);
    }

    protected function bad_request(string $msg): WP_Error {
        return new WP_Error('bad_request', $msg, ['status' => 400]);
    }

    protected function search_where(string $search, array $columns): array {
        if (empty($search)) return [[], []];
        $parts = [];
        $values = [];
        foreach ($columns as $col) {
            $parts[] = "{$col} LIKE %s";
            $values[] = '%' . $search . '%';
        }
        return ['(' . implode(' OR ', $parts) . ')', $values];
    }

    protected function send_notification(int $user_id, string $type, string $title, string $message, string $object_type = '', int $object_id = 0): void {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'bds_notifications',
            [
                'user_id'     => $user_id,
                'type'        => $type,
                'title'       => $title,
                'message'     => $message,
                'object_type' => $object_type,
                'object_id'   => $object_id,
                'created_at'  => current_time('mysql'),
            ],
            ['%d', '%s', '%s', '%s', '%s', '%d', '%s']
        );
    }

    protected function notify_all_users(string $type, string $title, string $message, string $object_type = '', int $object_id = 0): void {
        $users = get_users(['fields' => 'ID', 'number' => 500]);
        foreach ($users as $uid) {
            if ((int) $uid !== get_current_user_id()) {
                $this->send_notification((int) $uid, $type, $title, $message, $object_type, $object_id);
            }
        }
    }
}
