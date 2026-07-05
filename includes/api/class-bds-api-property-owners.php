<?php
defined('ABSPATH') || exit;

class BDS_API_Property_Owners extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/property-owners', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/property-owners/(?P<id>\d+)', [
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

        if ($request->get_param('property_id')) {
            $where[] = 'property_id = %d';
            $vals[] = (int) $request->get_param('property_id');
        }

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search !== '') {
            [$clause, $search_vals] = $this->search_where($search, ['owner_name', 'owner_phone']);
            $where[] = $clause;
            $vals = array_merge($vals, $search_vals);
        }

        $resp = $this->paginate($request, 'bds_property_owners', $where, $vals, 'ORDER BY created_at DESC');
        $data = array_map(function ($item) {
            global $wpdb;
            if (!empty($item['property_id'])) {
                $p = $wpdb->get_row($wpdb->prepare("SELECT code, title, unit_number FROM {$wpdb->prefix}bds_properties WHERE id = %d", $item['property_id']));
                $item['property_code'] = $p ? ($p->code ?: $p->unit_number) : '';
                $item['property_title'] = $p ? $p->title : '';
            }
            $this->enrich_with_user($item, ['assigned_to' => 'assigned_to_name']);
            return $item;
        }, $resp->get_data());

        $resp->set_data($data);
        return $resp;
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_property_owners WHERE id = %d", (int) $request['id']));
        if (!$item) return $this->not_found();
        if (!$this->can_access_record($item)) return $this->forbidden();
        return new WP_REST_Response($this->format_item($item));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $uid = get_current_user_id();

        $property_id = (int) ($request->get_param('property_id') ?? 0);
        $owner_name = sanitize_text_field($request->get_param('owner_name') ?? '');
        if (!$property_id || $owner_name === '') return $this->bad_request('Thiếu thông tin căn hoặc tên chủ nhà');

        $data = [
            'property_id'      => $property_id,
            'owner_name'       => $owner_name,
            'owner_phone'      => sanitize_text_field($request->get_param('owner_phone') ?? ''),
            'selling_price'    => (float) ($request->get_param('selling_price') ?? 0),
            'commission_rate'  => (float) ($request->get_param('commission_rate') ?? 0),
            'notes'            => sanitize_textarea_field($request->get_param('notes') ?? ''),
            'assigned_to'      => $request->get_param('assigned_to') ? (int) $request->get_param('assigned_to') : $uid,
            'created_by'       => $uid,
            'created_at'       => current_time('mysql'),
            'updated_at'       => current_time('mysql'),
        ];

        $wpdb->insert($wpdb->prefix . 'bds_property_owners', $data);
        if (!$wpdb->insert_id) return new WP_Error('db_error', 'Lỗi lưu dữ liệu', ['status' => 500]);

        $id = $wpdb->insert_id;
        BDS_Activity_Logger::log_create('property_owner', $id, $data['owner_name']);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_property_owners WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_property_owners WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_access_record($existing)) return $this->forbidden();

        $data = [];
        foreach (['owner_name', 'owner_phone', 'notes'] as $f) {
            if ($request->has_param($f)) $data[$f] = sanitize_text_field($request->get_param($f) ?? '');
        }
        if ($request->has_param('notes')) $data['notes'] = sanitize_textarea_field($request->get_param('notes') ?? '');
        if ($request->has_param('selling_price')) $data['selling_price'] = (float) $request->get_param('selling_price');
        if ($request->has_param('commission_rate')) $data['commission_rate'] = (float) $request->get_param('commission_rate');
        foreach (['property_id', 'assigned_to'] as $f) {
            if ($request->has_param($f)) $data[$f] = (int) $request->get_param($f) ?: null;
        }
        $data['updated_at'] = current_time('mysql');

        $wpdb->update($wpdb->prefix . 'bds_property_owners', $data, ['id' => $id]);
        BDS_Activity_Logger::log_update('property_owner', $id, $existing->owner_name);

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_property_owners WHERE id = %d", $id));
        return new WP_REST_Response($this->format_item($item));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        if (!$wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bds_property_owners WHERE id = %d", $id))) return $this->not_found();
        if (!BDS_Roles::is_admin()) return $this->forbidden();
        $wpdb->delete($wpdb->prefix . 'bds_property_owners', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('property_owner', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
