<?php
defined('ABSPATH') || exit;

class BDS_API_Documents extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/documents', [
            ['methods' => 'GET', 'callback' => [$this, 'get_items'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/documents/upload', [
            ['methods' => 'POST', 'callback' => [$this, 'upload_item'], 'permission_callback' => [$this, 'manage_permission']],
        ]);
        register_rest_route($ns, '/documents/(?P<id>\d+)', [
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'manage_permission']],
        ]);
    }

    public function manage_permission(): bool {
        return $this->auth_check() && (BDS_Roles::is_admin() || BDS_Roles::is_manager());
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        $where = []; $vals = [];

        foreach (['project_name', 'category'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') { $where[] = "{$f} = %s"; $vals[] = sanitize_text_field($v); }
        }

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search !== '') {
            [$clause, $search_vals] = $this->search_where($search, ['title', 'file_name']);
            $where[] = $clause;
            $vals = array_merge($vals, $search_vals);
        }

        $resp = $this->paginate($request, 'bds_documents', $where, $vals, 'ORDER BY created_at DESC');
        $data = array_map(function ($item) {
            $this->enrich_with_user($item, ['uploaded_by' => 'uploaded_by_name']);
            return $item;
        }, $resp->get_data());

        $resp->set_data($data);
        return $resp;
    }

    public function upload_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        $files = $request->get_file_params();
        if (empty($files['file'])) return $this->bad_request('Thiếu file tải lên');

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $upload = wp_handle_upload($files['file'], ['test_form' => false]);
        if (isset($upload['error'])) return new WP_Error('upload_error', $upload['error'], ['status' => 500]);

        global $wpdb;
        $uid = get_current_user_id();
        $title = sanitize_text_field($request->get_param('title') ?? '') ?: basename($upload['file']);

        $data = [
            'project_name' => sanitize_text_field($request->get_param('project_name') ?? ''),
            'category'     => sanitize_text_field($request->get_param('category') ?? 'other'),
            'title'        => $title,
            'file_url'     => $upload['url'],
            'file_name'    => basename($upload['file']),
            'file_size'    => file_exists($upload['file']) ? filesize($upload['file']) : 0,
            'uploaded_by'  => $uid,
            'created_at'   => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_documents', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('document', $id, $title);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_documents WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        if (!$wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_documents WHERE id = %d", $id))) return $this->not_found();
        $wpdb->delete($wpdb->prefix . 'bds_documents', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('document', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
