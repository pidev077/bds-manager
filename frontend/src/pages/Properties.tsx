import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, ChevronLeft, Link2, ShoppingCart, ImagePlus, X } from 'lucide-react'
import { propertiesApi, customersApi, cartApi, projectsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatArea, formatCurrency, formatDate } from '@/lib/utils'
import type { Property, Customer, Project } from '@/types'
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_COLORS, CONTACT_STATUS_LABELS, PROPERTY_TAG_LABELS, STANDARD_OPTIONS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import MaskedPhone from '@/components/ui/MaskedPhone'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const PROPERTY_TYPES = ['Liền kề', 'Biệt thự', 'Căn hộ']

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

type FormData = {
  title: string; code: string; project_name: string; block: string; floor: string
  unit_number: string; area_gross: number; area_net: number; bedrooms: number
  bathrooms: number; direction: string; balcony_direction: string; view_type: string; price: number
  price_per_sqm: number; price_rent: number; road: string; dimensions: string; tag: string
  property_type: string; fund_type: string; status: string; standard: string; description: string
  owner_name: string; owner_phone: string; owner_phone_2: string; contact_status: string
  owner_selling_price: number; owner_commission_rate: number; owner_notes: string
}

export default function Properties() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFundType, setFilterFundType] = useState('')
  const [filterCreatedToday, setFilterCreatedToday] = useState(false)
  const [filterPriceRange, setFilterPriceRange] = useState<number | null>(null)
  const [filterAreaRange, setFilterAreaRange] = useState<number | null>(null)
  const [filterView, setFilterView] = useState('')
  const [filterOwnerPhone, setFilterOwnerPhone] = useState('')
  const [filterContactStatus, setFilterContactStatus] = useState('')
  const [typeTab, setTypeTab] = useState('all')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [cartTarget, setCartTarget] = useState<Property | null>(null)
  const [cartCustomerId, setCartCustomerId] = useState<number>(0)
  const [viewing, setViewing] = useState<Property | null>(null)
  const [imageTarget, setImageTarget] = useState<Property | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
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

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return propertiesApi.uploadImage(id, fd)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      setImageTarget(res.data)
    },
    onError: () => toast.error('Tải ảnh lên thất bại!'),
  })

  const deleteImageMutation = useMutation({
    mutationFn: ({ id, url }: { id: number; url: string }) => propertiesApi.deleteImage(id, url),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      setImageTarget(res.data)
    },
    onError: () => toast.error('Xóa ảnh thất bại!'),
  })

  const priceRange = filterPriceRange !== null ? PRICE_RANGES[filterPriceRange] : undefined
  const areaRange = filterAreaRange !== null ? AREA_RANGES[filterAreaRange] : undefined

  const params = {
    page, per_page: 20, search: search || undefined,
    project_name: filterProject || undefined,
    property_type: typeTab !== 'all' ? typeTab : undefined,
    status: filterStatus || undefined,
    fund_type: filterFundType || undefined,
    created_today: filterCreatedToday || undefined,
    view_type: filterView || undefined,
    price_min: priceRange?.min, price_max: priceRange?.max,
    area_min: areaRange?.min, area_max: areaRange?.max,
    owner_phone: filterOwnerPhone || undefined,
    contact_status: filterContactStatus || undefined,
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

  const { data: sameOwnerData } = useQuery({
    queryKey: ['same-owner-properties', viewing?.id],
    queryFn: () => propertiesApi.sameOwner(viewing!.id),
    enabled: !!viewing,
  })
  const sameOwnerProperties: Property[] = sameOwnerData?.data ?? []

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
    setEditing(p)
    reset({
      ...p, area_gross: p.area_gross, area_net: p.area_net, price: p.price, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
      owner_name: p.owner_name, owner_phone: p.owner_phone, owner_phone_2: p.owner_phone_2, contact_status: p.contact_status,
      owner_selling_price: p.owner_selling_price ?? undefined, owner_commission_rate: p.owner_commission_rate ?? undefined, owner_notes: p.owner_notes,
    })
    setOpenForm(true)
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

  // Điều hướng bàn phím cho popup xem ảnh to (lightbox)
  useEffect(() => {
    const images = imageTarget?.images
    if (lightboxIndex === null || !images || images.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => ((i ?? 0) - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setLightboxIndex(i => ((i ?? 0) + 1) % images.length)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxIndex, imageTarget])

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
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-48" placeholder="Tìm tên/SĐT chủ nhà" value={filterOwnerPhone} onChange={e => { setFilterOwnerPhone(e.target.value); setPage(1) }} />
          </div>
          <select className="input w-44 shrink-0" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(PROPERTY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input w-44 shrink-0" value={filterContactStatus} onChange={e => { setFilterContactStatus(e.target.value); setPage(1) }}>
            <option value="">Tất cả trạng thái liên hệ</option>
            {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

        {/* Quick filters: Giá / Diện tích / View */}
        <div className="bds-card flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 mb-4">
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
                  {['Mã tin', 'Chủ nhà', 'Mã căn', 'Giá bán', 'Giá thuê', 'Tòa/Phân khu', 'Đường', 'Trạng thái', 'Diện tích', 'Loại BĐS', 'Nội thất', 'Hướng cửa', 'Phân loại', 'Ghi chú', 'Thời gian', 'NV cập nhật', 'Thao tác'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={17}><LoadingState /></td></tr>
                ) : properties.length === 0 ? (
                  <tr><td colSpan={17}><EmptyState /></td></tr>
                ) : properties.map(p => (
                  <tr key={p.id} className="table-row cursor-pointer" onClick={() => setViewing(p)}>
                    <td className="table-cell text-gray-500">{p.code || '-'}</td>
                    <td className="table-cell">
                      {p.owner_name ? (
                        <div>
                          <p className="font-medium text-gray-800">{p.owner_name}</p>
                          <p className="text-xs text-gray-500"><MaskedPhone phone={p.owner_phone} /></p>
                          {p.contact_status && (
                            <p className="text-xs text-orange-500 mt-0.5">{CONTACT_STATUS_LABELS[p.contact_status] ?? p.contact_status}</p>
                          )}
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Link2 size={12} className="text-blue-400 cursor-pointer shrink-0" />
                        <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => setViewing(p)}>
                          {p.unit_number || p.code || `#${p.id}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.images && p.images.length > 0 && (
                          <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 cursor-pointer shrink-0" onClick={e => { e.stopPropagation(); setImageTarget(p) }} />
                        )}
                        <button className="text-xs text-blue-500 hover:underline flex items-center gap-1 shrink-0" onClick={e => { e.stopPropagation(); setImageTarget(p) }}>
                          {p.images && p.images.length > 0 ? `Có ${p.images.length} ảnh` : <><ImagePlus size={12} /> Thêm ảnh</>}
                        </button>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium">{formatCurrency(p.price)}</p>
                      {!!p.price_per_sqm && <p className="text-xs text-gray-500">{formatCurrency(p.price_per_sqm)}/m²</p>}
                    </td>
                    <td className="table-cell">{p.price_rent ? `${formatCurrency(p.price_rent)}/tháng` : '-'}</td>
                    <td className="table-cell">{p.block || '-'}</td>
                    <td className="table-cell text-gray-500">{p.road || '-'}</td>
                    <td className="table-cell">
                      <Badge
                        label={PROPERTY_STATUS_LABELS[p.status] ?? p.status}
                        color={PROPERTY_STATUS_COLORS[p.status] as never ?? 'gray'}
                        dot
                      />
                    </td>
                    <td className="table-cell">
                      <p>{formatArea(p.area_gross)} / {formatArea(p.area_net)}</p>
                      {!!p.dimensions && <p className="text-xs text-gray-500">{p.dimensions}</p>}
                    </td>
                    <td className="table-cell">{p.property_type || '-'}</td>
                    <td className="table-cell text-gray-500">{STANDARD_OPTIONS.find(o => o.value === p.standard)?.label || p.standard || '-'}</td>
                    <td className="table-cell">{p.direction || '-'}</td>
                    <td className="table-cell">
                      {p.tag ? <Badge label={PROPERTY_TAG_LABELS[p.tag] ?? p.tag} color={p.tag === 'hot' ? 'red' as never : p.tag === 'priority' ? 'yellow' as never : 'gray' as never} /> : '-'}
                    </td>
                    <td className="table-cell text-gray-500 max-w-[180px] truncate" title={p.description}>{p.description || '-'}</td>
                    <td className="table-cell text-gray-500">{formatDate(p.updated_at)}</td>
                    <td className="table-cell text-gray-500">{p.updated_by_name || '-'}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-500 hover:underline" onClick={e => { e.stopPropagation(); handleEdit(p) }}>Sửa</button>
                        <button className="text-xs text-gray-500 hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); setCartTarget(p) }}>
                          <ShoppingCart size={12} /> Thêm vào giỏ
                        </button>
                        {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={e => { e.stopPropagation(); setDeleteId(p.id) }}>Xóa</button>}
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
            <label className="label">Mã tin</label>
            <input className="input" {...register('code')} placeholder="VD: VT47-43" />
          </div>
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
            <label className="label">Tòa / Phân khu</label>
            <input className="input" {...register('block')} placeholder="VD: LD3, A1 hoặc Phân khu The Rainbow" />
          </div>
          <div>
            <label className="label">Đường</label>
            <input className="input" {...register('road')} placeholder="VD: Vĩnh Tiến 1" />
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
            <label className="label">DT tim tường / đất (m²)</label>
            <input className="input" type="number" step="0.1" {...register('area_gross', { valueAsNumber: true })} placeholder="96.5" />
          </div>
          <div>
            <label className="label">DT thông thủy / sàn (m²)</label>
            <input className="input" type="number" step="0.1" {...register('area_net', { valueAsNumber: true })} placeholder="90.3" />
          </div>
          <div>
            <label className="label">Ngang x dài</label>
            <input className="input" {...register('dimensions')} placeholder="VD: 5x20" />
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
            <label className="label">Giá / m² (VNĐ)</label>
            <input className="input" type="number" {...register('price_per_sqm', { valueAsNumber: true })} placeholder="0" />
          </div>
          <div>
            <label className="label">Giá thuê (VNĐ/tháng)</label>
            <input className="input" type="number" {...register('price_rent', { valueAsNumber: true })} placeholder="0" />
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
            <label className="label">Tiêu chuẩn bàn giao (nội thất)</label>
            <select className="input" {...register('standard')}>
              <option value="">-- Chọn tình trạng --</option>
              {STANDARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phân loại</label>
            <select className="input" {...register('tag')}>
              <option value="">-- Không --</option>
              {Object.entries(PROPERTY_TAG_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label className="label">Mô tả</label>
            <textarea className="input" rows={3} {...register('description')} placeholder="Mô tả chi tiết..." />
          </div>

          <div className="form-full border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Thông tin chủ nhà</p>
          </div>
          <div>
            <label className="label">Tên chủ nhà</label>
            <input className="input" {...register('owner_name')} placeholder="VD: Anh Bình" />
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input className="input" {...register('owner_phone')} />
          </div>
          <div>
            <label className="label">SĐT phụ</label>
            <input className="input" {...register('owner_phone_2')} />
          </div>
          <div>
            <label className="label">Trạng thái liên hệ</label>
            <select className="input" {...register('contact_status')}>
              <option value="">-- Chưa liên hệ --</option>
              {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Giá bán chủ nhà yêu cầu (VNĐ)</label>
            <input className="input" type="number" {...register('owner_selling_price', { valueAsNumber: true })} placeholder="0" />
          </div>
          <div>
            <label className="label">Hoa hồng (%)</label>
            <input className="input" type="number" step="0.1" {...register('owner_commission_rate', { valueAsNumber: true })} placeholder="VD: 1" />
          </div>
          <div className="form-full">
            <label className="label">Ghi chú chủ nhà</label>
            <textarea className="input" rows={2} {...register('owner_notes')} placeholder="VD: Chủ cần bán gấp" />
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

      {/* Image Modal */}
      <Modal
        open={!!imageTarget}
        onClose={() => { setImageTarget(null); setLightboxIndex(null) }}
        title={`Ảnh căn ${imageTarget?.unit_number || imageTarget?.code || ''}`}
        size="md"
      >
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(imageTarget?.images ?? []).map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt=""
                className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                onClick={() => setLightboxIndex(i)}
              />
              <button
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => imageTarget && deleteImageMutation.mutate({ id: imageTarget.id, url })}
                disabled={deleteImageMutation.isPending}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {(!imageTarget?.images || imageTarget.images.length === 0) && (
            <p className="col-span-3 text-sm text-gray-400 py-6 text-center">Chưa có ảnh nào</p>
          )}
        </div>
        <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
          <ImagePlus size={14} />
          {uploadImageMutation.isPending ? 'Đang tải lên...' : 'Thêm ảnh'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploadImageMutation.isPending}
            onChange={e => {
              const files = e.target.files
              if (!files || !imageTarget) return
              Array.from(files).forEach(file => uploadImageMutation.mutate({ id: imageTarget.id, file }))
              e.target.value = ''
            }}
          />
        </label>
      </Modal>

      {/* Lightbox - xem ảnh cỡ to */}
      {lightboxIndex !== null && imageTarget?.images && lightboxIndex < imageTarget.images.length && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxIndex(null)}>
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={28} />
          </button>
          {imageTarget.images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => ((i ?? 0) - 1 + imageTarget.images!.length) % imageTarget.images!.length) }}
            >
              <ChevronLeft size={32} />
            </button>
          )}
          <img
            src={imageTarget.images[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {imageTarget.images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => ((i ?? 0) + 1) % imageTarget.images!.length) }}
            >
              <ChevronRight size={32} />
            </button>
          )}
          {imageTarget.images.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {lightboxIndex + 1} / {imageTarget.images.length}
            </p>
          )}
        </div>
      )}

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
              <div><p className="text-gray-400 text-xs">Mã tin</p><p className="font-medium">{viewing.code || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Tiêu đề</p><p className="font-medium">{viewing.title}</p></div>
              <div><p className="text-gray-400 text-xs">Dự án</p><p className="font-medium">{viewing.project_name || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Tòa/Phân khu / Tầng</p><p className="font-medium">{viewing.block || '--'} / {viewing.floor || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Đường</p><p className="font-medium">{viewing.road || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Loại căn</p><p className="font-medium">{viewing.property_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">DT tim tường/đất / thông thủy/sàn</p><p className="font-medium">{formatArea(viewing.area_gross)} / {formatArea(viewing.area_net)}</p></div>
              <div><p className="text-gray-400 text-xs">Ngang x dài</p><p className="font-medium">{viewing.dimensions || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">PN / Toilet</p><p className="font-medium">{viewing.bedrooms || '--'} / {viewing.bathrooms || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Hướng cửa / ban công</p><p className="font-medium">{viewing.direction || '--'} / {viewing.balcony_direction || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">View</p><p className="font-medium">{viewing.view_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Giá bán / Giá m²</p><p className="font-medium">{formatCurrency(viewing.price)} / {formatCurrency(viewing.price_per_sqm)}</p></div>
              <div><p className="text-gray-400 text-xs">Giá thuê</p><p className="font-medium">{viewing.price_rent ? `${formatCurrency(viewing.price_rent)}/tháng` : '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Trạng thái</p><Badge label={PROPERTY_STATUS_LABELS[viewing.status] ?? viewing.status} color={PROPERTY_STATUS_COLORS[viewing.status] as never ?? 'gray'} dot /></div>
              {viewing.tag && <div><p className="text-gray-400 text-xs">Phân loại</p><Badge label={PROPERTY_TAG_LABELS[viewing.tag] ?? viewing.tag} color={viewing.tag === 'hot' ? 'red' as never : viewing.tag === 'priority' ? 'yellow' as never : 'gray' as never} /></div>}
              <div><p className="text-gray-400 text-xs">Cập nhật lần cuối</p><p className="font-medium">{viewing.updated_by_name || '--'} · {formatDate(viewing.updated_at)}</p></div>
            </div>
            {viewing.description && (
              <div className="mb-5">
                <p className="text-gray-400 text-xs mb-1">Mô tả</p>
                <p className="text-sm text-gray-700">{viewing.description}</p>
              </div>
            )}

            {viewing.owner_name && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Thông tin chủ nhà</p>
                <div className="grid grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3">
                  <div><p className="text-gray-400 text-xs">Tên chủ nhà</p><p className="font-medium">{viewing.owner_name}</p></div>
                  <div><p className="text-gray-400 text-xs">SĐT / SĐT phụ</p><p className="font-medium flex items-center gap-2"><MaskedPhone phone={viewing.owner_phone} /> / <MaskedPhone phone={viewing.owner_phone_2} /></p></div>
                  <div><p className="text-gray-400 text-xs">Trạng thái liên hệ</p><p className="font-medium">{CONTACT_STATUS_LABELS[viewing.contact_status] ?? viewing.contact_status ?? '--'}</p></div>
                  <div><p className="text-gray-400 text-xs">Giá chủ nhà yêu cầu</p><p className="font-medium">{viewing.owner_selling_price ? formatCurrency(viewing.owner_selling_price) : '--'}</p></div>
                  <div><p className="text-gray-400 text-xs">Hoa hồng</p><p className="font-medium">{viewing.owner_commission_rate ? `${viewing.owner_commission_rate}%` : '--'}</p></div>
                  {viewing.owner_notes && <div className="col-span-3"><p className="text-gray-400 text-xs">Ghi chú</p><p className="font-medium">{viewing.owner_notes}</p></div>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
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

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cùng chủ nhà{viewing.owner_name ? ` (${viewing.owner_name})` : ''}</p>
                {sameOwnerProperties.length === 0 ? (
                  <EmptyState message="Chủ nhà này chưa có căn nào khác" />
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {sameOwnerProperties.map(sp => (
                      <div key={sp.id} className="flex items-center justify-between px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{sp.unit_number || sp.code} - {sp.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500">{sp.project_name || sp.block || '--'}</span>
                            <Badge label={PROPERTY_STATUS_LABELS[sp.status] ?? sp.status} color={PROPERTY_STATUS_COLORS[sp.status] as never ?? 'gray'} dot />
                          </div>
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
