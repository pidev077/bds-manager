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
  view_type: string
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

export interface Project {
  id: number
  name: string
  created_at: string
  property_count: number
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
  site_visit_done: number
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

// ─── Property Owner ───────────────────────────────────────────────────────────
export interface PropertyOwner {
  id: number
  property_id: number
  property_code?: string
  property_title?: string
  owner_name: string
  owner_phone: string
  selling_price: number
  commission_rate: number
  notes: string
  assigned_to: number
  assigned_to_name?: string
  created_by: number
  created_at: string
  updated_at: string
}

// ─── Cart Item ────────────────────────────────────────────────────────────────
export interface CartItem {
  id: number
  customer_id: number
  property_id: number
  property_code?: string
  property_title?: string
  property_price?: number
  property_project?: string
  property_status?: string
  property_area_gross?: number
  property_bedrooms?: number
  property_type?: string
  added_by: number
  created_at: string
}

// ─── Document ─────────────────────────────────────────────────────────────────
export interface BdsDocument {
  id: number
  project_name: string
  category: string
  title: string
  file_url: string
  file_name: string
  file_size: number
  uploaded_by: number
  uploaded_by_name?: string
  created_at: string
}

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  price_list: 'Bảng giá',
  policy: 'Chính sách bán hàng',
  pdf: 'File PDF',
  floor_plan: 'Mặt bằng',
  legal: 'Pháp lý',
  video: 'Video dự án',
}

// ─── Care Log ─────────────────────────────────────────────────────────────────
export interface CareLog {
  id: number
  customer_id: number
  log_type: string
  content: string
  log_date: string
  created_by: number
  created_by_name?: string
  created_at: string
}

export const CARE_LOG_TYPE_LABELS: Record<string, string> = {
  call: 'Gọi điện',
  send_price: 'Gửi bảng giá',
  appointment: 'Hẹn xem nhà',
  visit: 'Đã xem nhà',
  consideration: 'Đang cân nhắc',
  note: 'Ghi chú khác',
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardNewPropertyItem {
  id: number
  code: string
  unit_number: string
  title: string
  project_name: string
  status: string
  price: number
  updated_at: string
}

export interface DashboardNeedItem {
  id: number
  title: string
  processing_status: string
  activity_status: string
  customer_id: number
  customer_name: string
}

export interface DashboardAppointmentItem {
  id: number
  type: string
  status: string
  appointment_date: string
  customer_id: number
  customer_name: string
}

export interface DashboardStats {
  primary_count: number
  secondary_count: number
  total_properties: number
  available_count: number
  cancelled_count: number
  sold_count: number
  new_today_count: number
  new_today_items: DashboardNewPropertyItem[]
  needs_pending_count: number
  needs_pending_items: DashboardNeedItem[]
  appointments_today_count: number
  appointments_today_items: DashboardAppointmentItem[]
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
