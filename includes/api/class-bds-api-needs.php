<?php
defined('ABSPATH') || exit;

class BDS_API_Needs extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/needs', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/needs/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/needs/(?P<id>\d+)/matches', [
            ['methods' => 'GET', 'callback' => [$this, 'get_matches'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_matches(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $need = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_needs WHERE id = %d", (int) $request['id']));
        if (!$need) return $this->not_found();
        $matches = BDS_Need_Matcher::find_matching_properties($need, 10);
        return new WP_REST_Response($this->format_items($matches));
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $uid   = get_current_user_id();
        $where = [];
        $vals  = [];

        if (!BDS_Roles::is_admin($uid) && !BDS_Roles::is_manager($uid)) {
            $where[] = '(assigned_to = %d OR created_by = %d)';
            $vals[]  = $uid; $vals[] = $uid;
        }

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search) {
            $where[] = '(title LIKE %s OR code LIKE %s)';
            $vals    = array_merge($vals, ["%$search%", "%$search%"]);
        }

        foreach (['type', 'tier', 'activity_status', 'processing_status', 'buy_status'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') { $where[] = "{$f} = %s"; $vals[] = sanitize_text_field($v); }
        }

        if ($request->get_param('customer_id')) {
            $where[] = 'customer_id = %d';
            $vals[]  = (int) $request->get_param('customer_id');
        }

        $resp = $this->paginate($request, 'bds_needs', $where, $vals, 'ORDER BY created_at DESC');
        $data = array_map(function ($item) {
            if (!empty($item['customer_id'])) {
                global $wpdb;
                $c = $wpdb->get_row($wpdb->prepare("SELECT full_name, phone FROM {$wpdb->prefix}bds_customers WHERE id = %d", $item['customer_id']));
                $item['customer_name'] = $c ? $c->full_name : '';
                $item['customer_phone'] = $c ? $c->phone : '';
            }
            if (!empty($item['assigned_to'])) {
                $u = get_userdata($item['assigned_to']);
                $item['assigned_to_name'] = $u ? $u->display_name : '';
            }
            return $item;
        }, $resp->get_data());

        $resp->set_data($data);
        BDS_Activity_Logger::log_view('need');
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_needs WHERE id = %d", (int) $request['id']));
        if (!$item) return $this->not_found();
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;

        $customer_id = (int) ($request->get_param('customer_id') ?? 0);
        if (!$customer_id) return $this->bad_request('Thiếu thông tin khách hàng');

        $uid  = get_current_user_id();
        $data = [
            'code'               => sanitize_text_field($request->get_param('code') ?? ''),
            'title'              => sanitize_text_field($request->get_param('title') ?? ''),
            'customer_id'        => $customer_id,
            'type'               => sanitize_text_field($request->get_param('type') ?? 'buy'),
            'tier'               => sanitize_text_field($request->get_param('tier') ?? 'primary'),
            'project_preference' => sanitize_text_field($request->get_param('project_preference') ?? ''),
            'budget_min'         => (float) ($request->get_param('budget_min') ?? 0),
            'budget_max'         => (float) ($request->get_param('budget_max') ?? 0),
            'bedrooms'           => sanitize_text_field($request->get_param('bedrooms') ?? ''),
            'area_min'           => (float) ($request->get_param('area_min') ?? 0),
            'area_max'           => (float) ($request->get_param('area_max') ?? 0),
            'activity_status'    => sanitize_text_field($request->get_param('activity_status') ?? 'active'),
            'buy_status'         => sanitize_text_field($request->get_param('buy_status') ?? ''),
            'processing_status'  => sanitize_text_field($request->get_param('processing_status') ?? ''),
            'classification'     => sanitize_text_field($request->get_param('classification') ?? ''),
            'label_tag'          => sanitize_text_field($request->get_param('label_tag') ?? ''),
            'need_type'          => sanitize_text_field($request->get_param('need_type') ?? ''),
            'finance_type'       => sanitize_text_field($request->get_param('finance_type') ?? ''),
            'score'              => (int) ($request->get_param('score') ?? 0),
            'assigned_to'        => $request->get_param('assigned_to') ? (int) $request->get_param('assigned_to') : $uid,
            'created_by'         => $uid,
            'created_at'         => current_time('mysql'),
            'updated_at'         => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_needs', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('need', $id, $data['title'] ?: "NCD-$id");

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_needs WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_needs WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $data = [];
        $str_fields = ['code', 'title', 'type', 'tier', 'project_preference', 'bedrooms', 'activity_status', 'buy_status', 'processing_status', 'classification', 'label_tag', 'need_type', 'finance_type'];
        foreach ($str_fields as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        foreach (['budget_min', 'budget_max', 'area_min', 'area_max'] as $f) {
            if ($request->has_param($f)) $data[$f] = (float) $request->get_param($f);
        }
        if ($request->has_param('score')) $data['score'] = (int) $request->get_param('score');
        if ($request->has_param('assigned_to')) $data['assigned_to'] = (int) $request->get_param('assigned_to');
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_needs', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('need', $id, $existing->title ?: "NCD-$id");

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_needs WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_needs WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $wpdb->delete($wpdb->prefix . 'bds_needs', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('need', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
