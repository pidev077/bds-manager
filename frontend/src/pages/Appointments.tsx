import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { appointmentsApi, customersApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { Appointment } from '@/types'
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { label: 'Tất cả', value: '' },
  { label: 'Chưa xác nhận', value: 'pending' },
  { label: 'Đã xác nhận', value: 'confirmed' },
  { label: 'Đã hoàn thành', value: 'completed' },
  { label: 'Đã hủy', value: 'cancelled' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', confirmed: 'blue', completed: 'green', cancelled: 'red',
}

const SIDEBAR_TYPES = [
  { label: 'Tất cả', value: '' },
  { label: 'Hẹn tư vấn', value: 'consultation' },
  { label: 'Hẹn thăm nhà mẫu', value: 'showroom' },
  { label: 'Hẹn xem nhà', value: 'site_visit' },
  { label: 'Khác', value: 'other' },
]

type FormData = {
  type: string; customer_id: number; appointment_date: string
  location: string; status: string; notes: string
}

export default function Appointments() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const params: Record<string, unknown> = { page, per_page: 20, status: statusTab || undefined, type: typeFilter || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => appointmentsApi.list(params),
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
  })

  const appointments: Appointment[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const customers = customersData?.data ?? []

  const { register, handleSubmit, reset } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? appointmentsApi.update(editing.id, d) : appointmentsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Tạo lịch hẹn thành công!')
      qc.invalidateQueries({ queryKey: ['appointments'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['appointments'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (a: Appointment) => {
    setEditing(a)
    reset({ type: a.type, customer_id: a.customer_id, appointment_date: a.appointment_date?.slice(0, 16) ?? '', location: a.location, status: a.status, notes: a.notes })
    setOpenForm(true)
  }

  return (
    <div className="flex gap-4">
      {/* Sidebar */}
      <div className="w-52 shrink-0">
        <div className="card">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="font-semibold text-sm text-gray-700">Quản lý lịch hẹn</p>
            <p className="text-xs text-gray-400 mt-0.5">Lịch hẹn với khách hàng</p>
          </div>
          <div className="px-2 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 py-1">DANH MỤC</p>
            {SIDEBAR_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${typeFilter === t.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="page-header">
          <h1 className="page-title">Lịch hẹn</h1>
          <button className="btn-primary" onClick={() => { setEditing(null); reset({ type: 'consultation', status: 'pending' }); setOpenForm(true) }}>
            <Plus size={16} /> Thêm mới
          </button>
        </div>

        {/* Status tabs */}
        <div className="tab-nav">
          {STATUS_TABS.map(t => (
            <button key={t.value} className={`tab-item ${statusTab === t.value ? 'active' : ''}`} onClick={() => { setStatusTab(t.value); setPage(1) }}>
              {t.label} {t.value === '' && <span className="ml-1 text-gray-400">{total}</span>}
            </button>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-52" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <button className="btn-secondary gap-2"><SlidersHorizontal size={14} /> Bộ lọc</button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['ID', 'Lịch hẹn', 'Người phụ trách', 'Nhân viên kinh doanh', 'Khách hàng', 'Yêu cầu ID', 'Trạng thái', 'Ngày cập nhật TT', 'Địa điểm hẹn', 'Ngày hẹn', 'Ngày tạo', 'Người tạo', 'Thao tác'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={13}><LoadingState /></td></tr>
                ) : appointments.length === 0 ? (
                  <tr><td colSpan={13}><EmptyState message="Không có dữ liệu" /></td></tr>
                ) : appointments.map(a => (
                  <tr key={a.id} className="table-row">
                    <td className="table-cell font-medium text-gray-500">{a.id}</td>
                    <td className="table-cell font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(a)}>
                      {APPOINTMENT_TYPE_LABELS[a.type] || a.type}
                    </td>
                    <td className="table-cell text-gray-500">{a.handler_name || '--'}</td>
                    <td className="table-cell text-gray-500">{a.assigned_to_name || '--'}</td>
                    <td className="table-cell">{a.customer_name || '--'}</td>
                    <td className="table-cell text-gray-400">{a.need_id || '--'}</td>
                    <td className="table-cell">
                      <Badge
                        label={APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}
                        color={(STATUS_COLORS[a.status] ?? 'gray') as never}
                        dot
                      />
                    </td>
                    <td className="table-cell text-gray-400">{formatDateTime(a.status_updated_at)}</td>
                    <td className="table-cell text-gray-500">{a.location || '--'}</td>
                    <td className="table-cell text-gray-600">{formatDateTime(a.appointment_date)}</td>
                    <td className="table-cell text-gray-400">{formatDateTime(a.created_at)}</td>
                    <td className="table-cell text-gray-500">{a.created_by_name || '--'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(a)}>Sửa</button>
                        <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(a.id)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} perPage={20} onChange={setPage} />
        </div>
      </div>

      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật lịch hẹn' : 'Tạo lịch hẹn mới'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpenForm(false); setEditing(null) }}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit(d => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={e => e.preventDefault()}>
          <div>
            <label className="label">Loại hẹn</label>
            <select className="input" {...register('type')}>
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Khách hàng <span className="text-red-500">*</span></label>
            <select className="input" {...register('customer_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn khách hàng --</option>
              {customers.map((c: { id: number; full_name: string }) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ngày giờ hẹn</label>
            <input className="input" type="datetime-local" {...register('appointment_date')} />
          </div>
          <div>
            <label className="label">Địa điểm</label>
            <input className="input" {...register('location')} placeholder="VD: Nhà mẫu Vinhomes Ocean Park" />
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <select className="input" {...register('status')}>
              {Object.entries(APPOINTMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label className="label">Ghi chú</label>
            <textarea className="input" rows={3} {...register('notes')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
