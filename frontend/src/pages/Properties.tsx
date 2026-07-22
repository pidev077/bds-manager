import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, ChevronLeft, Link2, ShoppingCart, ImagePlus, X, SlidersHorizontal, Crown } from 'lucide-react'
import { propertiesApi, customersApi, cartApi, projectsApi, parseError, getMergeableProperty } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatArea, formatCurrency, formatDate, formatTime } from '@/lib/utils'
import type { Property, Customer, Project } from '@/types'
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_COLORS, CONTACT_STATUS_LABELS, PROPERTY_TAG_LABELS, STANDARD_OPTIONS, LISTING_TYPE_LABELS, LEGAL_STATUS_LABELS, getPropertyStatusLabel, COMMISSION_TYPE_LABELS, formatCommission, PROPERTY_TYPE_OPTIONS, DIRECTION_OPTIONS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Drawer from '@/components/ui/Drawer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import MaskedPhone from '@/components/ui/MaskedPhone'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const PROPERTY_TYPES = PROPERTY_TYPE_OPTIONS

const DIRECTIONS = DIRECTION_OPTIONS

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

// Các tiêu chí "lọc sâu" chưa có ô lọc riêng ở đầu trang — gom vào sidebar Bộ lọc nâng cao,
// mỗi tiêu chí cho check nhiều giá trị cùng lúc (VD: tick cả "Liền kề" và "Biệt thự").
type AdvFilterField = 'project_name' | 'standard' | 'tag' | 'contact_status' | 'direction' | 'balcony_direction' | 'bedrooms' | 'bathrooms'

const EMPTY_ADV_FILTERS: Record<AdvFilterField, string[]> = {
  project_name: [], standard: [], tag: [], contact_status: [], direction: [], balcony_direction: [], bedrooms: [], bathrooms: [],
}

const ROOM_COUNT_OPTIONS = ['1', '2', '3', '4', '5']

type FormData = {
  title: string; project_name: string; block: string; zone: string; floor: string
  unit_number: string; area_gross: number; area_net: number; bedrooms: number
  bathrooms: number; direction: string; balcony_direction: string; view_type: string; price: number
  price_per_sqm: number; price_rent: number; road: string; dim_width: number; dim_length: number; tag: string
  listing_type: string; property_type: string; fund_type: string; status: string; standard: string; description: string
  legal_status: string
  commission_sale_type: string; commission_sale_value: number; commission_rent_type: string; commission_rent_value: number
  owner_name: string; owner_phone: string; owner_phone_2: string; owner_email: string; contact_status: string
  owner_notes: string
  web_description: string; sale_contact: string; video_url: string
}

// "Ngang x dài" lưu trong DB dưới dạng 1 chuỗi (cột dimensions hiện có) nhưng form nhập 2 ô số riêng
// theo đúng layout yêu cầu — ghép/tách chuỗi ngay tại đây, không cần đổi schema.
const parseDimensions = (dimensions: string | undefined): { dim_width?: number; dim_length?: number } => {
  const [w, l] = (dimensions || '').split(/x/i).map(s => parseFloat(s.trim()))
  return { dim_width: Number.isFinite(w) ? w : undefined, dim_length: Number.isFinite(l) ? l : undefined }
}

const buildDimensions = (dim_width?: number, dim_length?: number): string =>
  (dim_width || dim_length) ? `${dim_width ?? ''}x${dim_length ?? ''}` : ''

// Ảnh chọn trước khi căn được lưu (chưa có id để upload thật) — giữ kèm object URL để preview,
// nhớ revokeObjectURL khi bỏ chọn/đóng form để khỏi rò rỉ bộ nhớ.
type StagedImage = { file: File; url: string }

export default function Properties() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterListingType, setFilterListingType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFundType, setFilterFundType] = useState('')
  const [filterCreatedToday, setFilterCreatedToday] = useState(false)
  const [filterPriceRange, setFilterPriceRange] = useState<number | null>(null)
  const [filterAreaRange, setFilterAreaRange] = useState<number | null>(null)
  const [filterView, setFilterView] = useState('')
  const [filterOwnerPhone, setFilterOwnerPhone] = useState('')
  const [filterContactStatus, setFilterContactStatus] = useState('')
  const [typeTab, setTypeTab] = useState('all')
  const [openAdvFilter, setOpenAdvFilter] = useState(false)
  const [advFilters, setAdvFilters] = useState<Record<AdvFilterField, string[]>>(EMPTY_ADV_FILTERS)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [cartTarget, setCartTarget] = useState<Property | null>(null)
  const [cartCustomerId, setCartCustomerId] = useState<number>(0)
  const [viewing, setViewing] = useState<Property | null>(null)
  const [imageTarget, setImageTarget] = useState<Property | null>(null)
  const [imageTab, setImageTab] = useState<'property' | 'document'>('property')
  // Căn chưa lưu thì chưa có id để upload — giữ file tạm ở đây (kèm object URL để preview), chờ tạo
  // xong mới đẩy lên thật (xem uploadPendingImages/saveMutation).
  const [pendingPropertyImages, setPendingPropertyImages] = useState<StagedImage[]>([])
  const [pendingDocumentImages, setPendingDocumentImages] = useState<StagedImage[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = !!currentUser?.is_admin
  // Nhân viên bị giới hạn phân khúc thì ẩn luôn tab của phân khúc mình không phụ trách (backend cũng
  // đã tự lọc, ẩn tab ở đây chỉ để đỡ rối mắt — không phải lớp bảo mật).
  const canSeeSaleTab = isAdmin || !!currentUser?.is_manager || !currentUser?.segment || currentUser.segment !== 'rent'
  const canSeeRentTab = isAdmin || !!currentUser?.is_manager || !currentUser?.segment || currentUser.segment !== 'sale'
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
    mutationFn: ({ id, file, type }: { id: number; file: File; type: 'property' | 'document' }) => {
      const fd = new FormData()
      fd.append('file', file)
      return propertiesApi.uploadImage(id, fd, type)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      setImageTarget(res.data)
      // Ảnh quản lý ngay trong form sửa (không qua modal riêng) cũng phải thấy ảnh mới ngay,
      // không đợi đóng form mở lại.
      setEditing(prev => (prev && prev.id === res.data.id ? res.data : prev))
    },
    onError: () => toast.error('Tải ảnh lên thất bại!'),
  })

  const deleteImageMutation = useMutation({
    mutationFn: ({ id, url, type }: { id: number; url: string; type: 'property' | 'document' }) => propertiesApi.deleteImage(id, url, type),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      setImageTarget(res.data)
      setEditing(prev => (prev && prev.id === res.data.id ? res.data : prev))
    },
    onError: () => toast.error('Xóa ảnh thất bại!'),
  })

  const priceRange = filterPriceRange !== null ? PRICE_RANGES[filterPriceRange] : undefined
  const areaRange = filterAreaRange !== null ? AREA_RANGES[filterAreaRange] : undefined

  const toggleAdvFilter = (field: AdvFilterField, value: string) => {
    setAdvFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value],
    }))
    setPage(1)
  }
  const resetAdvFilters = () => { setAdvFilters(EMPTY_ADV_FILTERS); setPage(1) }
  const advFilterCount = Object.values(advFilters).reduce((sum, arr) => sum + arr.length, 0)

  const renderAdvFilterSection = (title: string, field: AdvFilterField, options: { value: string; label: string }[]) => (
    <div className="filter-section">
      <p className="filter-section-title">{title}</p>
      {options.map(o => (
        <label key={o.value} className="filter-checkbox">
          <input type="checkbox" checked={advFilters[field].includes(o.value)} onChange={() => toggleAdvFilter(field, o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  )

  // Dự án / Trạng thái liên hệ đã có ô lọc nhanh riêng (1 giá trị) — sidebar nâng cao chỉ bổ sung thêm
  // lựa chọn, gộp chung danh sách với ô lọc nhanh rồi lọc theo IN (...) chứ không thay thế nhau.
  const projectNameFilters = Array.from(new Set([filterProject, ...advFilters.project_name].filter(Boolean)))
  const contactStatusFilters = Array.from(new Set([filterContactStatus, ...advFilters.contact_status].filter(Boolean)))

  const params = {
    page, per_page: 20, search: search || undefined,
    project_name: projectNameFilters.length ? projectNameFilters.join(',') : undefined,
    listing_type: filterListingType || undefined,
    property_type: typeTab !== 'all' ? typeTab : undefined,
    status: filterStatus || undefined,
    fund_type: filterFundType || undefined,
    created_today: filterCreatedToday || undefined,
    view_type: filterView || undefined,
    price_min: priceRange?.min, price_max: priceRange?.max,
    area_min: areaRange?.min, area_max: areaRange?.max,
    owner_phone: filterOwnerPhone || undefined,
    contact_status: contactStatusFilters.length ? contactStatusFilters.join(',') : undefined,
    standard: advFilters.standard.join(',') || undefined,
    tag: advFilters.tag.join(',') || undefined,
    direction: advFilters.direction.join(',') || undefined,
    balcony_direction: advFilters.balcony_direction.join(',') || undefined,
    bedrooms: advFilters.bedrooms.join(',') || undefined,
    bathrooms: advFilters.bathrooms.join(',') || undefined,
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

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>()
  const formListingType = watch('listing_type')
  const formUnitNumber = watch('unit_number')
  const commissionSaleType = watch('commission_sale_type')
  const commissionRentType = watch('commission_rent_type')

  // Mã căn phải là duy nhất trong cùng loại hình (bán/cho thuê) — kiểm tra ngay khi nhập để
  // báo trùng sớm, tránh người nhập sau lưu đè lên căn đã có.
  const [unitNumberDupMsg, setUnitNumberDupMsg] = useState<string | null>(null)
  // Mã căn trùng nhưng khác loại hình (1 bên bán, 1 bên cho thuê) không phải lỗi — đây là cùng 1 căn,
  // chỉ báo trước để nhân viên biết lưu sẽ tự gộp thành "Bán và cho thuê" (xem saveMutation.onError).
  const [unitNumberMergeMsg, setUnitNumberMergeMsg] = useState<string | null>(null)
  useEffect(() => {
    const unitNumber = (formUnitNumber || '').trim()
    if (!openForm || !unitNumber) { setUnitNumberDupMsg(null); setUnitNumberMergeMsg(null); return }
    const timer = setTimeout(() => {
      propertiesApi.checkUnitNumber({ unit_number: unitNumber, listing_type: formListingType || 'sale', exclude_id: editing?.id })
        .then(res => {
          setUnitNumberDupMsg(res.data?.duplicate ? res.data.message : null)
          setUnitNumberMergeMsg(!res.data?.duplicate && res.data?.mergeable ? res.data.message : null)
        })
        .catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [formUnitNumber, formListingType, openForm, editing])

  const buildEditFormValues = (p: Property) => ({
    ...p, ...parseDimensions(p.dimensions), area_gross: p.area_gross, area_net: p.area_net, price: p.price, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
    owner_name: p.owner_name, owner_phone: p.owner_phone, owner_phone_2: p.owner_phone_2, owner_email: p.owner_email, contact_status: p.contact_status,
    owner_notes: p.owner_notes,
  })

  // "dim_width"/"dim_length" chỉ tồn tại trên form (UX tách Ngang/Dài) — ghép lại thành 1 chuỗi
  // "dimensions" đúng cột DB hiện có trước khi gửi API, không đổi schema.
  const buildSavePayload = (d: FormData) => {
    const { dim_width, dim_length, ...rest } = d
    return { ...rest, dimensions: buildDimensions(dim_width, dim_length) }
  }

  // `files` là FileList SỐNG gắn với DOM input — onChange bên dưới có reset e.target.value='' ngay sau
  // khi gọi hàm này để cho phép chọn lại, việc đó xoá luôn FileList gốc. Phải đọc file ra mảng thường
  // NGAY tại đây (đồng bộ) trước khi setState — nếu để Array.from(files) chạy bên trong updater của
  // setState (bị React hoãn tới lúc render) thì lúc đó FileList đã rỗng, ảnh chọn sau ảnh đầu sẽ mất.
  const addPendingImages = (setter: typeof setPendingPropertyImages, files: FileList) => {
    const staged = Array.from(files).map(file => ({ file, url: URL.createObjectURL(file) }))
    setter(prev => [...prev, ...staged])
  }
  const removePendingImage = (setter: typeof setPendingPropertyImages, index: number) => {
    setter(prev => {
      URL.revokeObjectURL(prev[index].url)
      return prev.filter((_, i) => i !== index)
    })
  }
  const clearPendingImages = () => {
    pendingPropertyImages.forEach(f => URL.revokeObjectURL(f.url))
    pendingDocumentImages.forEach(f => URL.revokeObjectURL(f.url))
    setPendingPropertyImages([]); setPendingDocumentImages([])
  }
  // Chỉ chạy được sau khi đã có id (căn vừa tạo xong, hoặc đã gộp vào căn có sẵn) — upload tuần tự
  // từng ảnh đã chọn tạm trước đó.
  const uploadPendingImages = async (id: number) => {
    for (const { file } of pendingPropertyImages) {
      const fd = new FormData(); fd.append('file', file)
      await propertiesApi.uploadImage(id, fd, 'property')
    }
    for (const { file } of pendingDocumentImages) {
      const fd = new FormData(); fd.append('file', file)
      await propertiesApi.uploadImage(id, fd, 'document')
    }
  }

  // Đang sửa căn có sẵn (đã có id) → upload/xoá thật ngay. Đang tạo căn mới (chưa có id) → chỉ giữ
  // tạm ở state, đẩy lên thật sau khi tạo xong (xem saveMutation).
  const renderInlineImages = (
    label: string, type: 'property' | 'document',
    existing: string[] | null | undefined, pending: StagedImage[], setPending: typeof setPendingPropertyImages
  ) => (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {editing && (existing ?? []).map(url => (
          <div key={url} className="relative group">
            <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 text-red-500 border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => editing && deleteImageMutation.mutate({ id: editing.id, url, type })}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {!editing && pending.map((img, i) => (
          <div key={img.url} className="relative group">
            <img src={img.url} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 text-red-500 border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removePendingImage(setPending, i)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {(editing ? (existing ?? []).length === 0 : pending.length === 0) && (
          <p className="text-xs text-gray-400 py-2">Chưa có ảnh</p>
        )}
      </div>
      <label className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer text-xs px-2.5 py-1.5">
        <ImagePlus size={12} /> Thêm ảnh
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const files = e.target.files
            if (!files || files.length === 0) return
            if (editing) {
              Array.from(files).forEach(file => uploadImageMutation.mutate({ id: editing.id, file, type }))
            } else {
              addPendingImages(setPending, files)
            }
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )

  const saveMutation = useMutation({
    mutationFn: async (d: FormData) => {
      const payload = buildSavePayload(d)
      if (editing) return propertiesApi.update(editing.id, payload)
      // Căn mới: tạo xong mới có id để đẩy ảnh đã chọn tạm (Ảnh BĐS + Ảnh giấy tờ) lên.
      const created = await propertiesApi.create(payload)
      await uploadPendingImages(created.data.id)
      return created
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['properties'] })
      setOpenForm(false); setEditing(null); reset(); setUnitNumberDupMsg(null); setUnitNumberMergeMsg(null)
      setPendingPropertyImages([]); setPendingDocumentImages([])
    },
    onError: (err, variables) => {
      const mergeProperty = getMergeableProperty(err) as Property | null
      if (mergeProperty) {
        toast('Mã căn đã tồn tại ở loại hình khác — đã mở căn đó, kiểm tra rồi bấm Lưu để gộp thành "Bán và cho thuê".', { icon: 'ℹ️', duration: 5000 })
        setEditing(mergeProperty)
        reset({
          ...buildEditFormValues(mergeProperty),
          listing_type: 'both',
          price: mergeProperty.listing_type === 'sale' ? mergeProperty.price : variables.price,
          price_per_sqm: mergeProperty.listing_type === 'sale' ? mergeProperty.price_per_sqm : variables.price_per_sqm,
          commission_sale_type: mergeProperty.listing_type === 'sale' ? mergeProperty.commission_sale_type : variables.commission_sale_type,
          commission_sale_value: mergeProperty.listing_type === 'sale' ? mergeProperty.commission_sale_value : variables.commission_sale_value,
          price_rent: mergeProperty.listing_type === 'rent' ? mergeProperty.price_rent : variables.price_rent,
          commission_rent_type: mergeProperty.listing_type === 'rent' ? mergeProperty.commission_rent_type : variables.commission_rent_type,
          commission_rent_value: mergeProperty.listing_type === 'rent' ? mergeProperty.commission_rent_value : variables.commission_rent_value,
        })
        setUnitNumberDupMsg(null); setUnitNumberMergeMsg(null)
        // Ảnh đã chọn tạm trước khi bị chặn trùng vẫn cần lên đúng căn vừa gộp, không mất trắng.
        if (pendingPropertyImages.length || pendingDocumentImages.length) {
          uploadPendingImages(mergeProperty.id)
            .then(() => { qc.invalidateQueries({ queryKey: ['properties'] }); setPendingPropertyImages([]); setPendingDocumentImages([]) })
            .catch(() => toast.error('Tải ảnh đã chọn lên căn gộp thất bại, vui lòng thêm lại.'))
        }
        return
      }
      toast.error(parseError(err).message || 'Có lỗi xảy ra!')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => propertiesApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['properties'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (p: Property) => {
    setEditing(p)
    reset(buildEditFormValues(p))
    setUnitNumberDupMsg(null); setUnitNumberMergeMsg(null); clearPendingImages()
    setOpenForm(true)
  }

  const handleAdd = () => { setEditing(null); reset({ fund_type: 'F0', status: 'available', listing_type: 'sale', commission_sale_type: 'percent', commission_rent_type: 'percent', bedrooms: 0, bathrooms: 0 }); setUnitNumberDupMsg(null); setUnitNumberMergeMsg(null); clearPendingImages(); setOpenForm(true) }

  const handleCloseForm = () => { setOpenForm(false); setEditing(null); clearPendingImages() }

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

  // Ảnh BĐS và ảnh giấy tờ/sổ dùng chung 1 modal xem ảnh, chuyển qua lại bằng tab imageTab.
  const activeGalleryImages = imageTab === 'document' ? imageTarget?.documents_images : imageTarget?.images

  // Điều hướng bàn phím cho popup xem ảnh to (lightbox)
  useEffect(() => {
    const images = activeGalleryImages
    if (lightboxIndex === null || !images || images.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => ((i ?? 0) - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setLightboxIndex(i => ((i ?? 0) + 1) % images.length)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxIndex, activeGalleryImages])

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

        {/* Bán / Cho thuê */}
        <div className="tab-nav overflow-x-auto flex-nowrap scrollbar-none">
          <button className={`tab-item shrink-0 ${filterListingType === '' ? 'active' : ''}`} onClick={() => { setFilterListingType(''); setPage(1) }}>
            Tất cả
          </button>
          {canSeeSaleTab && (
            <button className={`tab-item shrink-0 ${filterListingType === 'sale' ? 'active' : ''}`} onClick={() => { setFilterListingType('sale'); setPage(1) }}>
              Bán
            </button>
          )}
          {canSeeRentTab && (
            <button className={`tab-item shrink-0 ${filterListingType === 'rent' ? 'active' : ''}`} onClick={() => { setFilterListingType('rent'); setPage(1) }}>
              Cho thuê
            </button>
          )}
          <button className={`tab-item shrink-0 ${filterListingType === 'both' ? 'active' : ''}`} onClick={() => { setFilterListingType('both'); setPage(1) }}>
            Bán và cho thuê
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
          <button
            className={`btn-secondary ml-auto ${advFilterCount > 0 ? '!border-brand !text-brand' : ''}`}
            onClick={() => setOpenAdvFilter(true)}
          >
            <SlidersHorizontal size={14} /> Bộ lọc nâng cao
            {advFilterCount > 0 && <span className="badge-blue ml-1">{advFilterCount}</span>}
          </button>
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
                  {['Mã tin', 'Chủ nhà', 'Mã căn', 'Giá bán', 'Giá thuê', 'Tòa', 'Phân khu', 'Đường', 'Trạng thái', 'Diện tích', 'Loại BĐS', 'Nội thất', 'Hướng cửa', 'Phân loại', 'Mô tả', 'Thời gian', 'NV cập nhật', 'Thao tác'].map(h => (
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
                  <tr key={p.id} className={`table-row cursor-pointer ${p.tag === 'exclusive' ? 'bg-red-50/60' : ''}`} onClick={() => setViewing(p)}>
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
                        {p.tag === 'exclusive' && (
                          <span className="inline-flex items-center gap-0.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" title="Độc quyền">
                            <Crown size={10} className="fill-yellow-300 text-yellow-300" /> ĐỘC QUYỀN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.images && p.images.length > 0 && (
                          <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 cursor-pointer shrink-0" onClick={e => { e.stopPropagation(); setImageTab('property'); setImageTarget(p) }} />
                        )}
                        <button className="text-xs text-blue-500 hover:underline flex items-center gap-1 shrink-0" onClick={e => { e.stopPropagation(); setImageTab('property'); setImageTarget(p) }}>
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
                    <td className="table-cell">{p.zone || '-'}</td>
                    <td className="table-cell text-gray-500">{p.road || '-'}</td>
                    <td className="table-cell">
                      <Badge
                        label={getPropertyStatusLabel(p.status, p.listing_type)}
                        color={PROPERTY_STATUS_COLORS[p.status] as never ?? 'gray'}
                        dot
                      />
                    </td>
                    <td className="table-cell text-center">
                      <p>{p.dimensions || '--'}</p>
                      <p className="text-xs text-gray-500">{formatArea(p.area_gross)} / {formatArea(p.area_net)}</p>
                    </td>
                    <td className="table-cell">{p.property_type || '-'}</td>
                    <td className="table-cell text-gray-500">{STANDARD_OPTIONS.find(o => o.value === p.standard)?.label || p.standard || '-'}</td>
                    <td className="table-cell">{p.direction || '-'}</td>
                    <td className="table-cell">
                      {p.tag ? <Badge label={PROPERTY_TAG_LABELS[p.tag] ?? p.tag} color={p.tag === 'exclusive' ? 'red' as never : 'gray' as never} /> : '-'}
                    </td>
                    <td className="table-cell text-gray-500 max-w-[180px] truncate" title={p.description}>{p.description || '-'}</td>
                    <td className="table-cell text-gray-500">
                      <p>{formatDate(p.updated_at)}</p>
                      <p className="text-xs text-gray-400">{formatTime(p.updated_at)}</p>
                    </td>
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

      {/* Advanced filter sidebar */}
      <Drawer
        open={openAdvFilter}
        onClose={() => setOpenAdvFilter(false)}
        title="Bộ lọc nâng cao"
        footer={
          <>
            <button className="btn-secondary" onClick={resetAdvFilters} disabled={advFilterCount === 0}>Xóa tất cả</button>
            <button className="btn-primary" onClick={() => setOpenAdvFilter(false)}>Xong</button>
          </>
        }
      >
        {renderAdvFilterSection('Dự án', 'project_name', projects.map(p => ({ value: p.name, label: p.name })))}
        {renderAdvFilterSection('Nội thất', 'standard', STANDARD_OPTIONS)}
        {renderAdvFilterSection('Phân loại', 'tag', Object.entries(PROPERTY_TAG_LABELS).map(([value, label]) => ({ value, label })))}
        {renderAdvFilterSection('Trạng thái liên hệ', 'contact_status', Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => ({ value, label })))}
        {renderAdvFilterSection('Hướng cửa', 'direction', DIRECTIONS.map(d => ({ value: d, label: d })))}
        {renderAdvFilterSection('Hướng ban công', 'balcony_direction', DIRECTIONS.map(d => ({ value: d, label: d })))}
        {renderAdvFilterSection('Số phòng ngủ', 'bedrooms', ROOM_COUNT_OPTIONS.map(n => ({ value: n, label: `${n} PN` })))}
        {renderAdvFilterSection('Số toilet', 'bathrooms', ROOM_COUNT_OPTIONS.map(n => ({ value: n, label: `${n} toilet` })))}
      </Drawer>

      {/* Form Modal */}
      <Modal
        open={openForm}
        onClose={handleCloseForm}
        title={editing ? 'Cập nhật nhà bán' : 'Thêm mới nhà bán'}
        size="2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={handleCloseForm}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit(d => saveMutation.mutate(d))} disabled={saveMutation.isPending || !!unitNumberDupMsg}>
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form className="form-grid-compact" onSubmit={e => e.preventDefault()}>
          <div className="form-full-compact form-section-header">Thông tin chung</div>
          <div>
            <label className="label">Mã tin</label>
            <input className="input bg-gray-50 text-gray-500" value={editing?.code || 'Tự động cấp sau khi lưu'} disabled readOnly />
          </div>
          <div>
            <label className="label">Loại tin</label>
            <select className="input" {...register('listing_type')}>
              {Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Loại BĐS</label>
            <select className="input" {...register('property_type')}>
              <option value="">-- Chọn loại --</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dự án</label>
            <select className="input" {...register('project_name')}>
              <option value="">-- Chọn dự án --</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mã căn</label>
            <input className={`input ${unitNumberDupMsg ? 'border-red-500' : ''}`} {...register('unit_number')} placeholder="VD: LD31107" />
            {unitNumberDupMsg && <p className="text-red-500 text-xs mt-1">{unitNumberDupMsg}</p>}
            {unitNumberMergeMsg && <p className="text-blue-500 text-xs mt-1">{unitNumberMergeMsg}</p>}
          </div>
          <div>
            <label className="label">Tiêu đề <span className="text-red-500">*</span></label>
            <input className="input" {...register('title', { required: true })} placeholder="Tên căn hộ" />
            {errors.title && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          <div>
            <label className="label">Phân khu</label>
            <input className="input" {...register('zone')} placeholder="VD: Phân khu The Rainbow" />
          </div>
          <div>
            <label className="label">Tòa</label>
            <input className="input" {...register('block')} placeholder="VD: LD3, A1" />
          </div>
          <div>
            <label className="label">Đường</label>
            <input className="input" {...register('road')} placeholder="VD: Vĩnh Tiến 1" />
          </div>
          <div>
            <label className="label">Tầng</label>
            <input className="input" {...register('floor')} placeholder="VD: 11" />
          </div>

          <div className="form-full-compact form-section-header">Thông số - Diện tích</div>
          <div>
            <label className="label">Ngang (m)</label>
            <input className="input" type="number" step="0.1" {...register('dim_width', { valueAsNumber: true })} placeholder="5" />
          </div>
          <div>
            <label className="label">Dài (m)</label>
            <input className="input" type="number" step="0.1" {...register('dim_length', { valueAsNumber: true })} placeholder="20" />
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
            <label className="label">Nội thất</label>
            <select className="input" {...register('standard')}>
              <option value="">-- Chọn tình trạng --</option>
              {STANDARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">View</label>
            <select className="input" {...register('view_type')}>
              <option value="">-- Chọn view --</option>
              {VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="form-full-compact form-section-header">Tài chính - Pháp lý</div>
          {formListingType !== 'rent' && (
            <>
              <div>
                <label className="label">Giá bán (VNĐ)</label>
                <input className="input" type="number" {...register('price', { valueAsNumber: true })} placeholder="0" />
              </div>
              <div>
                <label className="label">Giá / m² (VNĐ)</label>
                <input className="input" type="number" {...register('price_per_sqm', { valueAsNumber: true })} placeholder="0" />
              </div>
            </>
          )}
          {formListingType !== 'sale' && (
            <div>
              <label className="label">Giá thuê (VNĐ/tháng)</label>
              <input className="input" type="number" {...register('price_rent', { valueAsNumber: true })} placeholder="0" />
            </div>
          )}
          {formListingType !== 'rent' && (
            <>
              <div>
                <label className="label">Loại hoa hồng bán</label>
                <select className="input" {...register('commission_sale_type')}>
                  {Object.entries(COMMISSION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hoa hồng bán {commissionSaleType === 'fixed' ? '(VNĐ)' : '(%)'}</label>
                <input className="input" type="number" step={commissionSaleType === 'fixed' ? 1000 : 0.1} {...register('commission_sale_value', { valueAsNumber: true })} placeholder="0" />
              </div>
            </>
          )}
          {formListingType !== 'sale' && (
            <>
              <div>
                <label className="label">Loại hoa hồng cho thuê</label>
                <select className="input" {...register('commission_rent_type')}>
                  {Object.entries(COMMISSION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hoa hồng cho thuê {commissionRentType === 'fixed' ? '(VNĐ)' : '(%)'}</label>
                <input className="input" type="number" step={commissionRentType === 'fixed' ? 1000 : 0.1} {...register('commission_rent_value', { valueAsNumber: true })} placeholder="0" />
              </div>
            </>
          )}
          <div>
            <label className="label">Pháp lý</label>
            <select className="input" {...register('legal_status')}>
              <option value="">-- Chọn pháp lý --</option>
              {Object.entries(LEGAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phân loại</label>
            <select className="input" {...register('tag')}>
              <option value="">-- Không --</option>
              {Object.entries(PROPERTY_TAG_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trạng thái BĐS</label>
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

          <div className="form-full-compact form-section-header">Mô tả</div>
          <div className="form-full-compact">
            <textarea className="input" rows={3} {...register('description')} placeholder="Mô tả chi tiết..." />
          </div>

          <div className="form-full-compact form-section-header">Hình ảnh / Video</div>
          <div className="form-full-compact grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderInlineImages('Ảnh BĐS', 'property', editing?.images, pendingPropertyImages, setPendingPropertyImages)}
            {renderInlineImages('Ảnh giấy tờ / Sổ', 'document', editing?.documents_images, pendingDocumentImages, setPendingDocumentImages)}
          </div>

          <div className="form-full-compact form-section-header">Thông tin chủ nhà</div>
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
            <label className="label">Email</label>
            <input className="input" type="email" {...register('owner_email')} placeholder="VD: chunha@email.com" />
          </div>
          <div>
            <label className="label">Trạng thái liên hệ</label>
            <select className="input" {...register('contact_status')}>
              <option value="">-- Chưa liên hệ --</option>
              {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-full-compact">
            <label className="label">Ghi chú chủ nhà</label>
            <textarea className="input" rows={2} {...register('owner_notes')} placeholder="VD: Chủ cần bán gấp" />
          </div>

          <div className="form-full-compact form-section-header">Giao diện đăng lên web</div>
          <div>
            <label className="label">SĐT / Tên sale</label>
            <input className="input" {...register('sale_contact')} placeholder="VD: 0909xxxxxx - Anh Tuấn" />
          </div>
          <div className="form-full-compact">
            <label className="label">Mô tả / Nội dung tin đăng</label>
            <textarea className="input" rows={3} {...register('web_description')} placeholder="Nội dung tin đăng lên web..." />
          </div>
          <div className="form-full-compact">
            <label className="label">Video / Link video Youtube, Tiktok...</label>
            <input className="input" {...register('video_url')} placeholder="https://..." />
          </div>
          <p className="form-full-compact text-xs text-gray-400 -mt-2">Hình ảnh đăng web dùng chung với Ảnh BĐS ở mục Hình ảnh/Video phía trên.</p>
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
        <div className="tab-nav mb-3">
          <button className={`tab-item ${imageTab === 'property' ? 'active' : ''}`} onClick={() => { setImageTab('property'); setLightboxIndex(null) }}>
            Ảnh BĐS ({imageTarget?.images?.length ?? 0})
          </button>
          <button className={`tab-item ${imageTab === 'document' ? 'active' : ''}`} onClick={() => { setImageTab('document'); setLightboxIndex(null) }}>
            Ảnh giấy tờ / Sổ ({imageTarget?.documents_images?.length ?? 0})
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(activeGalleryImages ?? []).map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt=""
                className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                onClick={() => setLightboxIndex(i)}
              />
              <button
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => imageTarget && deleteImageMutation.mutate({ id: imageTarget.id, url, type: imageTab })}
                disabled={deleteImageMutation.isPending}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {(!activeGalleryImages || activeGalleryImages.length === 0) && (
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
              Array.from(files).forEach(file => uploadImageMutation.mutate({ id: imageTarget.id, file, type: imageTab }))
              e.target.value = ''
            }}
          />
        </label>
      </Modal>

      {/* Lightbox - xem ảnh cỡ to */}
      {lightboxIndex !== null && activeGalleryImages && lightboxIndex < activeGalleryImages.length && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxIndex(null)}>
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={28} />
          </button>
          {activeGalleryImages.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => ((i ?? 0) - 1 + activeGalleryImages!.length) % activeGalleryImages!.length) }}
            >
              <ChevronLeft size={32} />
            </button>
          )}
          <img
            src={activeGalleryImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {activeGalleryImages.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => ((i ?? 0) + 1) % activeGalleryImages!.length) }}
            >
              <ChevronRight size={32} />
            </button>
          )}
          {activeGalleryImages.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {lightboxIndex + 1} / {activeGalleryImages.length}
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
              <div><p className="text-gray-400 text-xs">Tòa / Tầng</p><p className="font-medium">{viewing.block || '--'} / {viewing.floor || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Phân khu</p><p className="font-medium">{viewing.zone || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Đường</p><p className="font-medium">{viewing.road || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Loại căn</p><p className="font-medium">{viewing.property_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Ngang x dài</p><p className="font-medium">{viewing.dimensions || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">DT tim tường/đất / thông thủy/sàn</p><p className="font-medium">{formatArea(viewing.area_gross)} / {formatArea(viewing.area_net)}</p></div>
              <div><p className="text-gray-400 text-xs">PN / Toilet</p><p className="font-medium">{viewing.bedrooms || '--'} / {viewing.bathrooms || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Hướng cửa / ban công</p><p className="font-medium">{viewing.direction || '--'} / {viewing.balcony_direction || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">View</p><p className="font-medium">{viewing.view_type || '--'}</p></div>
              <div><p className="text-gray-400 text-xs">Giá bán / Giá m²</p><p className="font-medium">{formatCurrency(viewing.price)} / {formatCurrency(viewing.price_per_sqm)}</p></div>
              <div><p className="text-gray-400 text-xs">Giá thuê</p><p className="font-medium">{viewing.price_rent ? `${formatCurrency(viewing.price_rent)}/tháng` : '--'}</p></div>
              {viewing.listing_type !== 'rent' && (
                <div><p className="text-gray-400 text-xs">Hoa hồng bán</p><p className="font-medium">{formatCommission(viewing.commission_sale_type, viewing.commission_sale_value, viewing.price)}</p></div>
              )}
              {viewing.listing_type !== 'sale' && (
                <div><p className="text-gray-400 text-xs">Hoa hồng cho thuê</p><p className="font-medium">{formatCommission(viewing.commission_rent_type, viewing.commission_rent_value, viewing.price_rent)}</p></div>
              )}
              <div><p className="text-gray-400 text-xs">Trạng thái</p><Badge label={getPropertyStatusLabel(viewing.status, viewing.listing_type)} color={PROPERTY_STATUS_COLORS[viewing.status] as never ?? 'gray'} dot /></div>
              <div><p className="text-gray-400 text-xs">Loại giao dịch</p><Badge label={LISTING_TYPE_LABELS[viewing.listing_type] ?? viewing.listing_type} color="blue" /></div>
              {viewing.tag && <div><p className="text-gray-400 text-xs">Phân loại</p><Badge label={PROPERTY_TAG_LABELS[viewing.tag] ?? viewing.tag} color={viewing.tag === 'exclusive' ? 'red' as never : 'gray' as never} /></div>}
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
                            <Badge label={getPropertyStatusLabel(sp.status, sp.listing_type)} color={PROPERTY_STATUS_COLORS[sp.status] as never ?? 'gray'} dot />
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
