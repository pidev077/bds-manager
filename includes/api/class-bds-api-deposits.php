<?php
defined('ABSPATH') || exit;

class BDS_API_Deposits extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/deposits', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/deposits/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        $uid = get_current_user_id();
        $where = []; $vals = [];

        if (!BDS_Roles::is_admin($uid) && !BDS_Roles::is_manager($uid)) {
            $where[] = '(assigned_to = %d OR created_by = %d)';
            $vals[] = $uid; $vals[] = $uid;
        }

        foreach (['activity_status', 'booking_status', 'project'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') { $where[] = "{$f} = %s"; $vals[] = sanitize_text_field($v); }
        }

        if ($request->get_param('customer_id')) {
            $where[] = 'customer_id = %d';
            $vals[] = (int) $request->get_param('customer_id');
        }

        $resp = $this->paginate($request, 'bds_deposits', $where, $vals, 'ORDER BY created_at DESC');
        $data = array_map(function ($item) {
            global $wpdb;
            if (!empty($item['customer_id'])) {
                $c = $wpdb->get_row($wpdb->prepare("SELECT full_name FROM {$wpdb->prefix}bds_customers WHERE id = %d", $item['customer_id']));
                $item['customer_name'] = $c ? $c->full_name : '';
            }
            foreach (['assigned_to' => 'assigned_to_name', 'support_person' => 'support_person_name'] as $f => $n) {
                if (!empty($item[$f])) { $u = get_userdata($item[$f]); $item[$n] = $u ? $u->display_name : ''; }
            }
            return $item;
        }, $resp->get_data());

        $resp->set_data($data);
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_deposits WHERE id = %d", (int) $request['id']));
        if (!$item) return $this->not_found();
        if (!$this->can_access_record($item)) return $this->forbidden();
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $uid = get_current_user_id();

        $data = [
            'name'             => sanitize_text_field($request->get_param('name') ?? ''),
            'customer_id'      => (int) ($request->get_param('customer_id') ?? 0),
            'property_id'      => (int) ($request->get_param('property_id') ?? 0) ?: null,
            'campaign'         => sanitize_text_field($request->get_param('campaign') ?? ''),
            'project'          => sanitize_text_field($request->get_param('project') ?? ''),
            'zone'             => sanitize_text_field($request->get_param('zone') ?? ''),
            'activity_status'  => sanitize_text_field($request->get_param('activity_status') ?? 'active'),
            'booking_status'   => sanitize_text_field($request->get_param('booking_status') ?? 'pending'),
            'booking_count'    => (int) ($request->get_param('booking_count') ?? 0),
            'total_amount'     => (float) ($request->get_param('total_amount') ?? 0),
            'property_type'    => sanitize_text_field($request->get_param('property_type') ?? ''),
            'specific_request' => sanitize_textarea_field($request->get_param('specific_request') ?? ''),
            'assigned_to'      => $request->get_param('assigned_to') ? (int) $request->get_param('assigned_to') : $uid,
            'support_person'   => (int) ($request->get_param('support_person') ?? 0) ?: null,
            'notes'            => sanitize_textarea_field($request->get_param('notes') ?? ''),
            'created_by'       => $uid,
            'created_at'       => current_time('mysql'),
            'updated_at'       => current_time('mysql'),
        ];

        if (!$data['customer_id']) return $this->bad_request('Thiếu thông tin khách hàng');

        $wpdb->insert($wpdb->prefix . 'bds_deposits', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('deposit', $id, $data['name']);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_deposits WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_deposits WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_access_record($existing)) return $this->forbidden();

        $data = [];
        foreach (['name', 'campaign', 'project', 'zone', 'activity_status', 'booking_status', 'property_type', 'specific_request', 'notes'] as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        if ($request->has_param('total_amount')) $data['total_amount'] = (float) $request->get_param('total_amount');
        if ($request->has_param('booking_count')) $data['booking_count'] = (int) $request->get_param('booking_count');
        foreach (['customer_id', 'property_id', 'assigned_to', 'support_person'] as $f) {
            if ($request->has_param($f)) $data[$f] = (int) $request->get_param($f) ?: null;
        }
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_deposits', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('deposit', $id, $existing->name);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_deposits WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        if (!$wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_deposits WHERE id = %d", $id))) return $this->not_found();
        if (!BDS_Roles::is_admin()) return $this->forbidden();
        $wpdb->delete($wpdb->prefix . 'bds_deposits', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('deposit', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
