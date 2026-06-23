import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, ChevronRight, Link2, Clipboard } from 'lucide-react'
import { propertiesApi } from '@/lib/api'
import { formatArea, formatCurrency } from '@/lib/utils'
import type { Property } from '@/types'
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

const PROJECTS = ['Vinhomes Ocean Park', 'Vinhomes Golden Avenue', 'Vinhomes Green City', 'Vinhomes Hải Vân Bay', 'Vinhomes Global Gate', 'Vinhomes Golden City', 'Vinhomes Ocean Park 3', 'Vinhomes Green Paradise', 'Vinhomes Wonder City', 'Vinhomes Grand Park', 'Vinhomes Ocean Park 2']

type FormData = {
  title: string; code: string; project_name: string; block: string; floor: string
  unit_number: string; area_gross: number; area_net: number; bedrooms: number
  bathrooms: number; direction: string; balcony_direction: string; price: number
  property_type: string; fund_type: string; status: string; component: string; standard: string; description: string
}

export default function Properties() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [typeTab, setTypeTab] = useState('all')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const params = { page, per_page: 20, search: search || undefined, project_name: filterProject || undefined, property_type: typeTab !== 'all' ? typeTab : (filterType || undefined), status: filterStatus || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['properties', params],
    queryFn: () => propertiesApi.list(params),
  })

  const properties: Property[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')

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

  // Project counts for sidebar
  const projectCounts = PROJECTS.reduce((acc, p) => ({ ...acc, [p]: 0 }), {} as Record<string, number>)

  return (
    <div className="flex gap-4">
      {/* Sidebar - Projects */}
      <div className="w-56 shrink-0">
        <div className="card">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quỹ căn sơ cấp</p>
            <p className="text-xs text-gray-400 mt-0.5">Danh sách quỹ căn sơ cấp của tôi</p>
          </div>
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-2">DANH SÁCH QUỸ CĂN</p>
            {PROJECTS.map(proj => (
              <button
                key={proj}
                onClick={() => setFilterProject(filterProject === proj ? '' : proj)}
                className={`flex items-center justify-between w-full text-left px-2 py-2 rounded text-xs transition-colors ${filterProject === proj ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="flex items-center gap-1">
                  <ChevronRight size={12} className={`transition-transform ${filterProject === proj ? 'rotate-90' : ''}`} />
                  {proj}
                </span>
                <span className="text-gray-400">{projectCounts[proj] || ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="page-header">
          <h1 className="page-title">
            {filterProject ? `Quỹ căn cao tầng ${filterProject}` : 'Quản lý quỹ căn'}
          </h1>
          <button className="btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Thêm mới
          </button>
        </div>

        {/* Type tabs */}
        <div className="tab-nav overflow-x-auto flex-nowrap">
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
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-48" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <button className="btn-secondary gap-2">
            <SlidersHorizontal size={14} /> Bộ lọc
          </button>
          <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(PROPERTY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
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
                        <span className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(p)}>
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
                        <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(p.id)}>Xóa</button>
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
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
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
    </div>
  )
}
