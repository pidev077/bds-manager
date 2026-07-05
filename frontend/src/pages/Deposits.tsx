import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { depositsApi, customersApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Deposit } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

type FormData = {
  name: string; customer_id: number; campaign: string; project: string; zone: string
  activity_status: string; booking_status: string; booking_count: number
  total_amount: number; property_type: string; specific_request: string; notes: string
}

const PROJECTS = ['Vinhomes Ocean Park', 'Vinhomes Golden Avenue', 'Vinhomes Green City', 'Vinhomes Grand Park', 'Vinhomes Wonder City']

export default function Deposits() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Deposit | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const isAdmin = !!useAuthStore(s => s.user)?.is_admin
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['deposits', { page, search }],
    queryFn: () => depositsApi.list({ page, per_page: 20, search: search || undefined }),
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
  })

  const deposits: Deposit[] = data?.data ?? []
  const total = parseInt(data?.headers?.['x-wp-total'] ?? '0')
  const totalPages = parseInt(data?.headers?.['x-wp-totalpages'] ?? '1')
  const customers = customersData?.data ?? []

  const { register, handleSubmit, reset } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? depositsApi.update(editing.id, d) : depositsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['deposits'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => depositsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['deposits'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (d: Deposit) => {
    setEditing(d)
    reset({ name: d.name, customer_id: d.customer_id, campaign: d.campaign, project: d.project, zone: d.zone, activity_status: d.activity_status, booking_status: d.booking_status, booking_count: d.booking_count, total_amount: d.total_amount, property_type: d.property_type, specific_request: d.specific_request, notes: d.notes })
    setOpenForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý cọc thiện chí</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); reset({ activity_status: 'active', booking_count: 0, total_amount: 0 }); setOpenForm(true) }}>
          <Plus size={16} /> Thêm mới
        </button>
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
                {['ID', 'Tên cọc thiện chí', 'Khách hàng', 'Chiến dịch', 'Dự án', 'Phân khu', 'Trạng thái hoạt động', 'Trạng thái booking', 'SL booking', 'Tổng tiền cọc', 'Loại hình BDS', 'Yêu cầu cụ thể', 'Người p.trách booking', 'Người hỗ trợ booking', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15}><LoadingState /></td></tr>
              ) : deposits.length === 0 ? (
                <tr><td colSpan={15}><EmptyState message="Không có dữ liệu" /></td></tr>
              ) : deposits.map(d => (
                <tr key={d.id} className="table-row">
                  <td className="table-cell font-medium text-gray-500">{d.id}</td>
                  <td className="table-cell font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => handleEdit(d)}>
                    {d.name || `Cọc #${d.id}`}
                  </td>
                  <td className="table-cell">{d.customer_name || '--'}</td>
                  <td className="table-cell text-gray-500">{d.campaign || '--'}</td>
                  <td className="table-cell text-gray-500">{d.project || '--'}</td>
                  <td className="table-cell text-gray-500">{d.zone || '--'}</td>
                  <td className="table-cell">
                    <Badge label={d.activity_status === 'active' ? 'Đang hoạt động' : 'Ngừng'} color={d.activity_status === 'active' ? 'green' : 'gray'} dot />
                  </td>
                  <td className="table-cell">
                    {d.booking_status ? <Badge label={d.booking_status} color="blue" /> : <span className="text-gray-400">--</span>}
                  </td>
                  <td className="table-cell text-center">{d.booking_count}</td>
                  <td className="table-cell font-medium">{formatCurrency(d.total_amount)}</td>
                  <td className="table-cell text-gray-500">{d.property_type || '--'}</td>
                  <td className="table-cell text-gray-500 max-w-[150px] truncate" title={d.specific_request}>{d.specific_request || '--'}</td>
                  <td className="table-cell text-gray-500">{d.assigned_to_name || '--'}</td>
                  <td className="table-cell text-gray-500">{d.support_person_name || '--'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(d)}>Sửa</button>
                      {isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(d.id)}>Xóa</button>}
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
        title={editing ? 'Cập nhật cọc thiện chí' : 'Thêm cọc thiện chí mới'}
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
            <label className="label">Tên cọc thiện chí</label>
            <input className="input" {...register('name')} placeholder="VD: Cọc căn LD31107" />
          </div>
          <div>
            <label className="label">Khách hàng <span className="text-red-500">*</span></label>
            <select className="input" {...register('customer_id', { valueAsNumber: true })}>
              <option value={0}>-- Chọn khách hàng --</option>
              {customers.map((c: { id: number; full_name: string }) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dự án</label>
            <select className="input" {...register('project')}>
              <option value="">-- Chọn dự án --</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Chiến dịch</label>
            <input className="input" {...register('campaign')} />
          </div>
          <div>
            <label className="label">Phân khu</label>
            <input className="input" {...register('zone')} />
          </div>
          <div>
            <label className="label">Tổng tiền cọc (VNĐ)</label>
            <input className="input" type="number" {...register('total_amount', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">SL booking</label>
            <input className="input" type="number" min="0" {...register('booking_count', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Trạng thái booking</label>
            <input className="input" {...register('booking_status')} placeholder="VD: Chờ xử lý" />
          </div>
          <div>
            <label className="label">Loại hình BDS</label>
            <input className="input" {...register('property_type')} placeholder="Căn hộ, Biệt thự..." />
          </div>
          <div>
            <label className="label">Trạng thái hoạt động</label>
            <select className="input" {...register('activity_status')}>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
          <div className="form-full">
            <label className="label">Yêu cầu cụ thể</label>
            <textarea className="input" rows={2} {...register('specific_request')} />
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
