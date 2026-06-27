<?php
defined('ABSPATH') || exit;

/**
 * Matching engine: nhu cầu khách hàng (bds_needs) <-> căn bất động sản (bds_properties).
 * Lưu ý: budget_min/budget_max ở bds_needs được nhập theo đơn vị "tỷ" (xem form Needs),
 * còn price ở bds_properties lưu nguyên VNĐ, nên cần nhân 1 tỷ khi so sánh.
 */
class BDS_Need_Matcher {

    const BILLION = 1000000000;

    private static function bedroom_list(string $raw): array {
        $nums = preg_replace('/[^0-9,]/', '', $raw);
        return array_values(array_filter(array_map('trim', explode(',', $nums)), fn($v) => $v !== ''));
    }

    public static function find_matching_properties(object $need, int $limit = 10): array {
        global $wpdb;

        $where = ["status = 'available'"];
        $vals = [];

        if (!empty($need->project_preference)) {
            $where[] = 'project_name = %s';
            $vals[] = $need->project_preference;
        }
        if (!empty($need->budget_min)) {
            $where[] = 'price >= %f';
            $vals[] = (float) $need->budget_min * self::BILLION;
        }
        if (!empty($need->budget_max)) {
            $where[] = 'price <= %f';
            $vals[] = (float) $need->budget_max * self::BILLION;
        }
        if (!empty($need->area_min)) {
            $where[] = 'area_gross >= %f';
            $vals[] = (float) $need->area_min;
        }
        if (!empty($need->area_max)) {
            $where[] = 'area_gross <= %f';
            $vals[] = (float) $need->area_max;
        }

        $bedrooms = self::bedroom_list((string) ($need->bedrooms ?? ''));
        if (!empty($bedrooms)) {
            $placeholders = implode(',', array_fill(0, count($bedrooms), '%d'));
            $where[] = "bedrooms IN ($placeholders)";
            foreach ($bedrooms as $b) $vals[] = (int) $b;
        }

        $sql = "SELECT * FROM {$wpdb->prefix}bds_properties WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT %d";
        $vals[] = $limit;

        return $wpdb->get_results($wpdb->prepare($sql, ...$vals));
    }

    public static function find_matching_needs(object $property, int $limit = 100): array {
        global $wpdb;

        $where = ["activity_status = 'active'"];
        $vals = [];

        $where[] = "(project_preference = '' OR project_preference IS NULL OR project_preference = %s)";
        $vals[] = (string) $property->project_name;

        $where[] = '(budget_min = 0 OR budget_min IS NULL OR (budget_min * 1000000000) <= %f)';
        $vals[] = (float) $property->price;

        $where[] = '(budget_max = 0 OR budget_max IS NULL OR (budget_max * 1000000000) >= %f)';
        $vals[] = (float) $property->price;

        $where[] = '(area_min = 0 OR area_min IS NULL OR area_min <= %f)';
        $vals[] = (float) $property->area_gross;

        $where[] = '(area_max = 0 OR area_max IS NULL OR area_max >= %f)';
        $vals[] = (float) $property->area_gross;

        $sql = "SELECT * FROM {$wpdb->prefix}bds_needs WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT %d";
        $vals[] = $limit;

        $needs = $wpdb->get_results($wpdb->prepare($sql, ...$vals));

        if (!empty($property->bedrooms)) {
            $needs = array_values(array_filter($needs, function ($n) use ($property) {
                $list = self::bedroom_list((string) ($n->bedrooms ?? ''));
                return empty($list) || in_array((string) (int) $property->bedrooms, $list, true);
            }));
        }

        return $needs;
    }
}
