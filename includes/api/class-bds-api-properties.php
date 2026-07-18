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
        register_rest_route($ns, '/properties/check-unit-number', [
            ['methods' => 'GET', 'callback' => [$this, 'check_unit_number'], 'permission_callback' => [$this, 'permission_callback']],
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

        // Mỗi field nhận 1 giá trị (từ các bộ lọc nhanh) hoặc nhiều giá trị cách nhau bởi dấu phẩy
        // (từ sidebar Bộ lọc nâng cao, check nhiều ô cùng lúc) — đều lọc theo IN (...) cho thống nhất.
        foreach (['status', 'project_name', 'property_type', 'fund_type', 'view_type', 'direction', 'balcony_direction', 'standard', 'tag'] as $f) {
            $this->add_in_where($where, $vals, $f, $request->get_param($f));
        }

        // "Bán"/"Cho thuê" là 2 tab lọc chính ở Kho sản phẩm — 1 căn "bán và cho thuê" (both) phải
        // xuất hiện ở cả 2 tab, nên lọc theo IN (...) chứ không phải so khớp tuyệt đối.
        $listing_type = sanitize_text_field($request->get_param('listing_type') ?? '');
        if ($listing_type === 'sale') {
            $where[] = "listing_type IN ('sale','both')";
        } elseif ($listing_type === 'rent') {
            $where[] = "listing_type IN ('rent','both')";
        } elseif ($listing_type === 'both') {
            $where[] = "listing_type = 'both'";
        }

        // Nhân viên bị giới hạn phân khúc (bán/cho thuê) chỉ thấy đúng phân khúc mình phụ trách,
        // bất kể tab nào đang chọn — admin/quản lý hoặc nhân viên phụ trách cả 2 mảng không bị ảnh hưởng.
        $segment_where = BDS_Roles::segment_where_clause('listing_type');
        if ($segment_where !== '') {
            $where[] = $segment_where;
        }

        if ($request->get_param('created_today')) {
            $today = current_time('Y-m-d');
            $where[] = '(DATE(created_at) = %s OR DATE(updated_at) = %s)';
            $vals[]  = $today;
            $vals[]  = $today;
        }

        $this->add_in_where($where, $vals, 'bedrooms', $request->get_param('bedrooms'), '%d', true);
        $this->add_in_where($where, $vals, 'bathrooms', $request->get_param('bathrooms'), '%d', true);

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

        $contact_statuses = $this->split_list($request->get_param('contact_status'));
        if (!empty($contact_statuses)) {
            $placeholders = implode(',', array_fill(0, count($contact_statuses), '%s'));
            $where[] = "id IN (SELECT property_id FROM {$wpdb->prefix}bds_property_owners WHERE contact_status IN ({$placeholders}))";
            $vals = array_merge($vals, $contact_statuses);
        }

        $sort  = in_array($request->get_param('sort'), ['price', 'area_gross', 'created_at', 'updated_at']) ? $request->get_param('sort') : 'created_at';
        $order = strtoupper($request->get_param('order') ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        BDS_Activity_Logger::log_view('property');

        $resp = $this->paginate($request, 'bds_properties', $where, $vals, "ORDER BY {$sort} {$order}");
        $resp->set_data($this->attach_owner_info($resp->get_data()));
        return $resp;
    }

    // Tách giá trị query param dạng "a,b,c" (sidebar Bộ lọc nâng cao gửi lên khi check nhiều ô)
    // thành mảng đã làm sạch. 1 giá trị đơn (từ bộ lọc nhanh) vẫn hoạt động bình thường.
    private function split_list($raw, bool $as_int = false): array {
        if ($raw === null || $raw === '') return [];
        $parts = explode(',', (string) $raw);
        $parts = $as_int ? array_map('intval', $parts) : array_map('sanitize_text_field', $parts);
        return array_values(array_filter($parts, fn($v) => $v !== '' && $v !== 0));
    }

    private function add_in_where(array &$where, array &$vals, string $column, $raw, string $placeholder = '%s', bool $as_int = false): void {
        $list = $this->split_list($raw, $as_int);
        if (empty($list)) return;
        $placeholders = implode(',', array_fill(0, count($list), $placeholder));
        $where[] = "{$column} IN ({$placeholders})";
        $vals = array_merge($vals, $list);
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d",
            (int) $request['id']
        ));
        if (!$item) return $this->not_found();
        if (BDS_Roles::is_outside_segment($item->listing_type)) return $this->forbidden();
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
            $item = $this->cast_numeric_fields($item);
            $o = $by_property[(int) $item['id']] ?? null;
            $item['owner_id']               = $o ? (int) $o->id : null;
            $item['owner_name']             = $o->owner_name ?? '';
            $item['owner_phone']            = $o->owner_phone ?? '';
            $item['owner_phone_2']          = $o->owner_phone_2 ?? '';
            $item['owner_email']            = $o->owner_email ?? '';
            $item['contact_status']         = $o->contact_status ?? '';
            $item['owner_selling_price']    = $o ? (float) $o->selling_price : null;
            $item['owner_commission_rate']  = $o ? (float) $o->commission_rate : null;
            $item['owner_notes']            = $o->notes ?? '';
            $item['standard']               = $this->normalize_standard($item['standard'] ?? '');
            $this->enrich_with_user($item, ['updated_by' => 'updated_by_name']);
        }

        return $items;
    }

    // $wpdb trả mọi cột về dạng chuỗi (VD "0.00"), mà chuỗi "0.00" lại là truthy trong JS — khiến
    // frontend hiện nhầm giá 0 (chưa nhập) thành có giá trị. Ép các cột số về đúng kiểu float/int để
    // JSON trả về là số 0 thật (falsy), không phải chuỗi "0.00".
    private function cast_numeric_fields(array $item): array {
        foreach (['price', 'price_per_sqm', 'price_rent', 'area_gross', 'area_net', 'commission_sale_value', 'commission_rent_value'] as $f) {
            if (isset($item[$f])) $item[$f] = (float) $item[$f];
        }
        foreach (['bedrooms', 'bathrooms'] as $f) {
            if (isset($item[$f])) $item[$f] = (int) $item[$f];
        }
        if (isset($item['is_exclusive'])) $item['is_exclusive'] = (bool) $item['is_exclusive'];
        return $item;
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

        $owner_param_keys = ['owner_name', 'owner_phone', 'owner_phone_2', 'owner_email', 'contact_status', 'owner_selling_price', 'owner_commission_rate', 'owner_notes'];
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
        if ($request->has_param('owner_email'))            $data['owner_email']     = sanitize_email($request->get_param('owner_email') ?? '');
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

        $unit_number  = sanitize_text_field($request->get_param('unit_number') ?? '');
        $listing_type = sanitize_text_field($request->get_param('listing_type') ?? 'sale');

        $dup = $this->find_duplicate_unit_number($unit_number, $listing_type);
        if ($dup) return $this->bad_request($this->duplicate_unit_number_message($unit_number, $dup));

        $cross = $this->find_cross_type_property($unit_number, $listing_type);
        if ($cross) {
            $property = $this->attach_owner_info([$this->format_item($cross)])[0];
            return $this->conflict($this->cross_type_message($cross), ['mergeable' => true, 'property' => $property]);
        }

        $data = [
            // Mã tin không cho người dùng tự nhập — luôn tự sinh từ id sau khi insert (xem bên dưới)
            // để đảm bảo duy nhất tuyệt đối và luôn tăng dần như số thứ tự.
            'code'              => null,
            'title'             => $title,
            'project_name'      => sanitize_text_field($request->get_param('project_name') ?? ''),
            'block'             => sanitize_text_field($request->get_param('block') ?? ''),
            'zone'              => sanitize_text_field($request->get_param('zone') ?? ''),
            'floor'             => sanitize_text_field($request->get_param('floor') ?? ''),
            'unit_number'       => $unit_number,
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
            'listing_type'      => $listing_type,
            'commission_sale_type'  => sanitize_text_field($request->get_param('commission_sale_type') ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
            'commission_sale_value' => (float) ($request->get_param('commission_sale_value') ?? 0),
            'commission_rent_type'  => sanitize_text_field($request->get_param('commission_rent_type') ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
            'commission_rent_value' => (float) ($request->get_param('commission_rent_value') ?? 0),
            'status'            => sanitize_text_field($request->get_param('status') ?? 'available'),
            'property_type'     => sanitize_text_field($request->get_param('property_type') ?? ''),
            'fund_type'         => sanitize_text_field($request->get_param('fund_type') ?? 'F0'),
            'component'         => sanitize_text_field($request->get_param('component') ?? ''),
            'standard'          => sanitize_text_field($request->get_param('standard') ?? ''),
            'road'              => sanitize_text_field($request->get_param('road') ?? ''),
            'dimensions'        => sanitize_text_field($request->get_param('dimensions') ?? ''),
            'tag'               => sanitize_text_field($request->get_param('tag') ?? ''),
            'legal_status'      => sanitize_text_field($request->get_param('legal_status') ?? ''),
            'is_exclusive'      => $request->get_param('is_exclusive') ? 1 : 0,
            'description'       => sanitize_textarea_field($request->get_param('description') ?? ''),
            'images'            => wp_json_encode($request->get_param('images') ?? []),
            'documents_images'  => wp_json_encode($request->get_param('documents_images') ?? []),
            'web_title'         => sanitize_text_field($request->get_param('web_title') ?? ''),
            'web_description'   => sanitize_textarea_field($request->get_param('web_description') ?? ''),
            'sale_contact'      => sanitize_text_field($request->get_param('sale_contact') ?? ''),
            'video_url'         => esc_url_raw($request->get_param('video_url') ?? ''),
            'created_by'        => get_current_user_id(),
            'updated_by'        => get_current_user_id(),
            'created_at'        => current_time('mysql'),
            'updated_at'        => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_properties', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        $wpdb->update($wpdb->prefix . 'bds_properties', ['code' => $this->generate_code($id)], ['id' => $id]);
        BDS_Activity_Logger::log_create('property', $id, $title);

        $this->upsert_owner($id, $request);

        // Notify all users
        $this->notify_all_users('new_property', 'Nhà bán mới', "Nhà bán \"{$title}\" vừa được thêm vào hệ thống", 'property', $id);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        $this->notify_matching_needs($item, $title);

        $data = $this->attach_owner_info([$this->format_item($item)]);
        return new WP_REST_Response($data[0], 201);
    }

    // Mã tin không cho sửa tay — luôn là "BDS" + id đệm 5 chữ số (id đã tự tăng dần và duy nhất sẵn).
    private function generate_code(int $id): string {
        return 'BDS' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
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

    // Phạm vi coi là "trùng thật" (chặn cứng, báo lỗi) — cùng phân khúc bán/cho thuê, hoặc đụng "both".
    // Trường hợp trùng mã căn nhưng khác phân khúc thuần (1 bên bán, 1 bên thuê) KHÔNG rơi vào đây —
    // đó là cùng 1 căn vật lý, được xử lý riêng ở find_cross_type_property() để gộp thành "both".
    private function unit_number_overlap_types(string $listing_type): array {
        if ($listing_type === 'sale') return ['sale', 'both'];
        if ($listing_type === 'rent') return ['rent', 'both'];
        return ['sale', 'rent', 'both'];
    }

    private function find_duplicate_unit_number(string $unit_number, string $listing_type, ?int $exclude_id = null): ?object {
        global $wpdb;
        if ($unit_number === '') return null;

        $overlap = $this->unit_number_overlap_types($listing_type);
        $placeholders = implode(',', array_fill(0, count($overlap), '%s'));
        $params = array_merge([$unit_number], $overlap);

        $sql = "SELECT id, title, code, listing_type FROM {$wpdb->prefix}bds_properties
                WHERE unit_number = %s AND listing_type IN ({$placeholders})";
        if ($exclude_id !== null) {
            $sql .= ' AND id != %d';
            $params[] = $exclude_id;
        }
        $sql .= ' LIMIT 1';

        $row = $wpdb->get_row($wpdb->prepare($sql, $params));
        return $row ?: null;
    }

    private function duplicate_unit_number_message(string $unit_number, object $dup): string {
        $label = $dup->code ? "{$dup->code} - {$dup->title}" : $dup->title;
        return "Mã căn \"{$unit_number}\" đã tồn tại (căn \"{$label}\"), vui lòng kiểm tra lại.";
    }

    // Cùng 1 mã căn nhưng 1 bên "bán" 1 bên "cho thuê" là cùng 1 căn vật lý, không phải 2 tin khác nhau
    // — không cho tạo dòng mới, thay vào đó trả về căn đang có để client mở form sửa, tự chuyển sang "both".
    private function find_cross_type_property(string $unit_number, string $listing_type, ?int $exclude_id = null): ?object {
        global $wpdb;
        if ($unit_number === '' || !in_array($listing_type, ['sale', 'rent'], true)) return null;
        $opposite = $listing_type === 'sale' ? 'rent' : 'sale';

        $sql = "SELECT * FROM {$wpdb->prefix}bds_properties WHERE unit_number = %s AND listing_type = %s";
        $params = [$unit_number, $opposite];
        if ($exclude_id !== null) {
            $sql .= ' AND id != %d';
            $params[] = $exclude_id;
        }
        $sql .= ' LIMIT 1';

        $row = $wpdb->get_row($wpdb->prepare($sql, $params));
        return $row ?: null;
    }

    private function cross_type_message(object $cross): string {
        $side = $cross->listing_type === 'sale' ? 'đang bán' : 'đang cho thuê';
        return "Mã căn này {$side} rồi — lưu sẽ tự động chuyển căn sang \"Bán và cho thuê\".";
    }

    public function check_unit_number(WP_REST_Request $request): WP_REST_Response {
        $unit_number  = sanitize_text_field($request->get_param('unit_number') ?? '');
        $listing_type = sanitize_text_field($request->get_param('listing_type') ?? 'sale');
        $exclude_id   = $request->get_param('exclude_id') !== null ? (int) $request->get_param('exclude_id') : null;

        $dup = $this->find_duplicate_unit_number($unit_number, $listing_type, $exclude_id);
        if ($dup) {
            return new WP_REST_Response([
                'duplicate' => true,
                'message'   => $this->duplicate_unit_number_message($unit_number, $dup),
                'property'  => ['id' => (int) $dup->id, 'title' => $dup->title, 'code' => $dup->code, 'listing_type' => $dup->listing_type],
            ]);
        }

        $cross = $this->find_cross_type_property($unit_number, $listing_type, $exclude_id);
        if ($cross) {
            return new WP_REST_Response([
                'duplicate' => false,
                'mergeable' => true,
                'message'   => $this->cross_type_message($cross),
                'property'  => ['id' => (int) $cross->id, 'title' => $cross->title, 'code' => $cross->code, 'listing_type' => $cross->listing_type],
            ]);
        }

        return new WP_REST_Response(['duplicate' => false]);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $fields = ['title', 'project_name', 'block', 'zone', 'floor', 'unit_number', 'direction', 'balcony_direction', 'view_type', 'status', 'listing_type', 'property_type', 'fund_type', 'component', 'standard', 'road', 'dimensions', 'tag', 'legal_status', 'web_title', 'sale_contact'];
        $data = [];
        foreach ($fields as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        // Mã tin không cho sửa tay (xem generate_code) — bỏ qua tham số 'code' nếu client có gửi lên.
        foreach (['commission_sale_type', 'commission_rent_type'] as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f)) === 'fixed' ? 'fixed' : 'percent';
        }
        foreach (['area_gross', 'area_net', 'price', 'price_per_sqm', 'price_rent', 'commission_sale_value', 'commission_rent_value'] as $f) {
            if ($request->has_param($f)) $data[$f] = (float) $request->get_param($f);
        }
        foreach (['bedrooms', 'bathrooms'] as $f) {
            if ($request->has_param($f)) $data[$f] = (int) $request->get_param($f);
        }
        if ($request->has_param('is_exclusive')) {
            $data['is_exclusive'] = $request->get_param('is_exclusive') ? 1 : 0;
        }
        // sanitize_text_field() cắt xuống dòng — description/web_description phải giữ nguyên xuống dòng nên
        // xử lý riêng bằng sanitize_textarea_field() thay vì gộp chung vào $fields ở trên.
        foreach (['description', 'web_description'] as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_textarea_field($request->get_param($f) ?? '');
        }
        if ($request->has_param('video_url')) {
            $data['video_url'] = esc_url_raw($request->get_param('video_url') ?? '');
        }
        if ($request->has_param('images')) {
            $data['images'] = wp_json_encode($request->get_param('images') ?? []);
        }
        if ($request->has_param('documents_images')) {
            $data['documents_images'] = wp_json_encode($request->get_param('documents_images') ?? []);
        }

        $check_unit_number  = $data['unit_number']  ?? $existing->unit_number;
        $check_listing_type = $data['listing_type'] ?? $existing->listing_type;
        $dup = $this->find_duplicate_unit_number($check_unit_number, $check_listing_type, $id);
        if ($dup) return $this->bad_request($this->duplicate_unit_number_message($check_unit_number, $dup));

        $cross = $this->find_cross_type_property($check_unit_number, $check_listing_type, $id);
        if ($cross) {
            $property = $this->attach_owner_info([$this->format_item($cross)])[0];
            return $this->conflict($this->cross_type_message($cross), ['mergeable' => true, 'property' => $property]);
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
            return $this->cast_numeric_fields($this->format_item($item));
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

    // "property" = ảnh BĐS (cột images), "document" = ảnh giấy tờ/sổ (cột documents_images) — 1 cặp
    // endpoint dùng chung cho cả 2 loại ảnh, phân biệt qua tham số `type`.
    private function image_column(WP_REST_Request $request): string {
        return $request->get_param('type') === 'document' ? 'documents_images' : 'images';
    }

    public function upload_image(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $column = $this->image_column($request);

        $property = $wpdb->get_row($wpdb->prepare("SELECT id, {$column} FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$property) return $this->not_found();

        $files = $request->get_file_params();
        if (empty($files['file'])) return $this->bad_request('Thiếu file ảnh');

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $upload = wp_handle_upload($files['file'], [
            'test_form' => false,
            'mimes'     => ['jpg|jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'],
        ]);
        if (isset($upload['error'])) return new WP_Error('upload_error', $upload['error'], ['status' => 500]);

        $images   = json_decode($property->$column ?: '[]', true);
        $images   = is_array($images) ? $images : [];
        $images[] = $upload['url'];

        $wpdb->update($wpdb->prefix . 'bds_properties', [
            $column      => wp_json_encode($images),
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
        $column = $this->image_column($request);

        $property = $wpdb->get_row($wpdb->prepare("SELECT id, {$column} FROM {$wpdb->prefix}bds_properties WHERE id = %d", $id));
        if (!$property) return $this->not_found();

        $url = esc_url_raw($request->get_param('url') ?? '');
        if (!$url) return $this->bad_request('Thiếu url ảnh cần xoá');

        $images = json_decode($property->$column ?: '[]', true);
        $images = is_array($images) ? array_values(array_filter($images, fn($u) => $u !== $url)) : [];

        $wpdb->update($wpdb->prefix . 'bds_properties', [
            $column      => wp_json_encode($images),
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
