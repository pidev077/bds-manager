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
        register_rest_route($ns, '/properties/(?P<id>\d+)/similar', [
            ['methods' => 'GET', 'callback' => [$this, 'get_similar_items'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/properties/(?P<id>\d+)/same-owner', [
            ['methods' => 'GET', 'callback' => [$this, 'get_same_owner_items'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/properties/(?P<id>\d+)/images', [
            ['methods' => 'POST',   'callback' => [$this, 'upload_image'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_image'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;

        $where = [];
        $vals  = [];

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search) {
            $where[] = '(title LIKE %s OR code LIKE %s OR project_name LIKE %s OR unit_number LIKE %s OR road LIKE %s)';
            $vals = array_merge($vals, ["%$search%", "%$search%", "%$search%", "%$search%", "%$search%"]);
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

        // Ô tìm "chủ nhà" trên UI khớp cả tên lẫn 2 số điện thoại của chủ nhà
        $owner_phone = sanitize_text_field($request->get_param('owner_phone') ?? '');
        if ($owner_phone !== '') {
            $where[] = "id IN (SELECT property_id FROM {$wpdb->prefix}bds_property_owners WHERE owner_phone LIKE %s OR owner_phone_2 LIKE %s OR owner_name LIKE %s)";
            $vals[]  = "%$owner_phone%";
            $vals[]  = "%$owner_phone%";
            $vals[]  = "%$owner_phone%";
        }

        $contact_status = sanitize_text_field($request->get_param('contact_status') ?? '');
        if ($contact_status !== '') {
            $where[] = "id IN (SELECT property_id FROM {$wpdb->prefix}bds_property_owners WHERE contact_status = %s)";
            $vals[]  = $contact_status;
        }

        $sort  = in_array($request->get_param('sort'), ['price', 'area_gross', 'created_at', 'updated_at']) ? $request->get_param('sort') : 'created_at';
        $order = strtoupper($request->get_param('order') ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        BDS_Activity_Logger::log_view('property');

        $resp = $this->paginate($request, 'bds_properties', $where, $vals, "ORDER BY {$sort} {$order}");
        $resp->set_data($this->attach_owner_info($resp->get_data()));
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d",
            (int) $request['id']
        ));
        if (!$item) return $this->not_found();
        BDS_Activity_Logger::log_view('property', (int) $request['id']);
        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0]);
    }

    // Gộp thông tin chủ nhà (bds_property_owners) thẳng vào từng dòng sản phẩm cho UI Kho sản phẩm,
    // thay vì bắt sale phải mở trang "Quản lý chủ nhà" riêng để xem/sửa.
    private function attach_owner_info(array $items): array {
        global $wpdb;
        if (empty($items)) return $items;

        $ids = array_column($items, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $owners = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_property_owners WHERE property_id IN ({$placeholders}) ORDER BY id ASC",
            ...$ids
        ));

        $by_property = [];
        foreach ($owners as $o) {
            if (!isset($by_property[(int) $o->property_id])) $by_property[(int) $o->property_id] = $o;
        }

        foreach ($items as &$item) {
            $o = $by_property[(int) $item['id']] ?? null;
            $item['owner_id']               = $o ? (int) $o->id : null;
            $item['owner_name']             = $o->owner_name ?? '';
            $item['owner_phone']            = $o->owner_phone ?? '';
            $item['owner_phone_2']          = $o->owner_phone_2 ?? '';
            $item['contact_status']         = $o->contact_status ?? '';
            $item['owner_selling_price']    = $o ? (float) $o->selling_price : null;
            $item['owner_commission_rate']  = $o ? (float) $o->commission_rate : null;
            $item['owner_notes']            = $o->notes ?? '';
            $item['standard']               = $this->normalize_standard($item['standard'] ?? '');
            $this->enrich_with_user($item, ['updated_by' => 'updated_by_name']);
        }

        return $items;
    }

    // `standard` chỉ còn đúng 3 giá trị: raw/basic/full (Hoàn thiện phần thô/cơ bản/full nội thất).
    // Chuẩn hoá ngay khi đọc để mọi giá trị cũ/lạ (kể cả lỡ ghi thẳng qua API, không qua select) đều
    // quy về 1 trong 3 loại này — khớp với migration một lần BDS_Database::migrate_standards().
    private function normalize_standard(string $value): string {
        $v = trim(mb_strtolower($value));
        if ($v === '' || in_array($v, ['raw', 'basic', 'full'], true)) return $v;
        if (str_contains($v, 'thô')) return 'raw';
        if (str_contains($v, 'full') || str_contains($v, 'đầy đủ') || str_contains($v, 'cao cấp')) return 'full';
        return 'basic'; // gồm "hoàn thiện cơ bản" và mọi giá trị lạ khác
    }

    // Tạo mới hoặc cập nhật dòng bds_property_owners tương ứng khi form Kho sản phẩm gửi kèm field chủ nhà
    // (mỗi property chỉ giữ 1 chủ nhà - lấy dòng đầu tiên nếu có nhiều).
    private function upsert_owner(int $property_id, WP_REST_Request $request): void {
        global $wpdb;

        $owner_param_keys = ['owner_name', 'owner_phone', 'owner_phone_2', 'contact_status', 'owner_selling_price', 'owner_commission_rate', 'owner_notes'];
        $has_owner_data = false;
        foreach ($owner_param_keys as $k) {
            if ($request->has_param($k)) { $has_owner_data = true; break; }
        }
        if (!$has_owner_data) return;

        $owner_name = $request->has_param('owner_name') ? sanitize_text_field($request->get_param('owner_name') ?? '') : null;

        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}bds_property_owners WHERE property_id = %d ORDER BY id ASC LIMIT 1",
            $property_id
        ));

        if (!$existing && $owner_name === '') return; // không tạo dòng chủ nhà rỗng

        $data = [];
        if ($request->has_param('owner_name'))            $data['owner_name']      = $owner_name;
        if ($request->has_param('owner_phone'))            $data['owner_phone']     = sanitize_text_field($request->get_param('owner_phone') ?? '');
        if ($request->has_param('owner_phone_2'))          $data['owner_phone_2']   = sanitize_text_field($request->get_param('owner_phone_2') ?? '');
        if ($request->has_param('contact_status'))         $data['contact_status']  = sanitize_text_field($request->get_param('contact_status') ?? '');
        if ($request->has_param('owner_selling_price'))     $data['selling_price']   = (float) $request->get_param('owner_selling_price');
        if ($request->has_param('owner_commission_rate'))   $data['commission_rate'] = (float) $request->get_param('owner_commission_rate');
        if ($request->has_param('owner_notes'))             $data['notes']           = sanitize_textarea_field($request->get_param('owner_notes') ?? '');
        $data['updated_at'] = current_time('mysql');

        if ($existing) {
            $wpdb->update($wpdb->prefix . 'bds_property_owners', $data, ['id' => $existing->id]);
        } else {
            if (empty($data['owner_name'])) return; // bắt buộc có tên chủ nhà mới tạo dòng mới
            $data['property_id'] = $property_id;
            $data['assigned_to'] = get_current_user_id();
            $data['created_by']  = get_current_user_id();
            $data['created_at']  = current_time('mysql');
            $wpdb->insert($wpdb->prefix . 'bds_property_owners', $data);
        }
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;

        $title = sanitize_text_field($request->get_param('title') ?? '');
        if (!$title) return $this->bad_request('Tiêu đề nhà bán không được để trống');

        $code = sanitize_text_field($request->get_param('code') ?? '');

        $data = [
            // code là UNIQUE KEY trong DB — để trống phải lưu NULL (không phải ''), nếu không 2 căn cùng
            // để trống mã tin sẽ đụng unique constraint và lưu thất bại.
            'code'              => $code !== '' ? $code : null,
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
            'price_rent'        => (float) ($request->get_param('price_rent') ?? 0),
            'status'            => sanitize_text_field($request->get_param('status') ?? 'available'),
            'property_type'     => sanitize_text_field($request->get_param('property_type') ?? ''),
            'fund_type'         => sanitize_text_field($request->get_param('fund_type') ?? 'F0'),
            'component'         => sanitize_text_field($request->get_param('component') ?? ''),
            'standard'          => sanitize_text_field($request->get_param('standard') ?? ''),
            'road'              => sanitize_text_field($request->get_param('road') ?? ''),
            'dimensions'        => sanitize_text_field($request->get_param('dimensions') ?? ''),
            'tag'               => sanitize_text_field($request->get_param('tag') ?? ''),
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

        $this->upsert_owner($id, $request);

        // Notify all users
        $this->notify_all_users('new_property', 'Nhà bán mới', "Nhà bán \"{$title}\" vừa được thêm vào hệ thống", 'property', $id);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        $this->notify_matching_needs($item, $title);

        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0], 201);
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

        $fields = ['title', 'project_name', 'block', 'floor', 'unit_number', 'direction', 'balcony_direction', 'view_type', 'status', 'property_type', 'fund_type', 'component', 'standard', 'road', 'dimensions', 'tag', 'description'];
        $data = [];
        foreach ($fields as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        if ($request->has_param('code')) {
            // code là UNIQUE KEY — để trống phải lưu NULL, không lưu '' (xem create_item)
            $code = sanitize_text_field($request->get_param('code') ?? '');
            $data['code'] = $code !== '' ? $code : null;
        }
        foreach (['area_gross', 'area_net', 'price', 'price_per_sqm', 'price_rent'] as $f) {
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

        $this->upsert_owner($id, $request);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));

        $this->notify_all_users('updated_property', 'Nhà bán đã cập nhật', "Nhà bán \"{$item->title}\" vừa được cập nhật thông tin", 'property', $id);
        $this->notify_matching_needs($item, $item->title);

        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0]);
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

    // Danh sách riêng các căn khác cùng chủ nhà (khác với "sản phẩm tương tự" — 1 chủ nhà có thể rao
    // nhiều căn không cùng dự án/loại hình, nên tách thành cột riêng thay vì gộp chung tiêu chí gợi ý).
    public function get_same_owner_items(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $current = $wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$current) return $this->not_found();

        $owner = $wpdb->get_row($wpdb->prepare(
            "SELECT owner_name FROM {$wpdb->prefix}bds_property_owners WHERE property_id = %d ORDER BY id ASC LIMIT 1",
            $id
        ));
        if (!$owner || $owner->owner_name === '') return new WP_REST_Response([]);

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.* FROM {$wpdb->prefix}bds_properties p
             INNER JOIN {$wpdb->prefix}bds_property_owners o ON o.property_id = p.id
             WHERE o.owner_name = %s AND p.id != %d
             GROUP BY p.id
             ORDER BY p.created_at DESC
             LIMIT 10",
            $owner->owner_name, $id
        ));

        $data = array_map([$this, 'format_item'], $rows);
        $data = $this->attach_owner_info($data);

        return new WP_REST_Response($data);
    }

    public function upload_image(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $property = $wpdb->get_row($wpdb->prepare("SELECT id, images FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$property) return $this->not_found();

        $files = $request->get_file_params();
        if (empty($files['file'])) return $this->bad_request('Thiếu file ảnh');

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $upload = wp_handle_upload($files['file'], [
            'test_form' => false,
            'mimes'     => ['jpg|jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'],
        ]);
        if (isset($upload['error'])) return new WP_Error('upload_error', $upload['error'], ['status' => 500]);

        $images   = json_decode($property->images ?: '[]', true);
        $images   = is_array($images) ? $images : [];
        $images[] = $upload['url'];

        $wpdb->update($wpdb->prefix . 'bds_properties', [
            'images'     => wp_json_encode($images),
            'updated_by' => get_current_user_id(),
            'updated_at' => current_time('mysql'),
        ], ['id' => $id]);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0], 201);
    }

    public function delete_image(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $property = $wpdb->get_row($wpdb->prepare("SELECT id, images FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$property) return $this->not_found();

        $url = esc_url_raw($request->get_param('url') ?? '');
        if (!$url) return $this->bad_request('Thiếu url ảnh cần xoá');

        $images = json_decode($property->images ?: '[]', true);
        $images = is_array($images) ? array_values(array_filter($images, fn($u) => $u !== $url)) : [];

        $wpdb->update($wpdb->prefix . 'bds_properties', [
            'images'     => wp_json_encode($images),
            'updated_by' => get_current_user_id(),
            'updated_at' => current_time('mysql'),
        ], ['id' => $id]);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0]);
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
