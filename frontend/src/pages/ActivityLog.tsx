import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { activityApi, usersApi } from '@/lib/api'
import { formatDateTime, getAvatarColor, getInitials } from '@/lib/utils'
import type { ActivityLog as ActivityLogType } from '@/types'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'

const OBJECT_TYPES = ['', 'property', 'customer', 'need', 'appointment', 'deposit', 'transaction', 'user']
const OBJECT_LABELS: Record<string, string> = {
  '': 'Tất cả', property: 'Nhà bán', customer: 'Khách hàng', need: 'Nhu cầu',
  appointment: 'Lịch hẹn', deposit: 'Cọc thiện chí', transaction: 'Giao dịch', user: 'Người dùng',
}

export default function ActivityLog() {
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [objectType, setObjectType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params: Record<string, unknown> = {
    page, per_page: 20,
    user_id: userId || undefined,
    object_type: objectType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['activity', params],
    queryFn: () => activityApi.list(params),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => usersApi.list(),
  })

  const logs: ActivityLogType[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const users = usersData?.data ?? []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký hoạt động</h1>
          <p className="text-xs text-gray-400 mt-1">Theo dõi tất cả thao tác của nhân viên trên hệ thống</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input w-44" value={userId} onChange={e => { setUserId(e.target.value); setPage(1) }}>
          <option value="">-- Tất cả nhân viên --</option>
          {users.map((u: { id: number; display_name: string }) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <select className="input w-40" value={objectType} onChange={e => { setObjectType(e.target.value); setPage(1) }}>
          {OBJECT_TYPES.map(t => <option key={t} value={t}>{OBJECT_LABELS[t]}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input className="input w-36" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} placeholder="Từ ngày" />
          <span className="text-gray-400">→</span>
          <input className="input w-36" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        {(userId || objectType || dateFrom || dateTo) && (
          <button className="btn-ghost text-xs" onClick={() => { setUserId(''); setObjectType(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
            Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">Tổng: <strong>{total}</strong> bản ghi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Nhân viên', 'Hành động', 'Đối tượng', 'Mô tả', 'Địa chỉ IP', 'Thời gian'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6}><LoadingState /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6}><EmptyState message="Không có nhật ký" /></td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(log.user_name ?? '')}`}>
                        {getInitials(log.user_name ?? '?')}
                      </div>
                      <span className="font-medium text-gray-700">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${
                      log.action.startsWith('create') ? 'badge-green' :
                      log.action.startsWith('update') ? 'badge-blue' :
                      log.action.startsWith('delete') ? 'badge-red' :
                      log.action.startsWith('view') ? 'badge-gray' : 'badge-purple'
                    }`}>
                      {log.action_label || log.action}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500">
                    {log.object_type ? (
                      <span>{OBJECT_LABELS[log.object_type] || log.object_type} {log.object_id ? `#${log.object_id}` : ''}</span>
                    ) : '--'}
                  </td>
                  <td className="table-cell text-gray-600 max-w-xs truncate" title={log.description}>
                    {log.description || '--'}
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-400">{log.ip_address}</td>
                  <td className="table-cell text-gray-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} perPage={20} onChange={setPage} />
      </div>
    </div>
  )
}
