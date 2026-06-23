<?php
defined('ABSPATH') || exit;

class BDS_API_Properties extends BDS_API_Base {

    protected $rest_base = 'properties';

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/properties', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],  'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'],'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/properties/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;

        $where = [];
        $vals  = [];

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search) {
            $where[] = '(title LIKE %s OR code LIKE %s OR project_name LIKE %s OR unit_number LIKE %s)';
            $vals = array_merge($vals, ["%$search%", "%$search%", "%$search%", "%$search%"]);
        }

        foreach (['status', 'project_name', 'property_type', 'fund_type'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') {
                $where[] = "{$f} = %s";
                $vals[]  = sanitize_text_field($v);
            }
        }

        if ($request->get_param('bedrooms')) {
            $where[] = 'bedrooms = %d';
            $vals[]  = (int) $request->get_param('bedrooms');
        }

        $sort  = in_array($request->get_param('sort'), ['price', 'area_gross', 'created_at', 'updated_at']) ? $request->get_param('sort') : 'created_at';
        $order = strtoupper($request->get_param('order') ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        BDS_Activity_Logger::log_view('property');

        return $this->paginate($request, 'bds_properties', $where, $vals, "ORDER BY {$sort} {$order}");
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d",
            (int) $request['id']
        ));
        if (!$item) return $this->not_found();
        BDS_Activity_Logger::log_view('property', (int) $request['id']);
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;

        $title = sanitize_text_field($request->get_param('title') ?? '');
        if (!$title) return $this->bad_request('Tiêu đề nhà bán không được để trống');

        $data = [
            'code'              => sanitize_text_field($request->get_param('code') ?? ''),
            'title'             => $title,
            'project_name'      => sanitize_text_field($request->get_param('project_name') ?? ''),
            'block'             => sanitize_text_field($request->get_param('block') ?? ''),
            'floor'             => sanitize_text_field($request->get_param('floor') ?? ''),
            'unit_number'       => sanitize_text_field($request->get_param('unit_number') ?? ''),
            'area_gross'        => (float) ($request->get_param('area_gross') ?? 0),
            'area_net'          => (float) ($request->get_param('area_net') ?? 0),
            'bedrooms'          => (int) ($request->get_param('bedrooms') ?? 0),
            'bathrooms'         => (int) ($request->get_param('bathrooms') ?? 0),
            'direction'         => sanitize_text_field($request->get_param('direction') ?? ''),
            'balcony_direction' => sanitize_text_field($request->get_param('balcony_direction') ?? ''),
            'price'             => (float) ($request->get_param('price') ?? 0),
            'price_per_sqm'     => (float) ($request->get_param('price_per_sqm') ?? 0),
            'status'            => sanitize_text_field($request->get_param('status') ?? 'available'),
            'property_type'     => sanitize_text_field($request->get_param('property_type') ?? ''),
            'fund_type'         => sanitize_text_field($request->get_param('fund_type') ?? 'F0'),
            'component'         => sanitize_text_field($request->get_param('component') ?? ''),
            'standard'          => sanitize_text_field($request->get_param('standard') ?? ''),
            'description'       => sanitize_textarea_field($request->get_param('description') ?? ''),
            'images'            => wp_json_encode($request->get_param('images') ?? []),
            'created_by'        => get_current_user_id(),
            'updated_by'        => get_current_user_id(),
            'created_at'        => current_time('mysql'),
            'updated_at'        => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_properties', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('property', $id, $title);

        // Notify all users
        $this->notify_all_users('new_property', 'Nhà bán mới', "Nhà bán \"{$title}\" vừa được thêm vào hệ thống", 'property', $id);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $fields = ['title', 'code', 'project_name', 'block', 'floor', 'unit_number', 'direction', 'balcony_direction', 'status', 'property_type', 'fund_type', 'component', 'standard', 'description'];
        $data = [];
        foreach ($fields as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        foreach (['area_gross', 'area_net', 'price', 'price_per_sqm'] as $f) {
            if ($request->has_param($f)) $data[$f] = (float) $request->get_param($f);
        }
        foreach (['bedrooms', 'bathrooms'] as $f) {
            if ($request->has_param($f)) $data[$f] = (int) $request->get_param($f);
        }
        if ($request->has_param('images')) {
            $data['images'] = wp_json_encode($request->get_param('images') ?? []);
        }
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_properties', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('property', $id, $existing->title);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, title FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        if (!BDS_Roles::is_admin()) return $this->forbidden();

        $wpdb->delete($wpdb->prefix . 'bds_properties', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('property', $id, $existing->title);

        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
