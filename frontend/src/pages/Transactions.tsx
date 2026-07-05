import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { transactionsApi, customersApi, propertiesApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const TABS = [
  { label: 'Giao dịch sơ cấp', value: 'primary' },
  { label: 'Giao dịch thứ cấp', value: 'secondary' },
]

const STAGES = ['Đặt cọc', 'Ký HĐMB', 'Bàn giao', 'Hoàn thành']

type FormData = {
  name: string; customer_id: number; property_id: number; value: number
  source_customer: string; source_transaction: string; stage: string; status: string
  project: string; tier: string; commission: number; notes: string
}

export default function Transactions() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('primary')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const isAdmin = !!useAuthStore(s => s.user)?.is_admin
  const qc = useQueryClient()

  const params: Record<string, unknown> = { page, per_page: 20, tier: tab, search: search || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.list(params),
  })

  const { data: customersData } = useQuery({ queryKey: ['customers-select'], queryFn: () => customersApi.list({ per_page: 200 }) })
  const { data: propertiesData } = useQuery({ queryKey: ['properties-select'], queryFn: () => propertiesApi.list({ per_page: 200 }) })

  const transactions: Transaction[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const customers = customersData?.data ?? []
  const properties = propertiesData?.data ?? []

  const { register, handleSubmit, reset } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? transactionsApi.update(editing.id, d) : transactionsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Tạo giao dịch thành công!')
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['transactions'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (t: Transaction) => {
    setEditing(t)
    reset({ name: t.name, customer_id: t.customer_id, property_id: t.property_id ?? 0, value: t.value, source_customer: t.source_customer, source_transaction: t.source_transaction, stage: t.stage, status: t.status, project: t.project, tier: t.tier, commission: t.commission, notes: t.notes })
    setOpenForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tất cả giao dịch</h1>
          <p className="text-xs text-gray-400 mt-1">Quản lý tiến trình giao dịch của khách hàng</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); reset({ tier: tab, value: 0, commission: 0 }); setOpenForm(true) }}>
          <Plus size={16} /> Tạo mới
        </button>
      </div>

      {/* Tier tabs */}
      <div className="tab-nav">
        {TABS.map(t => (
          <button key={t.value} className={`tab-item ${tab === t.value ? 'active' : ''}`} onClick={() => { setTab(t.value); setPage(1) }}>
            {t.label} {tab === t.value && <span className="ml-1 text-gray-400">{total}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <button className="btn-secondary gap-2"><SlidersHorizontal size={14} /> Bộ lọc</button>
      </div>

      <div className="bds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Tên giao dịch', 'Giá trị giao dịch', 'Khách hàng', 'Nguồn KH', 'Nguồn GD', 'Giai đoạn', 'Trạng thái GD', 'Bất động sản', 'Dự án', 'Người tạo', 'Nhân sự phụ trách', 'Hoa hồng', 'Ngày tạo', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={14}><LoadingState /></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={14}><EmptyState message="Không có dữ liệu" /></td></tr>
              ) : transactions.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(t)}>
                    {t.name || `GD-${t.id}`}
                  </td>
                  <td className="table-cell font-semibold text-gray-800">{formatCurrency(t.value)}</td>
                  <td className="table-cell">{t.customer_name || '--'}</td>
                  <td className="table-cell text-gray-500">{t.source_customer || '--'}</td>
                  <td className="table-cell text-gray-500">{t.source_transaction || '--'}</td>
                  <td className="table-cell">
                    {t.stage ? <Badge label={t.stage} color="blue" /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell">
                    {t.status ? <Badge label={t.status} color="green" dot /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-gray-500">{t.property_title || '--'}</td>
                  <td className="table-cell text-gray-500">{t.project || '--'}</td>
                  <td className="table-cell text-gray-500">{t.created_by_name || '--'}</td>
                  <td className="table-cell text-gray-500">{t.assigned_to_name || '--'}</td>
                  <td className="table-cell font-medium text-green-600">{t.commission ? formatCurrency(t.commission) : '--'}</td>
                  <td className="table-cell text-gray-400">{formatDate(t.created_at)}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(t)}>Sửa</button>
                      {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(t.id)}>Xóa</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} perPage={20} onChange={setPage} />
      </div>

      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật giao dịch' : 'Tạo giao dịch mới'}
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
          <div className="form-full">
            <label className="label">Tên giao dịch</label>
            <input className="input" {...register('name')} placeholder="VD: Giao dịch căn LD31107" />
          </div>
          <div>
            <label className="label">Khách hàng <span className="text-red-500">*</span></label>
            <select className="input" {...register('customer_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn khách hàng --</option>
              {customers.map((c: { id: number; full_name: string }) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bất động sản</label>
            <select className="input" {...register('property_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn BDS --</option>
              {properties.map((p: { id: number; title: string; unit_number: string }) => <option key={p.id} value={p.id}>{p.unit_number || p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Giá trị giao dịch (VNĐ)</label>
            <input className="input" type="number" {...register('value', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Giai đoạn</label>
            <select className="input" {...register('stage')}>
              <option value="">-- Chọn giai đoạn --</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <input className="input" {...register('status')} placeholder="VD: Đang xử lý" />
          </div>
          <div>
            <label className="label">Nguồn khách hàng</label>
            <input className="input" {...register('source_customer')} />
          </div>
          <div>
            <label className="label">Loại giao dịch</label>
            <select className="input" {...register('tier')}>
              <option value="primary">Sơ cấp</option>
              <option value="secondary">Thứ cấp</option>
            </select>
          </div>
          <div>
            <label className="label">Hoa hồng (VNĐ)</label>
            <input className="input" type="number" {...register('commission', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Dự án</label>
            <input className="input" {...register('project')} />
          </div>
          <div className="form-full">
            <label className="label">Ghi chú</label>
            <textarea className="input" rows={2} {...register('notes')} />
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
