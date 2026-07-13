<?php
defined('ABSPATH') || exit;

class BDS_API_Customers extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/customers', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/customers/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    protected function can_view_customer($customer): bool {
        $uid = get_current_user_id();
        if (BDS_Roles::is_admin($uid)) return true;
        if (BDS_Roles::is_manager($uid)) return true;
        return (int) $customer->assigned_to === $uid || (int) $customer->created_by === $uid;
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;
        $uid     = get_current_user_id();
        $where   = [];
        $vals    = [];
        $table   = $wpdb->prefix . 'bds_customers';

        if (!BDS_Roles::is_admin($uid) && !BDS_Roles::is_manager($uid)) {
            $where[] = '(assigned_to = %d OR created_by = %d)';
            $vals[]  = $uid;
            $vals[]  = $uid;
        }

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search) {
            $where[] = '(full_name LIKE %s OR phone LIKE %s OR email LIKE %s)';
            $vals    = array_merge($vals, ["%$search%", "%$search%", "%$search%"]);
        }

        foreach (['connection_status', 'verification_status', 'classification'] as $f) {
            $v = $request->get_param($f);
            if ($v !== null && $v !== '') { $where[] = "{$f} = %s"; $vals[] = sanitize_text_field($v); }
        }

        if ($request->get_param('tab') === 'referrer') {
            $where[] = 'referrer_id IS NOT NULL AND referrer_id > 0';
        }

        BDS_Activity_Logger::log_view('customer');

        $resp = $this->paginate($request, 'bds_customers', $where, $vals, 'ORDER BY created_at DESC');
        $data = $resp->get_data();

        // Enrich with assigned user name and referrer name
        $data = array_map(function ($item) {
            if (!empty($item['assigned_to'])) {
                $u = get_userdata($item['assigned_to']);
                $item['assigned_to_name'] = $u ? $u->display_name : '';
            }
            if (!empty($item['referrer_id'])) {
                global $wpdb;
                $ref = $wpdb->get_row($wpdb->prepare("SELECT full_name FROM {$wpdb->prefix}bds_customers WHERE id = %d", $item['referrer_id']));
                $item['referrer_name'] = $ref ? $ref->full_name : '';
            }
            return $item;
        }, $data);

        $resp->set_data($data);
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_customers WHERE id = %d", (int) $request['id']));
        if (!$item) return $this->not_found();
        if (!$this->can_view_customer($item)) return $this->forbidden();
        BDS_Activity_Logger::log_view('customer', (int) $request['id']);
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;

        $full_name = sanitize_text_field($request->get_param('full_name') ?? '');
        if (!$full_name) return $this->bad_request('Tên khách hàng không được để trống');

        $uid = get_current_user_id();
        $data = [
            'full_name'           => $full_name,
            'phone'               => sanitize_text_field($request->get_param('phone') ?? ''),
            'email'               => sanitize_email($request->get_param('email') ?? ''),
            'source_detail'       => sanitize_text_field($request->get_param('source_detail') ?? ''),
            'source_overview'     => sanitize_text_field($request->get_param('source_overview') ?? ''),
            'source_url'          => esc_url_raw($request->get_param('source_url') ?? ''),
            'vinclub_rank'        => sanitize_text_field($request->get_param('vinclub_rank') ?? ''),
            'connection_status'   => sanitize_text_field($request->get_param('connection_status') ?? 'not_connected'),
            'verification_status' => sanitize_text_field($request->get_param('verification_status') ?? 'unverified'),
            'classification'      => sanitize_text_field($request->get_param('classification') ?? ''),
            'consent_status'      => (int) ($request->get_param('consent_status') ?? 0),
            'referrer_id'         => (int) ($request->get_param('referrer_id') ?? 0) ?: null,
            'notes'               => sanitize_textarea_field($request->get_param('notes') ?? ''),
            'assigned_to'         => $request->get_param('assigned_to') ? (int) $request->get_param('assigned_to') : $uid,
            'created_by'          => $uid,
            'updated_by'          => $uid,
            'created_at'          => current_time('mysql'),
            'updated_at'          => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_customers', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('customer', $id, $full_name);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_customers WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_customers WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_view_customer($existing)) return $this->forbidden();

        $data = [];
        $str_fields = ['full_name', 'phone', 'source_detail', 'source_overview', 'vinclub_rank', 'connection_status', 'verification_status', 'classification', 'auto_classification', 'cdp_segment', 'notes'];
        foreach ($str_fields as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        if ($request->has_param('email')) $data['email'] = sanitize_email($request->get_param('email'));
        if ($request->has_param('source_url')) $data['source_url'] = esc_url_raw($request->get_param('source_url'));
        if ($request->has_param('consent_status')) $data['consent_status'] = (int) $request->get_param('consent_status');
        if ($request->has_param('assigned_to')) $data['assigned_to'] = (int) $request->get_param('assigned_to');
        if ($request->has_param('referrer_id')) $data['referrer_id'] = (int) $request->get_param('referrer_id') ?: null;
        $data['updated_by'] = get_current_user_id();
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_customers', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('customer', $id, $existing->full_name);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_customers WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];

        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, full_name, assigned_to, created_by FROM {$wpdb->prefix}bds_customers WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_view_customer($existing)) return $this->forbidden();
        if (!BDS_Roles::is_admin()) return $this->forbidden();

        $wpdb->delete($wpdb->prefix . 'bds_customers', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('customer', $id, $existing->full_name);

        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
