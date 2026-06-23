import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, Phone } from 'lucide-react'
import { customersApi } from '@/lib/api'
import { formatDate, getInitials, getAvatarColor } from '@/lib/utils'
import type { Customer } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const TABS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Chưa kết nối', value: 'not_connected' },
  { label: 'Đã kết nối', value: 'connected' },
  { label: 'Người giới thiệu', value: 'referrer' },
]

const CONNECTION_COLORS: Record<string, string> = {
  connected: 'green',
  not_connected: 'gray',
}

const SOURCES = ['Facebook', 'Zalo', 'Website', 'Giới thiệu', 'Sự kiện', 'Telemarketing', 'idp-form-submission', 'Khác']

type FormData = {
  full_name: string; phone: string; email: string; source_detail: string
  source_overview: string; vinclub_rank: string; connection_status: string
  verification_status: string; classification: string; consent_status: number; notes: string
}

export default function Customers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const params: Record<string, unknown> = { page, per_page: 20, search: search || undefined }
  if (tab === 'not_connected') params.connection_status = 'not_connected'
  if (tab === 'connected') params.connection_status = 'connected'
  if (tab === 'referrer') params.tab = 'referrer'

  const { data, isLoading } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersApi.list(params),
  })

  const customers: Customer[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? customersApi.update(editing.id, d) : customersApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['customers'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (c: Customer) => {
    setEditing(c)
    reset({ full_name: c.full_name, phone: c.phone, email: c.email, source_detail: c.source_detail, source_overview: c.source_overview, vinclub_rank: c.vinclub_rank, connection_status: c.connection_status, verification_status: c.verification_status, classification: c.classification, consent_status: c.consent_status, notes: c.notes })
    setOpenForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Danh sách khách hàng</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); reset({ connection_status: 'not_connected' }); setOpenForm(true) }}>
          <Plus size={16} /> Tạo mới
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {TABS.map(t => (
          <button key={t.value} className={`tab-item ${tab === t.value ? 'active' : ''}`} onClick={() => { setTab(t.value); setPage(1) }}>
            {t.label} {t.value === 'all' && <span className="ml-1 text-gray-400">{total}</span>}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <button className="btn-secondary gap-2"><SlidersHorizontal size={14} /> Bộ lọc / 1</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Khách hàng', 'Tình trạng xác thực', 'Hạng Vinclub', 'Tình trạng kết nối', 'Đồng thuận sử dụng data', 'Nguồn chi tiết', 'Nguồn tổng quan', 'Phân loại', 'Nhân viên phụ trách', 'Ngày tạo', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11}><LoadingState /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={11}><EmptyState message="Không tìm thấy liên hệ phù hợp" /></td></tr>
              ) : customers.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(c.full_name)}`}>
                        {getInitials(c.full_name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 cursor-pointer hover:text-brand" onClick={() => handleEdit(c)}>
                          {c.full_name}
                        </p>
                        {c.phone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {c.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {c.verification_status ? <Badge label={c.verification_status} color="blue" /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-gray-500">{c.vinclub_rank || '--'}</td>
                  <td className="table-cell">
                    <Badge
                      label={c.connection_status === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}
                      color={(CONNECTION_COLORS[c.connection_status] ?? 'gray') as never}
                    />
                  </td>
                  <td className="table-cell text-center">
                    {c.consent_status ? <Badge label="Đã đồng thuận" color="green" /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-gray-500">{c.source_detail || '--'}</td>
                  <td className="table-cell text-gray-500">{c.source_overview || '--'}</td>
                  <td className="table-cell">{c.classification ? <Badge label={c.classification} color="purple" /> : <span className="text-gray-400">--</span>}</td>
                  <td className="table-cell text-gray-500">{c.assigned_to_name || '--'}</td>
                  <td className="table-cell text-gray-400">{formatDate(c.created_at)}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(c)}>Sửa</button>
                      <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(c.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} perPage={20} onChange={setPage} />
      </div>

      {/* Form Modal */}
      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật khách hàng' : 'Tạo mới khách hàng'}
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
            <label className="label">Họ và tên <span className="text-red-500">*</span></label>
            <input className="input" {...register('full_name', { required: true })} placeholder="Nguyễn Văn A" />
            {errors.full_name && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input className="input" {...register('phone')} placeholder="0901234567" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" {...register('email')} placeholder="example@email.com" />
          </div>
          <div>
            <label className="label">Hạng Vinclub</label>
            <select className="input" {...register('vinclub_rank')}>
              <option value="">-- Chưa có --</option>
              {['Pearl', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nguồn chi tiết</label>
            <select className="input" {...register('source_detail')}>
              <option value="">-- Chọn nguồn --</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nguồn tổng quan</label>
            <input className="input" {...register('source_overview')} placeholder="VD: Digital, Offline" />
          </div>
          <div>
            <label className="label">Tình trạng kết nối</label>
            <select className="input" {...register('connection_status')}>
              <option value="not_connected">Chưa kết nối</option>
              <option value="connected">Đã kết nối</option>
            </select>
          </div>
          <div>
            <label className="label">Tình trạng xác thực</label>
            <input className="input" {...register('verification_status')} placeholder="VD: Đã xác thực" />
          </div>
          <div>
            <label className="label">Phân loại</label>
            <input className="input" {...register('classification')} placeholder="VD: Hot, Warm, Cold" />
          </div>
          <div>
            <label className="label">Đồng thuận sử dụng data</label>
            <select className="input" {...register('consent_status', { valueAsNumber: true })}>
              <option value={0}>Chưa đồng thuận</option>
              <option value={1}>Đã đồng thuận</option>
            </select>
          </div>
          <div className="form-full">
            <label className="label">Ghi chú</label>
            <textarea className="input" rows={3} {...register('notes')} placeholder="Ghi chú thêm..." />
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
