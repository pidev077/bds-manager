import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, ChevronRight, Link2, Clipboard, ShoppingCart } from 'lucide-react'
import { propertiesApi, customersApi, cartApi, projectsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatArea, formatCurrency } from '@/lib/utils'
import type { Property, Customer, Project } from '@/types'
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_COLORS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const PROPERTY_TYPES = ['1PN', '2PN', '3PN', '4PN', '5PN', '1PN+1', '2PN+1 (1 Toilet)', '2PN+1 (2 Toilets)', '2PN+2 (2 Toilets)', '2PN (2 TOILET)', '2PN (1 TOILET)', '3PN+1', 'Biệt thự đơn lập', 'Biệt thự song lập', 'Biệt thự tứ lập', 'Nhà liền kề', 'Shop-house', 'Studio']

const DIRECTIONS = ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam', 'Đông Bắc', 'Tây Nam', 'Tây Bắc', 'ĐB - ĐN', 'TB - TN']

const VIEWS = ['Biển', 'Công viên', 'Quảng trường', 'Sông']

const PRICE_RANGES = [
  { label: 'Dưới 5 tỷ', min: undefined, max: 5_000_000_000 },
  { label: '5-10 tỷ', min: 5_000_000_000, max: 10_000_000_000 },
  { label: '10-20 tỷ', min: 10_000_000_000, max: 20_000_000_000 },
  { label: 'Trên 20 tỷ', min: 20_000_000_000, max: undefined },
]

const AREA_RANGES = [
  { label: 'Dưới 80m²', min: undefined, max: 80 },
  { label: '80-120m²', min: 80, max: 120 },
  { label: 'Trên 120m²', min: 120, max: undefined },
]

const PROPERTY_CATEGORIES = [
  { label: 'Căn hộ', value: 'apartment' },
  { label: 'Nhà phố', value: 'townhouse' },
  { label: 'Shophouse', value: 'shophouse' },
  { label: 'Biệt thự', value: 'villa' },
]

type FormData = {
  title: string; code: string; project_name: string; block: string; floor: string
  unit_number: string; area_gross: number; area_net: number; bedrooms: number
  bathrooms: number; direction: string; balcony_direction: string; view_type: string; price: number
  property_type: string; fund_type: string; status: string; component: string; standard: string; description: string
}

export default function Properties() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFundType, setFilterFundType] = useState('')
  const [filterCreatedToday, setFilterCreatedToday] = useState(false)
  const [filterPriceRange, setFilterPriceRange] = useState<number | null>(null)
  const [filterAreaRange, setFilterAreaRange] = useState<number | null>(null)
  const [filterView, setFilterView] = useState('')
  const [typeTab, setTypeTab] = useState('all')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [cartTarget, setCartTarget] = useState<Property | null>(null)
  const [cartCustomerId, setCartCustomerId] = useState<number>(0)
  const [viewing, setViewing] = useState<Property | null>(null)
  const isAdmin = !!useAuthStore(s => s.user)?.is_admin
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })
  const projects: Project[] = projectsData?.data ?? []

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
    enabled: !!cartTarget,
  })
  const customers: Customer[] = customersData?.data ?? []

  const addToCartMutation = useMutation({
    mutationFn: () => cartApi.add({ customer_id: cartCustomerId, property_id: cartTarget!.id }),
    onSuccess: () => { toast.success('Đã thêm vào giỏ hàng'); setCartTarget(null); setCartCustomerId(0) },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const priceRange = filterPriceRange !== null ? PRICE_RANGES[filterPriceRange] : undefined
  const areaRange = filterAreaRange !== null ? AREA_RANGES[filterAreaRange] : undefined

  const params = {
    page, per_page: 20, search: search || undefined,
    project_name: filterProject || undefined,
    property_type: typeTab !== 'all' ? typeTab : (filterType || undefined),
    status: filterStatus || undefined,
    fund_type: filterFundType || undefined,
    created_today: filterCreatedToday || undefined,
    property_category: filterCategory || undefined,
    view_type: filterView || undefined,
    price_min: priceRange?.min, price_max: priceRange?.max,
    area_min: areaRange?.min, area_max: areaRange?.max,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['properties', params],
    queryFn: () => propertiesApi.list(params),
  })

  const properties: Property[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')

  const { data: similarData } = useQuery({
    queryKey: ['similar-properties', viewing?.id],
    queryFn: () => propertiesApi.similar(viewing!.id),
    enabled: !!viewing,
  })
  const similarProperties: Property[] = similarData?.data ?? []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? propertiesApi.update(editing.id, d) : propertiesApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['properties'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => propertiesApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['properties'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (p: Property) => {
    setEditing(p); reset({ ...p, area_gross: p.area_gross, area_net: p.area_net, price: p.price, bedrooms: p.bedrooms, bathrooms: p.bathrooms }); setOpenForm(true)
  }

  const handleAdd = () => { setEditing(null); reset({ fund_type: 'F0', status: 'available', bedrooms: 0, bathrooms: 0 }); setOpenForm(true) }

  // Mở thẳng chi tiết căn khi đến từ thông báo new_property/updated_property
  useEffect(() => {
    const state = location.state as { openPropertyId?: number; filterFundType?: string; filterStatus?: string; filterCreatedToday?: boolean } | null
    if (!state) return
    if (state.openPropertyId) {
      propertiesApi.get(state.openPropertyId).then(res => setViewing(res.data)).catch(() => {})
    }
    if (state.filterFundType !== undefined) { setFilterFundType(state.filterFundType); setPage(1) }
    if (state.filterStatus !== undefined) { setFilterStatus(state.filterStatus); setPage(1) }
    if (state.filterCreatedToday !== undefined) { setFilterCreatedToday(state.filterCreatedToday); setPage(1) }
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  return (
    <div className="flex gap-4">
      {/* Sidebar - Projects */}
      <div className="w-56 shrink-0">
        <div className="bds-card">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kho sản phẩm</p>
            <p className="text-xs text-gray-400 mt-0.5">Danh sách dự án</p>
          </div>
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-2">DANH SÁCH QUỸ CĂN</p>
            {projects.map(proj => (
              <button
                key={proj.id}
                onClick={() => setFilterProject(filterProject === proj.name ? '' : proj.name)}
                className={`flex items-center justify-between w-full text-left px-2 py-2 rounded text-xs transition-colors ${filterProject === proj.name ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronRight size={12} className={`transition-transform ${filterProject === proj.name ? 'rotate-90' : ''}`} />
                  {proj.name}
                </span>
                <span className="text-gray-400">{proj.property_count || ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="page-header">
          <h1 className="page-title">
            {filterProject ? `Kho sản phẩm - ${filterProject}` : 'Kho sản phẩm'}
          </h1>
          <button className="btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Thêm mới
          </button>
        </div>

        {/* Type tabs */}
        <div className="tab-nav overflow-x-auto flex-nowrap scrollbar-none">
          <button className={`tab-item shrink-0 ${typeTab === 'all' ? 'active' : ''}`} onClick={() => setTypeTab('all')}>
            Tất cả <span className="ml-1 text-gray-400">{total}</span>
          </button>
          {PROPERTY_TYPES.slice(0, 6).map(t => (
            <button key={t} className={`tab-item shrink-0 ${typeTab === t ? 'active' : ''}`} onClick={() => setTypeTab(typeTab === t ? 'all' : t)}>
              {t}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-48" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <button className="btn-secondary gap-2">
            <SlidersHorizontal size={14} /> Bộ lọc
          </button>
          <select className="input w-44 shrink-0" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(PROPERTY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input w-40 shrink-0" value={filterFundType} onChange={e => { setFilterFundType(e.target.value); setPage(1) }}>
            <option value="">Tất cả quỹ căn</option>
            <option value="F0">Quỹ sơ cấp (F0)</option>
            <option value="F1">Quỹ thứ cấp (F1)</option>
          </select>
          {filterCreatedToday && (
            <button
              className="filter-chip active gap-1"
              onClick={() => { setFilterCreatedToday(false); setPage(1) }}
              title="Bỏ lọc sản phẩm mới hôm nay"
            >
              Mới hôm nay ✕
            </button>
          )}
        </div>

        {/* Quick filters: Loại hình / Giá / Diện tích / View */}
        <div className="bds-card flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">Loại hình:</span>
            {PROPERTY_CATEGORIES.map(c => (
              <button
                key={c.value}
                className={`filter-chip ${filterCategory === c.value ? 'active' : ''}`}
                onClick={() => { setFilterCategory(filterCategory === c.value ? '' : c.value); setPage(1) }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">Giá:</span>
            {PRICE_RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`filter-chip ${filterPriceRange === i ? 'active' : ''}`}
                onClick={() => { setFilterPriceRange(filterPriceRange === i ? null : i); setPage(1) }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">Diện tích:</span>
            {AREA_RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`filter-chip ${filterAreaRange === i ? 'active' : ''}`}
                onClick={() => { setFilterAreaRange(filterAreaRange === i ? null : i); setPage(1) }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">View:</span>
            {VIEWS.map(v => (
              <button
                key={v}
                className={`filter-chip ${filterView === v ? 'active' : ''}`}
                onClick={() => { setFilterView(filterView === v ? '' : v); setPage(1) }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Mã căn', 'Cấu phần', 'Loại quỹ', 'Tình trạng căn', 'Loại căn', 'Tòa', 'Trục', 'Vị trí tầng', 'DT tim tường', 'DT thông thủy', 'Hướng cửa', 'Hướng ban công', 'PN', 'Toilet', 'Tiêu chuẩn', 'Thao tác'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={16}><LoadingState /></td></tr>
                ) : properties.length === 0 ? (
                  <tr><td colSpan={16}><EmptyState /></td></tr>
                ) : properties.map(p => (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Link2 size={12} className="text-blue-400 cursor-pointer shrink-0" />
                        <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => setViewing(p)}>
                          {p.unit_number || p.code || `#${p.id}`}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      {p.component ? (
                        <button className="text-gray-400 hover:text-gray-600"><Clipboard size={14} /></button>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="table-cell text-gray-500">{p.fund_type || '-'}</td>
                    <td className="table-cell">
                      <Badge
                        label={PROPERTY_STATUS_LABELS[p.status] ?? p.status}
                        color={PROPERTY_STATUS_COLORS[p.status] as never ?? 'gray'}
                        dot
                      />
                    </td>
                    <td className="table-cell">{p.property_type || '-'}</td>
                    <td className="table-cell">{p.block || '-'}</td>
                    <td className="table-cell text-gray-500">{p.floor || '-'}</td>
                    <td className="table-cell">{p.floor ? `Tầng ${p.floor}` : '-'}</td>
                    <td className="table-cell">{formatArea(p.area_gross)}</td>
                    <td className="table-cell">{formatArea(p.area_net)}</td>
                    <td className="table-cell">{p.direction || '-'}</td>
                    <td className="table-cell">{p.balcony_direction || '-'}</td>
                    <td className="table-cell">{p.bedrooms || '-'}</td>
                    <td className="table-cell">{p.bathrooms || '-'}</td>
                    <td className="table-cell text-gray-500">{p.standard || '-'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(p)}>Sửa</button>
                        <button className="text-xs text-gray-500 hover:underline flex items-center gap-1" onClick={() => setCartTarget(p)}>
                          <ShoppingCart size={12} /> Thêm vào giỏ
                        </button>
                        {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(p.id)}>Xóa</button>}
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

      {/* Form Modal */}
      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật nhà bán' : 'Thêm mới nhà bán'}
        size="xl"
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
            <label className="label">Mã căn</label>
            <input className="input" {...register('unit_number')} placeholder="VD: LD31107" />
          </div>
          <div>
            <label className="label">Tiêu đề <span className="text-red-500">*</span></label>
            <input className="input" {...register('title', { required: true })} placeholder="Tên căn hộ" />
            {errors.title && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          <div>
            <label className="label">Dự án</label>
            <select className="input" {...register('project_name')}>
              <option value="">-- Chọn dự án --</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tòa</label>
            <input className="input" {...register('block')} placeholder="VD: LD3, A1" />
          </div>
          <div>
            <label className="label">Loại căn</label>
            <select className="input" {...register('property_type')}>
              <option value="">-- Chọn loại --</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tầng</label>
            <input className="input" {...register('floor')} placeholder="VD: 11" />
          </div>
          <div>
            <label className="label">DT tim tường (m²)</label>
            <input className="input" type="number" step="0.1" {...register('area_gross', { valueAsNumber: true })} placeholder="96.5" />
          </div>
          <div>
            <label className="label">DT thông thủy (m²)</label>
            <input className="input" type="number" step="0.1" {...register('area_net', { valueAsNumber: true })} placeholder="90.3" />
          </div>
          <div>
            <label className="label">Số phòng ngủ</label>
            <input className="input" type="number" min="0" {...register('bedrooms', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Số toilet</label>
            <input className="input" type="number" min="0" {...register('bathrooms', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Hướng cửa</label>
            <select className="input" {...register('direction')}>
              <option value="">-- Chọn hướng --</option>
              {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Hướng ban công</label>
            <select className="input" {...register('balcony_direction')}>
              <option value="">-- Chọn hướng --</option>
              {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">View</label>
            <select className="input" {...register('view_type')}>
              <option value="">-- Chọn view --</option>
              {VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Giá bán (VNĐ)</label>
            <input className="input" type="number" {...register('price', { valueAsNumber: true })} placeholder="0" />
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <select className="input" {...register('status')}>
              {Object.entries(PROPERTY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Loại quỹ</label>
            <select className="input" {...register('fund_type')}>
              <option value="F0">F0</option>
              <option value="F1">F1</option>
            </select>
          </div>
          <div>
            <label className="label">Tiêu chuẩn bàn giao</label>
            <input className="input" {...register('standard')} placeholder="Thô, Hoàn thiện..." />
          </div>
          <div className="form-full">
            <label className="label">Mô tả</label>
            <textarea className="input" rows={3} {...register('description')} placeholder="Mô tả chi tiết..." />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        message="Bạn có chắc muốn xóa nhà bán này? Hành động không thể hoàn tác."
      />

      <Modal
        open={!!cartTarget}
        onClose={() => { setCartTarget(null); setCartCustomerId(0) }}
        title="Thêm vào giỏ hàng"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setCartTarget(null); setCartCustomerId(0) }}>Hủy</button>
            <button className="btn-primary" disabled={!cartCustomerId || addToCartMutation.isPending} onClick={() => addToCartMutation.mutate()}>
              {addToCartMutation.isPending ? 'Đang thêm...' : 'Thêm vào giỏ'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-3">Căn: <span className="font-medium text-gray-800">{cartTarget?.code || cartTarget?.unit_number} - {cartTarget?.title}</span></p>
        <label className="label">Chọn khách hàng</label>
        <select className="input" value={cartCustomerId} onChange={e => setCartCustomerId(Number(e.target.value))}>
          <option value={0}>-- Chọn khách hàng --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `- ${c.phone}` : ''}</option>)}
        </select>
      </Modal>

      {/* Detail + Similar properties Modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`Chi tiết căn ${viewing?.unit_number || viewing?.code || ''}`}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setViewing(null)}>Đóng</button>
            <button className="btn-primary" onClick={() => { if (viewing) { handleEdit(viewing); setViewing(null) } }}>Sửa căn này</button>
          </>
        }
      >
        {viewing && (
          <div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-5">
              <div><p className="text-gray-400 text-xs">Tiêu đề</p><p className="font-medium">{viewing.title}</p></div>
              <div><p className="text-gray-400 text-xs">Dự án</p><p className="font-medium">{viewing.project_name || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Tòa / Tầng</p><p className="font-medium">{viewing.block || '--'} / {viewing.floor || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Loại căn</p><p className="font-medium">{viewing.property_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">DT tim tường / thông thủy</p><p className="font-medium">{formatArea(viewing.area_gross)} / {formatArea(viewing.area_net)}</p></div>
              <div><p className="text-gray-400 text-xs">PN / Toilet</p><p className="font-medium">{viewing.bedrooms || '--'} / {viewing.bathrooms || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Hướng cửa / ban công</p><p className="font-medium">{viewing.direction || '--'} / {viewing.balcony_direction || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">View</p><p className="font-medium">{viewing.view_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Giá bán</p><p className="font-medium">{formatCurrency(viewing.price)}</p></div>
              <div><p className="text-gray-400 text-xs">Trạng thái</p><Badge label={PROPERTY_STATUS_LABELS[viewing.status] ?? viewing.status} color={PROPERTY_STATUS_COLORS[viewing.status] as never ?? 'gray'} dot /></div>
            </div>
            {viewing.description && (
              <div className="mb-5">
                <p className="text-gray-400 text-xs mb-1">Mô tả</p>
                <p className="text-sm text-gray-700">{viewing.description}</p>
              </div>
            )}

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sản phẩm tương tự</p>
            {similarProperties.length === 0 ? (
              <EmptyState message="Không có sản phẩm tương tự" />
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {similarProperties.map(sp => (
                  <div key={sp.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sp.unit_number || sp.code} - {sp.title}</p>
                      <p className="text-xs text-gray-500">{sp.project_name} · {sp.property_type} · {formatArea(sp.area_gross)} {sp.view_type ? `· View ${sp.view_type}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(sp.price)}</p>
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => setViewing(sp)}>Xem</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
