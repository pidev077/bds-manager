import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Trash2, History } from 'lucide-react'
import { customersApi, careLogsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { Customer } from '@/types'
import { CARE_LOG_TYPE_LABELS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import toast from 'react-hot-toast'

export default function CareLogTimeline() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [newLogType, setNewLogType] = useState('call')
  const [newLogContent, setNewLogContent] = useState('')
  const qc = useQueryClient()

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-select-carelog', search],
    queryFn: () => customersApi.list({ per_page: 50, search: search || undefined }),
  })
  const customers: Customer[] = customersData?.data ?? []

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['care-logs', selected?.id],
    queryFn: () => careLogsApi.list(selected!.id),
    enabled: !!selected,
  })
  const careLogs = logsData?.data ?? []

  const addLogMutation = useMutation({
    mutationFn: () => careLogsApi.create({ customer_id: selected!.id, log_type: newLogType, content: newLogContent }),
    onSuccess: () => {
      toast.success('Đã thêm nhật ký!')
      qc.invalidateQueries({ queryKey: ['care-logs', selected?.id] })
      setNewLogContent('')
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteLogMutation = useMutation({
    mutationFn: (id: number) => careLogsApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa!')
      qc.invalidateQueries({ queryKey: ['care-logs', selected?.id] })
    },
    onError: () => toast.error('Không thể xóa!'),
  })

  return (
    <div className="flex gap-4">
      {/* Customer picker */}
      <div className="w-72 shrink-0">
        <div className="bds-card">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chọn khách hàng</p>
          </div>
          <div className="p-2">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Tìm theo tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {customersLoading ? (
                <LoadingState rows={4} />
              ) : customers.length === 0 ? (
                <EmptyState message="Không tìm thấy khách hàng" />
              ) : customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`flex flex-col items-start w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selected?.id === c.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="font-medium">{c.full_name}</span>
                  <span className="text-xs text-gray-400">{c.phone || '--'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 min-w-0">
        <div className="page-header">
          <h1 className="page-title">Nhật ký chăm sóc khách hàng</h1>
        </div>

        {!selected ? (
          <div className="bds-card p-10 text-center text-gray-400">
            <History size={32} className="mx-auto mb-2 text-gray-300" />
            Chọn một khách hàng ở bên trái để xem nhật ký chăm sóc
          </div>
        ) : (
          <div className="bds-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-800">{selected.full_name}</p>
                <p className="text-xs text-gray-400">{selected.phone || '--'} {selected.email ? `· ${selected.email}` : ''}</p>
              </div>
              <span className="text-xs text-gray-400">{selected.assigned_to_name ? `Sale: ${selected.assigned_to_name}` : ''}</span>
            </div>

            <div className="flex gap-2 mb-5">
              <select className="input w-44" value={newLogType} onChange={e => setNewLogType(e.target.value)}>
                {Object.entries(CARE_LOG_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input className="input flex-1" placeholder="Nội dung chăm sóc..." value={newLogContent} onChange={e => setNewLogContent(e.target.value)} />
              <button className="btn-primary" disabled={!newLogContent.trim() || addLogMutation.isPending} onClick={() => addLogMutation.mutate()}>
                <Plus size={16} /> Thêm
              </button>
            </div>

            {logsLoading ? (
              <LoadingState rows={4} />
            ) : careLogs.length === 0 ? (
              <EmptyState message="Chưa có nhật ký chăm sóc nào" />
            ) : (
              <div className="relative pl-5 border-l-2 border-gray-100 space-y-4">
                {careLogs.map((log: { id: number; log_date: string; log_type: string; content: string; created_by_name?: string }) => (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[26px] top-0.5 w-3 h-3 rounded-full bg-brand border-2 border-white" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">{formatDateTime(log.log_date)}</p>
                      <button className="text-gray-300 hover:text-red-500" onClick={() => deleteLogMutation.mutate(log.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{CARE_LOG_TYPE_LABELS[log.log_type] || log.log_type}</p>
                    <p className="text-sm text-gray-600">{log.content}</p>
                    {log.created_by_name && <p className="text-xs text-gray-400 mt-0.5">— {log.created_by_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
