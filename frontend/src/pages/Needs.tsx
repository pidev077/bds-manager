import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, Phone, Sparkles } from 'lucide-react'
import { needsApi, customersApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatArea } from '@/lib/utils'
import type { Need, Property } from '@/types'
import { NEED_BUY_STATUS_LABELS, NEED_BUY_STATUS_COLORS, LEAD_CLASSIFICATION_LABELS, LEAD_CLASSIFICATION_COLORS, NEED_FINANCE_TYPE_LABELS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const PROCESSING_TABS = [
  { label: 'Tất cả', value: '' },
  { label: 'Chưa xử lý', value: 'pending' },
  { label: 'Đang xác thực', value: 'verifying' },
  { label: 'Đã xác thực', value: 'verified' },
  { label: 'Đã tạo lịch hẹn', value: 'appointment_created' },
  { label: 'Đã gặp mặt thực tế', value: 'met' },
  { label: 'Đang giao dịch', value: 'transaction' },
  { label: 'Đã giao dịch', value: 'done' },
]

const ACTIVITY_COLORS: Record<string, string> = { active: 'green', inactive: 'red' }

type FormData = {
  title: string; customer_id: number; type: string; tier: string
  project_preference: string; budget_min: number; budget_max: number
  bedrooms: string; activity_status: string; processing_status: string
  buy_status: string; classification: string; label_tag: string
  need_type: string; finance_type: string; score: number
}

export default function Needs() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Need | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [matchingNeed, setMatchingNeed] = useState<Need | null>(null)
  const isAdmin = !!useAuthStore(s => s.user)?.is_admin
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const params: Record<string, unknown> = { page, per_page: 20, search: search || undefined, processing_status: tab || undefined, tier: 'primary' }

  const { data, isLoading } = useQuery({
    queryKey: ['needs', params],
    queryFn: () => needsApi.list(params),
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
  })

  const needs: Need[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const customers = customersData?.data ?? []

  const { register, handleSubmit, reset } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? needsApi.update(editing.id, d) : needsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['needs'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => needsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['needs'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (n: Need) => {
    setEditing(n)
    reset({ title: n.title, customer_id: n.customer_id, type: n.type, tier: n.tier, project_preference: n.project_preference, budget_min: n.budget_min, budget_max: n.budget_max, bedrooms: n.bedrooms, activity_status: n.activity_status, processing_status: n.processing_status, buy_status: n.buy_status, classification: n.classification, label_tag: n.label_tag, need_type: n.need_type, finance_type: n.finance_type, score: n.score })
    setOpenForm(true)
  }

  const { data: matchesData } = useQuery({
    queryKey: ['need-matches', matchingNeed?.id],
    queryFn: () => needsApi.matches(matchingNeed!.id),
    enabled: !!matchingNeed,
  })
  const matchedProperties: Property[] = matchesData?.data ?? []

  // Mở thẳng "Căn phù hợp" khi đến từ thông báo need_match
  useEffect(() => {
    const openNeedId = (location.state as { openNeedId?: number } | null)?.openNeedId
    if (!openNeedId) return
    needsApi.get(openNeedId).then(res => setMatchingNeed(res.data)).catch(() => {})
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh sách nhu cầu mua – Sơ cấp</h1>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); reset({ type: 'buy', tier: 'primary', activity_status: 'active', buy_status: 'considering' }); setOpenForm(true) }}>
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Sidebar tabs as top tabs */}
      <div className="tab-nav overflow-x-auto flex-nowrap">
        {PROCESSING_TABS.map(t => (
          <button key={t.value} className={`tab-item shrink-0 ${tab === t.value ? 'active' : ''}`} onClick={() => { setTab(t.value); setPage(1) }}>
            {t.label} {t.value === '' && <span className="ml-1 text-gray-400">{total}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <button className="btn-secondary gap-2"><SlidersHorizontal size={14} /> Bộ lọc / 2</button>
      </div>

      <div className="bds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['ID', 'Tiêu đề', 'Khách hàng', 'Score', 'Phân loại nhu cầu', 'Trạng thái hoạt động', 'Trạng thái mua', 'Phân loại', 'Nhãn cá nhân', 'Loại nhu cầu mua', 'Tài chính', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12}><LoadingState /></td></tr>
              ) : needs.length === 0 ? (
                <tr><td colSpan={12}><EmptyState /></td></tr>
              ) : needs.map(n => (
                <tr key={n.id} className="table-row">
                  <td className="table-cell font-medium text-gray-500 uppercase">{n.code || `MH${n.id}`}</td>
                  <td className="table-cell">
                    <p className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(n)}>
                      {n.title || `Mua ${n.project_preference || 'dự án'}`}
                    </p>
                  </td>
                  <td className="table-cell">
                    {n.customer_name ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
                          {n.customer_name.split(' ').pop()?.[0]?.toUpperCase() ?? 'K'}
                        </div>
                        <span>{n.customer_name}</span>
                        {n.customer_phone && (
                          <button className="text-gray-400 hover:text-brand ml-1"><Phone size={12} /></button>
                        )}
                      </div>
                    ) : '--'}
                  </td>
                  <td className="table-cell">
                    {n.score > 0 ? <Badge label={String(n.score)} color={n.score >= 50 ? 'orange' : 'gray'} /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-gray-500">{n.project_preference || '--'}</td>
                  <td className="table-cell">
                    <Badge label={n.activity_status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'} color={(ACTIVITY_COLORS[n.activity_status] ?? 'gray') as never} dot />
                  </td>
                  <td className="table-cell">
                    {n.buy_status ? <Badge label={NEED_BUY_STATUS_LABELS[n.buy_status] ?? n.buy_status} color={(NEED_BUY_STATUS_COLORS[n.buy_status] ?? 'gray') as never} /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell">
                    {n.classification ? <Badge label={LEAD_CLASSIFICATION_LABELS[n.classification] ?? n.classification} color={(LEAD_CLASSIFICATION_COLORS[n.classification] ?? 'gray') as never} /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-gray-500">{n.label_tag || '--'}</td>
                  <td className="table-cell text-gray-500">{n.need_type || 'Mua từ CĐT'}</td>
                  <td className="table-cell text-gray-500">{n.finance_type ? (NEED_FINANCE_TYPE_LABELS[n.finance_type] ?? n.finance_type) : '-'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(n)}>Sửa</button>
                      <button className="text-xs text-gray-500 hover:underline flex items-center gap-1" onClick={() => setMatchingNeed(n)}>
                        <Sparkles size={12} /> Căn phù hợp
                      </button>
                      {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(n.id)}>Xóa</button>}
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
        title={editing ? 'Cập nhật nhu cầu' : 'Thêm nhu cầu mua mới'}
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
            <label className="label">Khách hàng <span className="text-red-500">*</span></label>
            <select className="input" {...register('customer_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn khách hàng --</option>
              {customers.map((c: { id: number; full_name: string }) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label className="label">Tiêu đề</label>
            <input className="input" {...register('title')} placeholder="VD: Mua Vinhomes Ocean Park" />
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
            <label className="label">Loại nhu cầu</label>
            <select className="input" {...register('need_type')}>
              <option value="">-- Chọn --</option>
              <option value="Mua từ CĐT">Mua từ CĐT</option>
              <option value="Mua thứ cấp">Mua thứ cấp</option>
            </select>
          </div>
          <div>
            <label className="label">Tình trạng xử lý</label>
            <select className="input" {...register('processing_status')}>
              {PROCESSING_TABS.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trạng thái hoạt động</label>
            <select className="input" {...register('activity_status')}>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
          <div>
            <label className="label">Score (0–100)</label>
            <input className="input" type="number" min="0" max="100" {...register('score', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Trạng thái mua</label>
            <select className="input" {...register('buy_status')}>
              <option value="">-- Chưa xác định --</option>
              {Object.entries(NEED_BUY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phân loại</label>
            <select className="input" {...register('classification')}>
              <option value="">-- Không --</option>
              {Object.entries(LEAD_CLASSIFICATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nhãn cá nhân</label>
            <input className="input" {...register('label_tag')} placeholder="VD: Khách quen, Ưu tiên gọi lại..." />
          </div>
          <div>
            <label className="label">Tài chính</label>
            <select className="input" {...register('finance_type')}>
              <option value="">-- Chưa rõ --</option>
              {Object.entries(NEED_FINANCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />

      <Modal
        open={!!matchingNeed}
        onClose={() => setMatchingNeed(null)}
        title={`Căn phù hợp với nhu cầu "${matchingNeed?.title || `NCD${matchingNeed?.id}`}"`}
        size="lg"
      >
        {matchedProperties.length === 0 ? (
          <EmptyState message="Chưa có căn nào phù hợp với nhu cầu này" />
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {matchedProperties.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.unit_number || p.code} - {p.title}</p>
                  <p className="text-xs text-gray-500">{p.project_name} · {p.property_type} · {formatArea(p.area_gross)} {p.view_type ? `· View ${p.view_type}` : ''}</p>
                </div>
                <p className="text-sm font-medium">{formatCurrency(p.price)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
