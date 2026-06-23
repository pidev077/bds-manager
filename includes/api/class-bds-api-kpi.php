<?php
defined('ABSPATH') || exit;

class BDS_API_KPI extends BDS_API_Base {

    public function register_routes(): void {
        $ns = $this->namespace;
        register_rest_route($ns, '/kpi/me', [
            'methods' => 'GET', 'callback' => [$this, 'get_my_kpi'],
            'permission_callback' => [$this, 'permission_callback'],
        ]);
        register_rest_route($ns, '/kpi/summary', [
            'methods' => 'GET', 'callback' => [$this, 'get_summary'],
            'permission_callback' => [$this, 'manager_permission'],
        ]);
        register_rest_route($ns, '/kpi/users/(?P<user_id>\d+)', [
            'methods' => 'GET', 'callback' => [$this, 'get_user_kpi'],
            'permission_callback' => [$this, 'manager_permission'],
        ]);
    }

    public function get_my_kpi(WP_REST_Request $request): WP_REST_Response {
        $user_id = get_current_user_id();
        return new WP_REST_Response($this->calculate_kpi($user_id, $request));
    }

    public function get_user_kpi(WP_REST_Request $request): WP_REST_Response {
        return new WP_REST_Response($this->calculate_kpi((int) $request['user_id'], $request));
    }

    public function get_summary(WP_REST_Request $request): WP_REST_Response {
        $users = get_users([
            'fields'   => ['ID', 'display_name', 'user_email'],
            'role__in' => [BDS_Roles::ROLE_EMPLOYEE, BDS_Roles::ROLE_MANAGER, BDS_Roles::ROLE_ADMIN, 'administrator'],
            'number'   => 200,
        ]);

        $result = [];
        foreach ($users as $user) {
            $kpi = $this->calculate_kpi((int) $user->ID, $request);
            $kpi['user_id']   = (int) $user->ID;
            $kpi['user_name'] = $user->display_name;
            $kpi['user_email']= $user->user_email;
            $kpi['role']      = BDS_Roles::get_role_label((int) $user->ID);
            $result[] = $kpi;
        }

        return new WP_REST_Response($result);
    }

    private function calculate_kpi(int $user_id, WP_REST_Request $request): array {
        global $wpdb;

        $period  = sanitize_text_field($request->get_param('period') ?? 'month');
        $year    = (int) ($request->get_param('year') ?? date('Y'));
        $month   = (int) ($request->get_param('month') ?? date('n'));

        [$date_from, $date_to] = $this->get_date_range($period, $year, $month);

        $p  = $wpdb->prefix;
        $df = $date_from;
        $dt = $date_to;

        $properties = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_properties WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $customers = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_customers WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $needs = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_needs WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $appointments_total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_appointments WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $appointments_done = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_appointments WHERE created_by = %d AND status = 'completed' AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $deposits = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_deposits WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $transactions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}bds_transactions WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $transaction_value = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(value),0) FROM {$p}bds_transactions WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        $commission = (float) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(commission),0) FROM {$p}bds_transactions WHERE created_by = %d AND created_at BETWEEN %s AND %s",
            $user_id, $df, $dt
        ));

        // Monthly trend (last 6 months)
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $ts = strtotime("-$i months", mktime(0, 0, 0, $month, 1, $year));
            $m_from = date('Y-m-01 00:00:00', $ts);
            $m_to   = date('Y-m-t 23:59:59', $ts);

            $trend[] = [
                'month'        => date('m/Y', $ts),
                'customers'    => (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$p}bds_customers WHERE created_by = %d AND created_at BETWEEN %s AND %s", $user_id, $m_from, $m_to)),
                'transactions' => (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$p}bds_transactions WHERE created_by = %d AND created_at BETWEEN %s AND %s", $user_id, $m_from, $m_to)),
                'value'        => (float) $wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(value),0) FROM {$p}bds_transactions WHERE created_by = %d AND created_at BETWEEN %s AND %s", $user_id, $m_from, $m_to)),
            ];
        }

        return [
            'user_id'            => $user_id,
            'period'             => $period,
            'date_from'          => $date_from,
            'date_to'            => $date_to,
            'properties'         => $properties,
            'customers'          => $customers,
            'needs'              => $needs,
            'appointments_total' => $appointments_total,
            'appointments_done'  => $appointments_done,
            'deposits'           => $deposits,
            'transactions'       => $transactions,
            'transaction_value'  => $transaction_value,
            'commission'         => $commission,
            'trend'              => $trend,
        ];
    }

    private function get_date_range(string $period, int $year, int $month): array {
        switch ($period) {
            case 'week':
                $from = date('Y-m-d 00:00:00', strtotime('monday this week'));
                $to   = date('Y-m-d 23:59:59', strtotime('sunday this week'));
                break;
            case 'year':
                $from = "{$year}-01-01 00:00:00";
                $to   = "{$year}-12-31 23:59:59";
                break;
            case 'quarter':
                $q     = ceil($month / 3);
                $q_from = ($q - 1) * 3 + 1;
                $q_to   = $q * 3;
                $from  = sprintf('%d-%02d-01 00:00:00', $year, $q_from);
                $to    = date('Y-m-t 23:59:59', mktime(0, 0, 0, $q_to, 1, $year));
                break;
            default: // month
                $from = sprintf('%d-%02d-01 00:00:00', $year, $month);
                $to   = date('Y-m-t 23:59:59', mktime(0, 0, 0, $month, 1, $year));
        }
        return [$from, $to];
    }
}
