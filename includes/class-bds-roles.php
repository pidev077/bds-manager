<?php
defined('ABSPATH') || exit;

class BDS_Roles {

    const ROLE_ADMIN   = 'bds_admin';
    const ROLE_MANAGER = 'bds_manager';
    const ROLE_EMPLOYEE = 'bds_employee';

    // Capabilities
    const CAPS = [
        'bds_view_all_customers'    => 'Xem tất cả khách hàng',
        'bds_manage_properties'     => 'Quản lý nhà bán',
        'bds_manage_customers'      => 'Quản lý khách hàng',
        'bds_manage_needs'          => 'Quản lý nhu cầu',
        'bds_manage_appointments'   => 'Quản lý lịch hẹn',
        'bds_manage_deposits'       => 'Quản lý cọc thiện chí',
        'bds_manage_transactions'   => 'Quản lý giao dịch',
        'bds_view_reports'          => 'Xem báo cáo',
        'bds_view_all_reports'      => 'Xem báo cáo tất cả nhân viên',
        'bds_view_activity_log'     => 'Xem nhật ký hoạt động',
        'bds_manage_users'          => 'Quản lý người dùng',
        'bds_manage_sale_requests'  => 'Quản lý yêu cầu sale',
    ];

    public static function add_roles() {
        // BDS Employee
        add_role(self::ROLE_EMPLOYEE, 'Nhân viên BDS', [
            'read'                   => true,
            'bds_manage_properties'  => true,
            'bds_manage_customers'   => true,
            'bds_manage_needs'       => true,
            'bds_manage_appointments'=> true,
            'bds_manage_deposits'    => true,
            'bds_manage_transactions'=> true,
            'bds_view_reports'       => true,
        ]);

        // BDS Manager
        add_role(self::ROLE_MANAGER, 'Quản lý BDS', [
            'read'                      => true,
            'bds_manage_properties'     => true,
            'bds_manage_customers'      => true,
            'bds_view_all_customers'    => true,
            'bds_manage_needs'          => true,
            'bds_manage_appointments'   => true,
            'bds_manage_deposits'       => true,
            'bds_manage_transactions'   => true,
            'bds_view_reports'          => true,
            'bds_view_all_reports'      => true,
            'bds_manage_sale_requests'  => true,
        ]);

        // BDS Admin
        add_role(self::ROLE_ADMIN, 'Admin BDS', array_merge(
            ['read' => true],
            array_fill_keys(array_keys(self::CAPS), true)
        ));

        // Give WP administrator all BDS caps
        $wp_admin = get_role('administrator');
        if ($wp_admin) {
            foreach (array_keys(self::CAPS) as $cap) {
                $wp_admin->add_cap($cap);
            }
        }
    }

    public static function remove_roles() {
        remove_role(self::ROLE_EMPLOYEE);
        remove_role(self::ROLE_MANAGER);
        remove_role(self::ROLE_ADMIN);

        $wp_admin = get_role('administrator');
        if ($wp_admin) {
            foreach (array_keys(self::CAPS) as $cap) {
                $wp_admin->remove_cap($cap);
            }
        }
    }

    public static function is_admin(int $user_id = 0): bool {
        $user_id = $user_id ?: get_current_user_id();
        $user = get_userdata($user_id);
        if (!$user) return false;
        return in_array('administrator', $user->roles, true)
            || in_array(self::ROLE_ADMIN, $user->roles, true)
            || user_can($user_id, 'bds_manage_users');
    }

    public static function is_manager(int $user_id = 0): bool {
        $user_id = $user_id ?: get_current_user_id();
        if (self::is_admin($user_id)) return true;
        return user_can($user_id, 'bds_view_all_reports');
    }

    public static function get_role_label(int $user_id): string {
        if (self::is_admin($user_id)) return 'Admin';
        if (self::is_manager($user_id)) return 'Quản lý';
        return 'Nhân viên';
    }
}
