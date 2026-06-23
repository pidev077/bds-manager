<?php
defined('ABSPATH') || exit;

class BDS_Activity_Logger {

    public static function log(string $action, string $description = '', string $object_type = '', int $object_id = 0, array $metadata = []): int {
        global $wpdb;

        $user_id = get_current_user_id();
        if (!$user_id) return 0;

        $ip = self::get_ip();

        $result = $wpdb->insert(
            $wpdb->prefix . 'bds_activity_logs',
            [
                'user_id'     => $user_id,
                'action'      => sanitize_text_field($action),
                'object_type' => sanitize_text_field($object_type),
                'object_id'   => $object_id,
                'description' => sanitize_textarea_field($description),
                'ip_address'  => $ip,
                'user_agent'  => isset($_SERVER['HTTP_USER_AGENT']) ? substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT']), 0, 255) : '',
                'metadata'    => !empty($metadata) ? wp_json_encode($metadata) : null,
                'created_at'  => current_time('mysql'),
            ],
            ['%d', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s']
        );

        return $result ? $wpdb->insert_id : 0;
    }

    public static function log_create(string $object_type, int $object_id, string $label = ''): int {
        return self::log(
            "create_{$object_type}",
            "Tạo mới {$object_type}" . ($label ? ": {$label}" : ''),
            $object_type,
            $object_id
        );
    }

    public static function log_update(string $object_type, int $object_id, string $label = ''): int {
        return self::log(
            "update_{$object_type}",
            "Cập nhật {$object_type}" . ($label ? ": {$label}" : ''),
            $object_type,
            $object_id
        );
    }

    public static function log_delete(string $object_type, int $object_id, string $label = ''): int {
        return self::log(
            "delete_{$object_type}",
            "Xóa {$object_type}" . ($label ? ": {$label}" : ''),
            $object_type,
            $object_id
        );
    }

    public static function log_view(string $object_type, int $object_id = 0): int {
        return self::log(
            "view_{$object_type}",
            "Xem trang {$object_type}",
            $object_type,
            $object_id
        );
    }

    private static function get_ip(): string {
        $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
        foreach ($keys as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = trim(explode(',', $_SERVER[$key])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
            }
        }
        return '0.0.0.0';
    }

    public static function get_action_label(string $action): string {
        $labels = [
            'create_property'    => 'Thêm nhà bán',
            'update_property'    => 'Cập nhật nhà bán',
            'delete_property'    => 'Xóa nhà bán',
            'create_customer'    => 'Thêm khách hàng',
            'update_customer'    => 'Cập nhật khách hàng',
            'delete_customer'    => 'Xóa khách hàng',
            'create_need'        => 'Thêm nhu cầu',
            'update_need'        => 'Cập nhật nhu cầu',
            'delete_need'        => 'Xóa nhu cầu',
            'create_appointment' => 'Tạo lịch hẹn',
            'update_appointment' => 'Cập nhật lịch hẹn',
            'delete_appointment' => 'Xóa lịch hẹn',
            'create_deposit'     => 'Tạo cọc thiện chí',
            'update_deposit'     => 'Cập nhật cọc thiện chí',
            'delete_deposit'     => 'Xóa cọc thiện chí',
            'create_transaction' => 'Tạo giao dịch',
            'update_transaction' => 'Cập nhật giao dịch',
            'delete_transaction' => 'Xóa giao dịch',
            'view_property'      => 'Xem nhà bán',
            'view_customer'      => 'Xem khách hàng',
            'view_transaction'   => 'Xem giao dịch',
        ];
        return $labels[$action] ?? ucfirst(str_replace('_', ' ', $action));
    }
}
