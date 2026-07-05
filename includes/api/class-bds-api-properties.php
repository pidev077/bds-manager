<?php
defined('ABSPATH') || exit;

class BDS_API_Properties extends BDS_API_Base {

    protected $rest_base = 'properties';

    // Loại hình theo doc "Bộ lọc cực mạnh": Căn hộ / Nhà phố / Shophouse / Biệt thự
    const PROPERTY_CATEGORIES = [
        'apartment'  => ['1PN', '2PN', '3PN', '4PN', '5PN', '1PN+1', '2PN+1 (1 Toilet)', '2PN+1 (2 Toilets)', '2PN+2 (2 Toilets)', '2PN (2 TOILET)', '2PN (1 TOILET)', '3PN+1', 'Studio'],
        'townhouse'  => ['Nhà liền kề'],
        'shophouse'  => ['Shop-house'],
        'villa'      => ['Biệt thự đơn lập', 'Biệt thự song lập', 'Biệt thự tứ lập'],
    ];

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
        register_rest_route($ns, '/properties/(?P<id>\d+)/similar', [
            ['methods' => 'GET', 'callback' => [$this, 'get_similar_items'], 'permission_callback' => [$this, 'permission_callback']],
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

        foreach (['status', 'project_name', 'property_type', 'fund_type', 'view_type'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') {
                $where[] = "{$f} = %s";
                $vals[]  = sanitize_text_field($v);
            }
        }

        if ($request->get_param('created_today')) {
            $today = current_time('Y-m-d');
            $where[] = '(DATE(created_at) = %s OR DATE(updated_at) = %s)';
            $vals[]  = $today;
            $vals[]  = $today;
        }

        // Loại hình (nhóm căn hộ / nhà phố / shophouse / biệt thự) — gộp nhiều property_type cụ thể
        $category = sanitize_text_field($request->get_param('property_category') ?? '');
        if ($category && isset(self::PROPERTY_CATEGORIES[$category])) {
            $types = self::PROPERTY_CATEGORIES[$category];
            $placeholders = implode(',', array_fill(0, count($types), '%s'));
            $where[] = "property_type IN ({$placeholders})";
            $vals = array_merge($vals, $types);
        }

        if ($request->get_param('bedrooms')) {
            $where[] = 'bedrooms = %d';
            $vals[]  = (int) $request->get_param('bedrooms');
        }

        if ($request->get_param('price_min') !== null && $request->get_param('price_min') !== '') {
            $where[] = 'price >= %f';
            $vals[]  = (float) $request->get_param('price_min');
        }
        if ($request->get_param('price_max') !== null && $request->get_param('price_max') !== '') {
            $where[] = 'price <= %f';
            $vals[]  = (float) $request->get_param('price_max');
        }
        if ($request->get_param('area_min') !== null && $request->get_param('area_min') !== '') {
            $where[] = 'area_gross >= %f';
            $vals[]  = (float) $request->get_param('area_min');
        }
        if ($request->get_param('area_max') !== null && $request->get_param('area_max') !== '') {
            $where[] = 'area_gross <= %f';
            $vals[]  = (float) $request->get_param('area_max');
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
            'view_type'         => sanitize_text_field($request->get_param('view_type') ?? ''),
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
        $this->notify_matching_needs($item, $title);

        return new WP_REST_Response($this->format_item($item), 201);
    }

    private function notify_matching_needs(object $property, string $title): void {
        foreach (BDS_Need_Matcher::find_matching_needs($property) as $need) {
            if (empty($need->assigned_to)) continue;
            $this->send_notification(
                (int) $need->assigned_to,
                'need_match',
                'Có căn phù hợp với nhu cầu khách hàng',
                "Căn \"{$title}\" phù hợp với nhu cầu \"" . ($need->title ?: "NCD-{$need->id}") . '"',
                'need',
                (int) $need->id
            );
        }
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $fields = ['title', 'code', 'project_name', 'block', 'floor', 'unit_number', 'direction', 'balcony_direction', 'view_type', 'status', 'property_type', 'fund_type', 'component', 'standard', 'description'];
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

        $this->notify_all_users('updated_property', 'Nhà bán đã cập nhật', "Nhà bán \"{$item->title}\" vừa được cập nhật thông tin", 'property', $id);
        $this->notify_matching_needs($item, $item->title);

        return new WP_REST_Response($this->format_item($item));
    }

    public function get_similar_items(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $current = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$current) return $this->not_found();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT *,
                    (project_name = %s AND project_name != '') AS same_project,
                    (property_type = %s AND property_type != '') AS same_type
             FROM {$wpdb->prefix}bds_properties
             WHERE id != %d
               AND status = 'available'
               AND (project_name = %s OR property_type = %s OR bedrooms = %d)
             ORDER BY same_project DESC, same_type DESC, ABS(price - %f) ASC
             LIMIT 6",
            $current->project_name, $current->property_type, $id,
            $current->project_name, $current->property_type, (int) $current->bedrooms,
            (float) $current->price
        ));

        $data = array_map(function ($item) {
            unset($item->same_project, $item->same_type);
            return $this->format_item($item);
        }, $rows);

        return new WP_REST_Response($data);
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
