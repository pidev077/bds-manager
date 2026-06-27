<?php
defined('ABSPATH') || exit;

class BDS_Database {

    public static function create_tables() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // Properties (Nhà bán)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_properties (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            code VARCHAR(50) DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            project_name VARCHAR(255) DEFAULT NULL,
            block VARCHAR(50) DEFAULT NULL,
            floor VARCHAR(20) DEFAULT NULL,
            unit_number VARCHAR(50) DEFAULT NULL,
            area_gross DECIMAL(10,2) DEFAULT NULL,
            area_net DECIMAL(10,2) DEFAULT NULL,
            bedrooms TINYINT UNSIGNED DEFAULT 0,
            bathrooms TINYINT UNSIGNED DEFAULT 0,
            direction VARCHAR(50) DEFAULT NULL,
            balcony_direction VARCHAR(50) DEFAULT NULL,
            view_type VARCHAR(50) DEFAULT NULL,
            price DECIMAL(20,2) DEFAULT NULL,
            price_per_sqm DECIMAL(15,2) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'available',
            property_type VARCHAR(50) DEFAULT NULL,
            fund_type VARCHAR(20) DEFAULT 'F0',
            component VARCHAR(50) DEFAULT NULL,
            standard VARCHAR(100) DEFAULT NULL,
            description TEXT DEFAULT NULL,
            images LONGTEXT DEFAULT NULL,
            metadata LONGTEXT DEFAULT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            updated_by BIGINT UNSIGNED DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY code (code),
            KEY idx_status (status),
            KEY idx_project (project_name(100)),
            KEY idx_created_by (created_by),
            KEY idx_view_type (view_type)
        ) $charset;");

        // Customers (Khách hàng - private per employee)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_customers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(20) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            source_detail VARCHAR(255) DEFAULT NULL,
            source_overview VARCHAR(255) DEFAULT NULL,
            source_url VARCHAR(500) DEFAULT NULL,
            vinclub_rank VARCHAR(50) DEFAULT NULL,
            connection_status VARCHAR(50) DEFAULT 'not_connected',
            verification_status VARCHAR(50) DEFAULT NULL,
            cdp_segment VARCHAR(255) DEFAULT NULL,
            classification VARCHAR(100) DEFAULT NULL,
            auto_classification VARCHAR(100) DEFAULT NULL,
            consent_status TINYINT DEFAULT 0,
            referrer_id BIGINT UNSIGNED DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            metadata LONGTEXT DEFAULT NULL,
            assigned_to BIGINT UNSIGNED NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            updated_by BIGINT UNSIGNED DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_assigned_to (assigned_to),
            KEY idx_created_by (created_by),
            KEY idx_phone (phone)
        ) $charset;");

        // Needs (Nhu cầu mua)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_needs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            code VARCHAR(50) DEFAULT NULL,
            title VARCHAR(255) DEFAULT NULL,
            customer_id BIGINT UNSIGNED NOT NULL,
            type VARCHAR(20) DEFAULT 'buy',
            tier VARCHAR(20) DEFAULT 'primary',
            project_preference VARCHAR(255) DEFAULT NULL,
            budget_min DECIMAL(20,2) DEFAULT NULL,
            budget_max DECIMAL(20,2) DEFAULT NULL,
            bedrooms VARCHAR(50) DEFAULT NULL,
            area_min DECIMAL(10,2) DEFAULT NULL,
            area_max DECIMAL(10,2) DEFAULT NULL,
            activity_status VARCHAR(50) DEFAULT 'active',
            buy_status VARCHAR(50) DEFAULT NULL,
            processing_status VARCHAR(50) DEFAULT NULL,
            classification VARCHAR(100) DEFAULT NULL,
            label_tag VARCHAR(100) DEFAULT NULL,
            need_type VARCHAR(100) DEFAULT NULL,
            finance_type VARCHAR(100) DEFAULT NULL,
            score TINYINT UNSIGNED DEFAULT 0,
            assigned_to BIGINT UNSIGNED NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_customer_id (customer_id),
            KEY idx_assigned_to (assigned_to),
            KEY idx_type_tier (type, tier)
        ) $charset;");

        // Appointments (Lịch hẹn)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_appointments (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            type VARCHAR(50) DEFAULT 'consultation',
            customer_id BIGINT UNSIGNED NOT NULL,
            need_id BIGINT UNSIGNED DEFAULT NULL,
            property_id BIGINT UNSIGNED DEFAULT NULL,
            assigned_to BIGINT UNSIGNED NOT NULL,
            handler BIGINT UNSIGNED DEFAULT NULL,
            location VARCHAR(255) DEFAULT NULL,
            appointment_date DATETIME DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            status_updated_at DATETIME DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_assigned_to (assigned_to),
            KEY idx_customer_id (customer_id),
            KEY idx_date (appointment_date),
            KEY idx_status (status)
        ) $charset;");

        // Deposits (Cọc thiện chí)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_deposits (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) DEFAULT NULL,
            customer_id BIGINT UNSIGNED NOT NULL,
            property_id BIGINT UNSIGNED DEFAULT NULL,
            campaign VARCHAR(255) DEFAULT NULL,
            project VARCHAR(255) DEFAULT NULL,
            zone VARCHAR(255) DEFAULT NULL,
            activity_status VARCHAR(50) DEFAULT 'active',
            booking_status VARCHAR(50) DEFAULT NULL,
            booking_count TINYINT DEFAULT 0,
            total_amount DECIMAL(20,2) DEFAULT 0,
            property_type VARCHAR(100) DEFAULT NULL,
            specific_request TEXT DEFAULT NULL,
            assigned_to BIGINT UNSIGNED NOT NULL,
            support_person BIGINT UNSIGNED DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            metadata LONGTEXT DEFAULT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_customer_id (customer_id),
            KEY idx_assigned_to (assigned_to)
        ) $charset;");

        // Transactions (Giao dịch)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_transactions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) DEFAULT NULL,
            customer_id BIGINT UNSIGNED NOT NULL,
            property_id BIGINT UNSIGNED DEFAULT NULL,
            value DECIMAL(20,2) DEFAULT 0,
            source_customer VARCHAR(100) DEFAULT NULL,
            source_transaction VARCHAR(100) DEFAULT NULL,
            stage VARCHAR(100) DEFAULT NULL,
            status VARCHAR(100) DEFAULT NULL,
            project VARCHAR(255) DEFAULT NULL,
            tier VARCHAR(20) DEFAULT 'primary',
            commission DECIMAL(20,2) DEFAULT 0,
            assigned_to BIGINT UNSIGNED NOT NULL,
            inspector BIGINT UNSIGNED DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            metadata LONGTEXT DEFAULT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_customer_id (customer_id),
            KEY idx_assigned_to (assigned_to),
            KEY idx_tier (tier),
            KEY idx_stage (stage(50))
        ) $charset;");

        // Sale Requests (Quản lý yêu cầu tạo mới Sale)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_sale_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            code VARCHAR(50) DEFAULT NULL,
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(20) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            business_region VARCHAR(255) DEFAULT NULL,
            team VARCHAR(255) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            handler BIGINT UNSIGNED DEFAULT NULL,
            documents LONGTEXT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_status (status),
            KEY idx_created_by (created_by)
        ) $charset;");

        // Property Owners (Chủ nhà / hàng chuyển nhượng)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_property_owners (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            property_id BIGINT UNSIGNED NOT NULL,
            owner_name VARCHAR(255) NOT NULL,
            owner_phone VARCHAR(20) DEFAULT NULL,
            selling_price DECIMAL(20,2) DEFAULT NULL,
            commission_rate DECIMAL(5,2) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            assigned_to BIGINT UNSIGNED NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_property_id (property_id),
            KEY idx_assigned_to (assigned_to)
        ) $charset;");

        // Cart Items (Giỏ hàng theo khách)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_cart_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            customer_id BIGINT UNSIGNED NOT NULL,
            property_id BIGINT UNSIGNED NOT NULL,
            added_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_customer_property (customer_id, property_id),
            KEY idx_customer_id (customer_id)
        ) $charset;");

        // Documents (Kho tài liệu theo dự án)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_documents (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            project_name VARCHAR(255) DEFAULT NULL,
            category VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            file_url VARCHAR(500) NOT NULL,
            file_name VARCHAR(255) DEFAULT NULL,
            file_size BIGINT UNSIGNED DEFAULT 0,
            uploaded_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_project (project_name(100)),
            KEY idx_category (category)
        ) $charset;");

        // Care Logs (Nhật ký chăm sóc khách hàng)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_care_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            customer_id BIGINT UNSIGNED NOT NULL,
            log_type VARCHAR(50) DEFAULT 'note',
            content TEXT DEFAULT NULL,
            log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by BIGINT UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_customer_id (customer_id),
            KEY idx_log_date (log_date)
        ) $charset;");

        // Projects (Danh sách dự án)
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_projects (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_name (name)
        ) $charset;");

        // Activity Logs
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_activity_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            action VARCHAR(100) NOT NULL,
            object_type VARCHAR(50) DEFAULT NULL,
            object_id BIGINT UNSIGNED DEFAULT NULL,
            description TEXT DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            metadata LONGTEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_action (action),
            KEY idx_object (object_type, object_id),
            KEY idx_created_at (created_at)
        ) $charset;");

        // Notifications
        dbDelta("CREATE TABLE {$wpdb->prefix}bds_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) DEFAULT NULL,
            message TEXT DEFAULT NULL,
            object_type VARCHAR(50) DEFAULT NULL,
            object_id BIGINT UNSIGNED DEFAULT NULL,
            is_read TINYINT DEFAULT 0,
            read_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_user_id (user_id),
            KEY idx_is_read (is_read),
            KEY idx_created_at (created_at)
        ) $charset;");
    }

    public static function drop_tables() {
        global $wpdb;
        $tables = [
            'bds_properties', 'bds_customers', 'bds_needs',
            'bds_appointments', 'bds_deposits', 'bds_transactions',
            'bds_sale_requests', 'bds_activity_logs', 'bds_notifications',
            'bds_property_owners', 'bds_cart_items', 'bds_documents', 'bds_care_logs', 'bds_projects',
        ];
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
        }
    }
}
