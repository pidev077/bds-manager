import axios, { AxiosError } from 'axios'
import type { BdsConfig } from '@/types'

declare global {
  interface Window {
    bdsConfig: BdsConfig
  }
}

const getConfig = (): BdsConfig => {
  if (typeof window !== 'undefined' && window.bdsConfig) return window.bdsConfig
  // Dev fallback
  return {
    apiUrl: 'http://bds.local/wp-json/bds/v1',
    nonce: '',
    siteUrl: 'http://bds.local',
    adminUrl: 'http://bds.local/wp-admin/',
    pluginUrl: '/',
    user: { id: 1, name: 'Admin', email: 'admin@bds.local', roles: ['administrator'], avatar: '', is_admin: true, is_manager: true },
  }
}

const api = axios.create({
  baseURL: getConfig().apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': getConfig().nonce,
  },
})

// Refresh nonce on 403 and retry once
api.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      window.location.href = getConfig().siteUrl + '/wp-login.php?redirect_to=' + encodeURIComponent(window.location.href)
    }
    return Promise.reject(err)
  }
)

export type ApiError = { message: string; code?: string }

function parseError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined
    return { message: (data?.message as string) || err.message, code: data?.code as string }
  }
  return { message: 'Có lỗi xảy ra' }
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
export const extractPagination = (headers: Record<string, string>) => ({
  total: parseInt(headers['x-wp-total'] ?? '0'),
  totalPages: parseInt(headers['x-wp-totalpages'] ?? '1'),
})

// ─── Properties ───────────────────────────────────────────────────────────────
export const propertiesApi = {
  list: (params?: Record<string, unknown>) => api.get('/properties', { params }),
  get:  (id: number) => api.get(`/properties/${id}`),
  create: (data: unknown) => api.post('/properties', data),
  update: (id: number, data: unknown) => api.put(`/properties/${id}`, data),
  delete: (id: number) => api.delete(`/properties/${id}`),
}

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: Record<string, unknown>) => api.get('/customers', { params }),
  get:  (id: number) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post('/customers', data),
  update: (id: number, data: unknown) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
}

// ─── Needs ────────────────────────────────────────────────────────────────────
export const needsApi = {
  list: (params?: Record<string, unknown>) => api.get('/needs', { params }),
  get:  (id: number) => api.get(`/needs/${id}`),
  create: (data: unknown) => api.post('/needs', data),
  update: (id: number, data: unknown) => api.put(`/needs/${id}`, data),
  delete: (id: number) => api.delete(`/needs/${id}`),
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: (params?: Record<string, unknown>) => api.get('/appointments', { params }),
  get:  (id: number) => api.get(`/appointments/${id}`),
  create: (data: unknown) => api.post('/appointments', data),
  update: (id: number, data: unknown) => api.put(`/appointments/${id}`, data),
  delete: (id: number) => api.delete(`/appointments/${id}`),
}

// ─── Deposits ─────────────────────────────────────────────────────────────────
export const depositsApi = {
  list: (params?: Record<string, unknown>) => api.get('/deposits', { params }),
  get:  (id: number) => api.get(`/deposits/${id}`),
  create: (data: unknown) => api.post('/deposits', data),
  update: (id: number, data: unknown) => api.put(`/deposits/${id}`, data),
  delete: (id: number) => api.delete(`/deposits/${id}`),
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionsApi = {
  list: (params?: Record<string, unknown>) => api.get('/transactions', { params }),
  get:  (id: number) => api.get(`/transactions/${id}`),
  create: (data: unknown) => api.post('/transactions', data),
  update: (id: number, data: unknown) => api.put(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
export const kpiApi = {
  me:      (params?: Record<string, unknown>) => api.get('/kpi/me', { params }),
  summary: (params?: Record<string, unknown>) => api.get('/kpi/summary', { params }),
  user:    (userId: number, params?: Record<string, unknown>) => api.get(`/kpi/users/${userId}`, { params }),
}

// ─── Activity ─────────────────────────────────────────────────────────────────
export const activityApi = {
  list:   (params?: Record<string, unknown>) => api.get('/activity', { params }),
  me:     (params?: Record<string, unknown>) => api.get('/activity/me', { params }),
  track:  (action: string, objectType = '', objectId = 0, description = '') =>
    api.post('/activity/track', { action, object_type: objectType, object_id: objectId, description }),
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:       (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead:   (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   (params?: Record<string, unknown>) => api.get('/users', { params }),
  me:     () => api.get('/users/me'),
  get:    (id: number) => api.get(`/users/${id}`),
  create: (data: unknown) => api.post('/users', data),
  update: (id: number, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}

export { parseError }
export default api
