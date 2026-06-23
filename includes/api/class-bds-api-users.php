<?php
defined('ABSPATH') || exit;

class BDS_API_Users extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/users', [
            ['methods' => 'GET',  'callback' => [$this, 'get_items'],   'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'POST', 'callback' => [$this, 'create_item'], 'permission_callback' => [$this, 'admin_permission']],
        ]);
        register_rest_route($ns, '/users/me', [
            'methods' => 'GET', 'callback' => [$this, 'get_me'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/users/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [$this, 'get_item'],    'permission_callback' => [$this, 'permission_callback']],
            ['methods' => 'PUT',    'callback' => [$this, 'update_item'], 'permission_callback' => [$this, 'admin_permission']],
            ['methods' => 'DELETE', 'callback' => [$this, 'delete_item'], 'permission_callback' => [$this, 'admin_permission']],
        ]);
    }

    public function get_me(): WP_REST_Response {
        $user = wp_get_current_user();
        return new WP_REST_Response($this->format_user($user));
    }

    public function get_items(WP_REST_Request $request): WP_REST_Response {
        $args = [
            'role__in' => [BDS_Roles::ROLE_EMPLOYEE, BDS_Roles::ROLE_MANAGER, BDS_Roles::ROLE_ADMIN, 'administrator'],
            'number'   => 200,
            'orderby'  => 'display_name',
            'order'    => 'ASC',
        ];

        $search = sanitize_text_field($request->get_param('search') ?? '');
        if ($search) {
            $args['search'] = '*' . $search . '*';
            $args['search_columns'] = ['display_name', 'user_email'];
        }

        $users = get_users($args);
        $data  = array_map([$this, 'format_user'], $users);
        return new WP_REST_Response($data);
    }

    public function get_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        $user = get_userdata((int) $request['id']);
        if (!$user) return $this->not_found();
        return new WP_REST_Response($this->format_user($user));
    }

    public function create_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        $email    = sanitize_email($request->get_param('email') ?? '');
        $username = sanitize_user($request->get_param('username') ?? $email);
        $password = $request->get_param('password') ?? wp_generate_password();
        $role     = sanitize_text_field($request->get_param('role') ?? BDS_Roles::ROLE_EMPLOYEE);

        if (!$email) return $this->bad_request('Email không được để trống');
        if (email_exists($email)) return $this->bad_request('Email đã tồn tại trong hệ thống');

        $user_id = wp_insert_user([
            'user_login'   => $username,
            'user_email'   => $email,
            'user_pass'    => $password,
            'display_name' => sanitize_text_field($request->get_param('display_name') ?? ''),
            'role'         => $role,
        ]);

        if (is_wp_error($user_id)) {
            return new WP_Error('create_failed', $user_id->get_error_message(), ['status' => 400]);
        }

        BDS_Activity_Logger::log('create_user', "Tạo tài khoản: {$email}", 'user', $user_id);

        $user = get_userdata($user_id);
        return new WP_REST_Response($this->format_user($user), 201);
    }

    public function update_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        $id   = (int) $request['id'];
        $user = get_userdata($id);
        if (!$user) return $this->not_found();

        $data = ['ID' => $id];
        if ($request->has_param('display_name')) $data['display_name'] = sanitize_text_field($request->get_param('display_name'));
        if ($request->has_param('email')) $data['user_email'] = sanitize_email($request->get_param('email'));
        if ($request->has_param('password') && $request->get_param('password')) {
            $data['user_pass'] = $request->get_param('password');
        }

        wp_update_user($data);

        if ($request->has_param('role')) {
            $user->set_role(sanitize_text_field($request->get_param('role')));
        }

        BDS_Activity_Logger::log('update_user', "Cập nhật tài khoản ID: $id", 'user', $id);

        return new WP_REST_Response($this->format_user(get_userdata($id)));
    }

    public function delete_item(WP_REST_Request $request): WP_REST_Response|WP_Error {
        $id = (int) $request['id'];
        if ($id === get_current_user_id()) return $this->bad_request('Không thể xóa tài khoản đang đăng nhập');

        $user = get_userdata($id);
        if (!$user) return $this->not_found();

        require_once ABSPATH . 'wp-admin/includes/user.php';
        wp_delete_user($id);
        BDS_Activity_Logger::log('delete_user', "Xóa tài khoản: {$user->user_email}", 'user', $id);

        return new WP_REST_Response(['deleted' => true, 'id' => $id]);
    }

    private function format_user(WP_User $user): array {
        return [
            'id'           => (int) $user->ID,
            'username'     => $user->user_login,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
            'roles'        => array_values($user->roles),
            'role_label'   => BDS_Roles::get_role_label($user->ID),
            'avatar'       => get_avatar_url($user->ID, ['size' => 64]),
            'registered'   => $user->user_registered,
            'is_admin'     => BDS_Roles::is_admin($user->ID),
            'is_manager'   => BDS_Roles::is_manager($user->ID),
        ];
    }
}
