import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { needsApi, customersApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Need } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const COLUMNS = [
  { key: 'verifying',   label: 'Xác thực',  processing_status: 'verifying' },
  { key: 'consulting',  label: 'Tư vấn',    processing_status: 'consulting' },
  { key: 'transaction', label: 'Giao dịch', processing_status: 'transaction' },
]

const TAB_ITEMS = [
  { label: 'Tất cả',     value: 'all' },
  { label: 'Trong hạn',  value: 'active' },
  { label: 'Sắp hết hạn', value: 'expiring' },
  { label: 'Quá hạn',    value: 'expired' },
]

const SCORE_COLOR = (score: number) => score >= 70 ? 'green' : score >= 40 ? 'orange' : 'gray'

type FormData = {
  title: string; customer_id: number; project_preference: string
  budget_min: number; budget_max: number; bedrooms: string
  activity_status: string; processing_status: string; score: number
}

export default function Tasks() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Need | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tasks-needs', tab],
    queryFn: () => needsApi.list({ per_page: 200, activity_status: tab === 'all' ? undefined : 'active' }),
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
  })

  const needs: Need[] = data?.data ?? []
  const customers = customersData?.data ?? []

  const filtered = needs.filter(n =>
    !search ||
    n.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    n.title?.toLowerCase().includes(search.toLowerCase())
  )

  const { register, handleSubmit, reset } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? needsApi.update(editing.id, d) : needsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['tasks-needs'] })
      qc.invalidateQueries({ queryKey: ['needs'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => needsApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa công việc!')
      qc.invalidateQueries({ queryKey: ['tasks-needs'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (n: Need) => {
    setEditing(n)
    reset({
      title: n.title, customer_id: n.customer_id,
      project_preference: n.project_preference,
      budget_min: n.budget_min, budget_max: n.budget_max,
      bedrooms: n.bedrooms, activity_status: n.activity_status,
      processing_status: n.processing_status, score: n.score,
    })
    setOpenForm(true)
  }

  const openCreate = () => {
    setEditing(null)
    reset({ activity_status: 'active', processing_status: 'verifying', score: 0 })
    setOpenForm(true)
  }

  const getColumnItems = (status: string) =>
    filtered.filter(n => n.processing_status === status)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý công việc</h1>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Thêm mới công việc
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        {TAB_ITEMS.map(t => (
          <button
            key={t.value}
            className={`tab-item ${tab === t.value ? 'active' : ''}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
            {t.value === 'all' && <span className="ml-1 text-gray-400">{filtered.length}</span>}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-52"
            placeholder="Tìm kiếm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-secondary gap-2">
          <SlidersHorizontal size={14} /> Bộ lọc
        </button>
        <div className="ml-auto">
          <button className="btn-secondary gap-2">
            <ArrowUpDown size={14} /> SLA xử lý ít nhất – nhiều nhất
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="bds-card p-4">
              <div className="h-5 bg-gray-200 rounded w-24 mb-4 animate-pulse" />
              <LoadingState rows={3} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => {
            const items = getColumnItems(col.processing_status)
            return (
              <div key={col.key} className="bds-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">{col.label}</h3>
                  <span className="badge badge-blue">{items.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-[200px]">
                  {items.length === 0 ? (
                    <EmptyState message="Chưa có công việc" />
                  ) : items.map(need => (
                    <div
                      key={need.id}
                      className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200 group"
                      onClick={() => handleEdit(need)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-gray-800 leading-tight">
                          {need.title || need.customer_name || `NCD-${need.id}`}
                        </p>
                        {need.score > 0 && (
                          <Badge label={String(need.score)} color={SCORE_COLOR(need.score) as never} />
                        )}
                      </div>
                      {need.customer_name && (
                        <p className="text-xs text-gray-500 mt-1">{need.customer_name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{need.project_preference || '--'}</span>
                        <span className="text-xs text-gray-400">{formatDate(need.created_at)}</span>
                      </div>
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="text-xs text-blue-500 hover:underline"
                          onClick={e => { e.stopPropagation(); handleEdit(need) }}
                        >Sửa</button>
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={e => { e.stopPropagation(); setDeleteId(need.id) }}
                        >Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal thêm/sửa công việc */}
      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật công việc' : 'Thêm mới công việc'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpenForm(false); setEditing(null) }}>Hủy</button>
            <button
              className="btn-primary"
              onClick={handleSubmit(d => saveMutation.mutate(d))}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={e => e.preventDefault()}>
          <div className="form-full">
            <label className="label">Khách hàng <span className="text-red-500">*</span></label>
            <select className="input" {...register('customer_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn khách hàng --</option>
              {customers.map((c: { id: number; full_name: string }) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-full">
            <label className="label">Tiêu đề công việc</label>
            <input className="input" {...register('title')} placeholder="VD: Tư vấn mua Vinhomes Ocean Park" />
          </div>
          <div>
            <label className="label">Dự án quan tâm</label>
            <input className="input" {...register('project_preference')} placeholder="Vinhomes Ocean Park" />
          </div>
          <div>
            <label className="label">Số phòng ngủ</label>
            <input className="input" {...register('bedrooms')} placeholder="2PN, 3PN..." />
          </div>
          <div>
            <label className="label">Ngân sách từ (tỷ)</label>
            <input className="input" type="number" step="0.1" {...register('budget_min', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Ngân sách đến (tỷ)</label>
            <input className="input" type="number" step="0.1" {...register('budget_max', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Giai đoạn xử lý</label>
            <select className="input" {...register('processing_status')}>
              <option value="verifying">Xác thực</option>
              <option value="consulting">Tư vấn</option>
              <option value="transaction">Giao dịch</option>
            </select>
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <select className="input" {...register('activity_status')}>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
          <div>
            <label className="label">Điểm tiềm năng (0–100)</label>
            <input className="input" type="number" min="0" max="100" {...register('score', { valueAsNumber: true })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Xóa công việc"
        message="Bạn có chắc muốn xóa công việc này không?"
      />
    </div>
  )
}
