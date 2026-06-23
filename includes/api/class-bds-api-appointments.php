<?php
defined('ABSPATH') || exit;

class BDS_API_Appointments extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/appointments', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/appointments/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
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

        foreach (['type', 'status'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') { $where[] = "{$f} = %s"; $vals[] = sanitize_text_field($v); }
        }

        if ($request->get_param('customer_id')) {
            $where[] = 'customer_id = %d';
            $vals[]  = (int) $request->get_param('customer_id');
        }

        $resp = $this->paginate($request, 'bds_appointments', $where, $vals, 'ORDER BY appointment_date DESC, created_at DESC');
        $data = array_map(function ($item) {
            global $wpdb;
            if (!empty($item['customer_id'])) {
                $c = $wpdb->get_row($wpdb->prepare("SELECT full_name, phone FROM {$wpdb->prefix}bds_customers WHERE id = %d", $item['customer_id']));
                $item['customer_name']  = $c ? $c->full_name : '';
                $item['customer_phone'] = $c ? $c->phone : '';
            }
            foreach (['assigned_to' => 'assigned_to_name', 'handler' => 'handler_name', 'created_by' => 'created_by_name'] as $field => $name_field) {
                if (!empty($item[$field])) {
                    $u = get_userdata((int) $item[$field]);
                    $item[$name_field] = $u ? $u->display_name : '';
                }
            }
            return $item;
        }, $resp->get_data());

        $resp->set_data($data);
        BDS_Activity_Logger::log_view('appointment');
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_appointments WHERE id = %d", (int) $request['id']));
        if (!$item) return $this->not_found();
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $uid = get_current_user_id();

        $data = [
            'type'             => sanitize_text_field($request->get_param('type') ?? 'consultation'),
            'customer_id'      => (int) ($request->get_param('customer_id') ?? 0),
            'need_id'          => (int) ($request->get_param('need_id') ?? 0) ?: null,
            'property_id'      => (int) ($request->get_param('property_id') ?? 0) ?: null,
            'assigned_to'      => $request->get_param('assigned_to') ? (int) $request->get_param('assigned_to') : $uid,
            'handler'          => (int) ($request->get_param('handler') ?? 0) ?: null,
            'location'         => sanitize_text_field($request->get_param('location') ?? ''),
            'appointment_date' => $request->get_param('appointment_date') ? sanitize_text_field($request->get_param('appointment_date')) : null,
            'status'           => sanitize_text_field($request->get_param('status') ?? 'pending'),
            'notes'            => sanitize_textarea_field($request->get_param('notes') ?? ''),
            'created_by'       => $uid,
            'created_at'       => current_time('mysql'),
            'updated_at'       => current_time('mysql'),
        ];

        if (!$data['customer_id']) return $this->bad_request('Thiếu thông tin khách hàng');

        $wpdb->insert($wpdb->prefix . 'bds_appointments', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('appointment', $id);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_appointments WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_appointments WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $data = [];
        foreach (['type', 'location', 'status', 'notes'] as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        foreach (['customer_id', 'need_id', 'property_id', 'assigned_to', 'handler'] as $f) {
            if ($request->has_param($f)) $data[$f] = (int) $request->get_param($f) ?: null;
        }
        if ($request->has_param('appointment_date')) {
            $data['appointment_date'] = sanitize_text_field($request->get_param('appointment_date'));
        }
        if (isset($data['status']) && $data['status'] !== $existing->status) {
            $data['status_updated_at'] = current_time('mysql');
        }
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_appointments', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('appointment', $id);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_appointments WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_appointments WHERE id = %d", $id));
        if (!$existing) return $this->not_found();

        $wpdb->delete($wpdb->prefix . 'bds_appointments', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('appointment', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
