export interface BdsConfig {
  apiUrl: string
  nonce: string
  siteUrl: string
  adminUrl: string
  pluginUrl: string
  user: CurrentUser
}

export interface CurrentUser {
  id: number
  name: string
  email: string
  roles: string[]
  avatar: string
  is_admin: boolean
  is_manager: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  totalPages: number
  page: number
  perPage: number
}

// ─── Property ────────────────────────────────────────────────────────────────
export interface Property {
  id: number
  code: string
  title: string
  project_name: string
  block: string
  floor: string
  unit_number: string
  area_gross: number
  area_net: number
  bedrooms: number
  bathrooms: number
  direction: string
  balcony_direction: string
  price: number
  price_per_sqm: number
  status: 'available' | 'reserved' | 'sold' | 'cancelled'
  property_type: string
  fund_type: string
  component: string
  standard: string
  description: string
  images: string[] | null
  created_by: number
  updated_by: number
  created_at: string
  updated_at: string
}

export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  available: 'Còn hàng',
  reserved: 'Đã đặt cọc',
  sold: 'Đã bán với VHM Market',
  cancelled: 'Đã huỷ',
}

export const PROPERTY_STATUS_COLORS: Record<string, string> = {
  available: 'green',
  reserved: 'yellow',
  sold: 'red',
  cancelled: 'gray',
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: number
  full_name: string
  phone: string
  email: string
  source_detail: string
  source_overview: string
  source_url: string
  vinclub_rank: string
  connection_status: string
  verification_status: string
  cdp_segment: string
  classification: string
  auto_classification: string
  consent_status: number
  referrer_id: number | null
  referrer_name?: string
  notes: string
  assigned_to: number
  assigned_to_name?: string
  created_by: number
  created_at: string
  updated_at: string
}

// ─── Need ─────────────────────────────────────────────────────────────────────
export interface Need {
  id: number
  code: string
  title: string
  customer_id: number
  customer_name?: string
  customer_phone?: string
  type: string
  tier: 'primary' | 'secondary'
  project_preference: string
  budget_min: number
  budget_max: number
  bedrooms: string
  area_min: number
  area_max: number
  activity_status: 'active' | 'inactive'
  buy_status: string
  processing_status: string
  classification: string
  label_tag: string
  need_type: string
  finance_type: string
  score: number
  assigned_to: number
  assigned_to_name?: string
  created_by: number
  created_at: string
  updated_at: string
}

// ─── Appointment ──────────────────────────────────────────────────────────────
export interface Appointment {
  id: number
  type: string
  customer_id: number
  customer_name?: string
  customer_phone?: string
  need_id: number | null
  property_id: number | null
  assigned_to: number
  assigned_to_name?: string
  handler: number | null
  handler_name?: string
  location: string
  appointment_date: string | null
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  status_updated_at: string | null
  notes: string
  created_by: number
  created_by_name?: string
  created_at: string
  updated_at: string
}

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consultation: 'Hẹn tư vấn',
  showroom: 'Hẹn thăm nhà mẫu',
  site_visit: 'Hẹn xem nhà',
  other: 'Khác',
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Chưa xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
}

// ─── Deposit ──────────────────────────────────────────────────────────────────
export interface Deposit {
  id: number
  name: string
  customer_id: number
  customer_name?: string
  property_id: number | null
  campaign: string
  project: string
  zone: string
  activity_status: string
  booking_status: string
  booking_count: number
  total_amount: number
  property_type: string
  specific_request: string
  assigned_to: number
  assigned_to_name?: string
  support_person: number | null
  support_person_name?: string
  notes: string
  created_by: number
  created_at: string
  updated_at: string
}

// ─── Transaction ──────────────────────────────────────────────────────────────
export interface Transaction {
  id: number
  name: string
  customer_id: number
  customer_name?: string
  property_id: number | null
  property_title?: string
  property_code?: string
  value: number
  source_customer: string
  source_transaction: string
  stage: string
  status: string
  project: string
  tier: 'primary' | 'secondary'
  commission: number
  assigned_to: number
  assigned_to_name?: string
  inspector: number | null
  inspector_name?: string
  notes: string
  created_by: number
  created_by_name?: string
  created_at: string
  updated_at: string
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
export interface KPI {
  user_id: number
  user_name?: string
  user_email?: string
  role?: string
  period: string
  date_from: string
  date_to: string
  properties: number
  customers: number
  needs: number
  appointments_total: number
  appointments_done: number
  deposits: number
  transactions: number
  transaction_value: number
  commission: number
  trend: TrendItem[]
}

export interface TrendItem {
  month: string
  customers: number
  transactions: number
  value: number
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: number
  user_id: number
  user_name?: string
  action: string
  action_label?: string
  object_type: string
  object_id: number
  description: string
  ip_address: string
  created_at: string
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  object_type: string
  object_id: number
  is_read: number
  read_at: string | null
  created_at: string
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  username: string
  display_name: string
  email: string
  roles: string[]
  role_label: string
  avatar: string
  registered: string
  is_admin: boolean
  is_manager: boolean
}

// ─── Sale Request ──────────────────────────────────────────────────────────────
export interface SaleRequest {
  id: number
  code: string
  full_name: string
  phone: string
  email: string
  business_region: string
  team: string
  status: 'pending' | 'supplement' | 'rejected' | 'approved'
  handler: number | null
  created_by: number
  created_at: string
}
