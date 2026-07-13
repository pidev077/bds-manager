<?php
defined('ABSPATH') || exit;

class BDS_API_Cart extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/cart', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
        register_rest_route($ns, '/cart/(?P<id>\d+)', [
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'permission_callback']],
        ]);
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $customer_id = (int) ($request->get_param('customer_id') ?? 0);
        if (!$customer_id) return $this->bad_request('Thiếu customer_id');
        if (!$this->can_access_customer($customer_id)) return $this->forbidden();

        // Giỏ hàng bán và giỏ hàng cho thuê là 2 trang riêng (2 phân khúc sale khác nhau phụ trách),
        // cùng đọc từ bds_cart_items nhưng lọc theo listing_type của căn để tách dữ liệu hiển thị.
        $where = 'ci.customer_id = %d';
        $vals  = [$customer_id];

        $listing_type = sanitize_text_field($request->get_param('listing_type') ?? '');
        if ($listing_type === 'sale') {
            $where .= " AND p.listing_type IN ('sale','both')";
        } elseif ($listing_type === 'rent') {
            $where .= " AND p.listing_type IN ('rent','both')";
        }

        // Nhân viên bị giới hạn phân khúc thì dù có cố gọi API với listing_type khác cũng không thấy
        // được — AND thêm điều kiện phân khúc của chính nhân viên đó vào, độc lập với param FE gửi lên.
        $segment_where = BDS_Roles::segment_where_clause('p.listing_type');
        if ($segment_where !== '') {
            $where .= " AND {$segment_where}";
        }

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT ci.*, p.code AS property_code, p.unit_number AS property_unit_number, p.title AS property_title,
                    p.price AS property_price, p.price_rent AS property_price_rent, p.listing_type AS property_listing_type,
                    p.project_name AS property_project, p.status AS property_status,
                    p.area_gross AS property_area_gross, p.bedrooms AS property_bedrooms, p.property_type AS property_type
             FROM {$wpdb->prefix}bds_cart_items ci
             LEFT JOIN {$wpdb->prefix}bds_properties p ON p.id = ci.property_id
             WHERE {$where}
             ORDER BY ci.created_at DESC",
            ...$vals
        ));

        $data = array_map(function ($item) {
            $item = (array) $item;
            if (empty($item['property_code'])) $item['property_code'] = $item['property_unit_number'] ?? '';
            unset($item['property_unit_number']);
            foreach (['id', 'customer_id', 'property_id', 'added_by'] as $k) {
                if (isset($item[$k])) $item[$k] = (int) $item[$k];
            }
            // $wpdb trả cột số dạng chuỗi (VD "0.00") — chuỗi đó là truthy trong JS nên phải ép về
            // float thật để "chưa có giá thuê" hiện đúng dấu "-" thay vì "0.00 đ/tháng".
            foreach (['property_price', 'property_price_rent', 'property_area_gross'] as $k) {
                if (isset($item[$k])) $item[$k] = (float) $item[$k];
            }
            return $item;
        }, $rows);

        return new WP_REST_Response($data);
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $uid = get_current_user_id();
        $customer_id = (int) ($request->get_param('customer_id') ?? 0);
        $property_id = (int) ($request->get_param('property_id') ?? 0);

        if (!$customer_id || !$property_id) return $this->bad_request('Thiếu customer_id hoặc property_id');
        if (!$this->can_access_customer($customer_id)) return $this->forbidden();

        $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->prefix}bds_cart_items (customer_id, property_id, added_by, created_at) VALUES (%d, %d, %d, %s)",
            $customer_id, $property_id, $uid, current_time('mysql')
        ));

        $id = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}bds_cart_items WHERE customer_id = %d AND property_id = %d",
            $customer_id, $property_id
        ));

        BDS_Activity_Logger::log_create('cart_item', (int) $id, "Khách #{$customer_id} - Căn #{$property_id}");

        return new WP_REST_Response(['id' => (int) $id, 'customer_id' => $customer_id, 'property_id' => $property_id], 201);
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        global $wpdb;
        $id = (int) $request['id'];
        $existing = $wpdb->get_row($wpdb->prepare("SELECT id, customer_id FROM {$wpdb->prefix}bds_cart_items WHERE id = %d", $id));
        if (!$existing) return $this->not_found();
        if (!$this->can_access_customer((int) $existing->customer_id)) return $this->forbidden();
        $wpdb->delete($wpdb->prefix . 'bds_cart_items', ['id' => $id], ['%d']);
        BDS_Activity_Logger::log_delete('cart_item', $id);
        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }
}
