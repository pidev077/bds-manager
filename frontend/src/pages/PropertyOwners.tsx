import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { propertyOwnersApi, propertiesApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import type { PropertyOwner, Property } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

type FormData = {
  property_id: number; owner_name: string; owner_phone: string
  selling_price: number; commission_rate: number; notes: string
}

export default function PropertyOwners() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<PropertyOwner | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const isAdmin = !!useAuthStore(s => s.user)?.is_admin
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['property-owners', { page, search }],
    queryFn: () => propertyOwnersApi.list({ page, per_page: 20, search: search || undefined }),
  })

  const { data: propertiesData } = useQuery({
    queryKey: ['properties-select'],
    queryFn: () => propertiesApi.list({ per_page: 200 }),
  })

  const owners: PropertyOwner[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const properties: Property[] = propertiesData?.data ?? []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? propertyOwnersApi.update(editing.id, d) : propertyOwnersApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['property-owners'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => propertyOwnersApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['property-owners'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (o: PropertyOwner) => {
    setEditing(o)
    reset({ property_id: o.property_id, owner_name: o.owner_name, owner_phone: o.owner_phone, selling_price: o.selling_price, commission_rate: o.commission_rate, notes: o.notes })
    setOpenForm(true)
  }

  const handleAdd = () => { setEditing(null); reset({ selling_price: 0, commission_rate: 0 }); setOpenForm(true) }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý chủ nhà</h1>
        <button className="btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Tìm kiếm tên chủ, SĐT" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="bds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['ID', 'Mã căn', 'Tên chủ nhà', 'SĐT', 'Giá bán', 'Hoa hồng (%)', 'Ghi chú', 'Người phụ trách', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9}><LoadingState /></td></tr>
              ) : owners.length === 0 ? (
                <tr><td colSpan={9}><EmptyState message="Không có dữ liệu" /></td></tr>
              ) : owners.map(o => (
                <tr key={o.id} className="table-row">
                  <td className="table-cell font-medium text-gray-500">{o.id}</td>
                  <td className="table-cell font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(o)}>
                    {o.property_code || o.property_title || `#${o.property_id}`}
                  </td>
                  <td className="table-cell">{o.owner_name}</td>
                  <td className="table-cell text-gray-500">{o.owner_phone || '--'}</td>
                  <td className="table-cell font-medium">{formatCurrency(o.selling_price)}</td>
                  <td className="table-cell text-gray-500">{o.commission_rate ? `${o.commission_rate}%` : '--'}</td>
                  <td className="table-cell text-gray-500 max-w-[200px] truncate" title={o.notes}>{o.notes || '--'}</td>
                  <td className="table-cell text-gray-500">{o.assigned_to_name || '--'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(o)}>Sửa</button>
                      {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(o.id)}>Xóa</button>}
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
        title={editing ? 'Cập nhật thông tin chủ nhà' : 'Thêm chủ nhà mới'}
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
            <label className="label">Căn bất động sản <span className="text-red-500">*</span></label>
            <select className="input" {...register('property_id', { required: true, valueAsNumber: true })}>
              <option value={0}>-- Chọn căn --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{(p.code || p.unit_number)} - {p.title}</option>)}
            </select>
            {errors.property_id && <p className="text-red-500 text-xs mt-1">Bắt buộc chọn căn</p>}
          </div>
          <div>
            <label className="label">Tên chủ nhà <span className="text-red-500">*</span></label>
            <input className="input" {...register('owner_name', { required: true })} placeholder="VD: Anh Bình" />
            {errors.owner_name && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input className="input" {...register('owner_phone')} />
          </div>
          <div>
            <label className="label">Giá bán (VNĐ)</label>
            <input className="input" type="number" {...register('selling_price', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Hoa hồng (%)</label>
            <input className="input" type="number" step="0.1" {...register('commission_rate', { valueAsNumber: true })} placeholder="VD: 1" />
          </div>
          <div className="form-full">
            <label className="label">Ghi chú</label>
            <textarea className="input" rows={2} {...register('notes')} placeholder="VD: Chủ cần bán gấp" />
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
