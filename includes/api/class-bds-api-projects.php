<?php
defined('ABSPATH') || exit;

class BDS_API_Projects extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/projects', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'write_permission']],
        ]);
        register_rest_route($ns, '/projects/(?P<id>\d+)', [
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'write_permission']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'write_permission']],
        ]);
    }

    public function write_permission(): bool {
        return $this->auth_check() && BDS_Roles::is_manager();
    }

    public function get_items(): WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT p.id, p.name, p.created_at,
                    (SELECT COUNT(*) FROM {$wpdb->prefix}bds_properties pr WHERE pr.project_name = p.name) AS property_count
             FROM {$wpdb->prefix}bds_projects p
             ORDER BY p.name ASC"
        );
        $data = array_map(function ($item) {
            $item->id = (int) $item->id;
            $item->property_count = (int) $item->property_count;
            return $item;
        }, $rows);
        return new WP_REST_Response($data);
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $name = sanitize_text_field($request->get_param('name') ?? '');
        if ($name === '') return $this->bad_request('Tên dự án không được để trống');

        if ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_projects WHERE name = %s", $name))) {
            return $this->bad_request('Dự án này đã tồn tại');
        }

        $wpdb->insert($wpdb->prefix . 'bds_projects', ['name' => $name, 'created_at' => current_time('mysql')]);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('project', $id, $name);

        return new WP_REST_Response(['id' => $id, 'name' => $name, 'property_count' => 0], 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_projects WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $name = sanitize_text_field($request->get_param('name') ?? '');
        if ($name === '') return $this->bad_request('Tên dự án không được để trống');

        if ($name !== $existing->name && $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_projects WHERE name = %s", $name))) {
            return $this->bad_request('Dự án này đã tồn tại');
        }

        $wpdb->update($wpdb->prefix . 'bds_projects', ['name' => $name], ['id' => $id]);

        // Giữ đồng bộ tên dự án trên các căn đang gắn với dự án cũ
        if ($name !== $existing->name) {
            $wpdb->update($wpdb->prefix . 'bds_properties', ['project_name' => $name], ['project_name' => $existing->name]);
        }

        BDS_Activity_Logger::log_update('project', $id, $name);

        return new WP_REST_Response(['id' => $id, 'name' => $name]);
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, name FROM {$wpdb->prefix}bds_projects WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $wpdb->delete($wpdb->prefix . 'bds_projects', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('project', $id, $existing->name);

        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
