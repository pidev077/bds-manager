import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
  { value: 'bds_employee', label: 'Nhân viên' },
  { value: 'bds_manager', label: 'Quản lý' },
  { value: 'bds_admin', label: 'Admin BDS' },
]

const ROLE_COLORS: Record<string, string> = { 'Admin': 'red', 'Quản lý': 'orange', 'Nhân viên': 'blue' }

type FormData = { display_name: string; email: string; username: string; password: string; role: string }

export default function UserManagement() {
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.list({ search: search || undefined }),
  })

  const users: User[] = data?.data ?? []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? usersApi.update(editing.id, d) : usersApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Tạo tài khoản thành công!')
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err?.response?.data?.message || 'Có lỗi xảy ra!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa tài khoản!'); qc.invalidateQueries({ queryKey: ['users'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (u: User) => {
    setEditing(u)
    reset({ display_name: u.display_name, email: u.email, role: u.roles?.[0] ?? 'bds_employee' })
    setOpenForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý nhân viên</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); reset({ role: 'bds_employee' }); setOpenForm(true) }}>
          <Plus size={16} /> Thêm nhân viên
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-60" placeholder="Tìm theo tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Nhân viên', 'Email', 'Vai trò', 'Ngày tham gia', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5}><LoadingState rows={5} /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5}><EmptyState message="Chưa có nhân viên nào" /></td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.display_name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <p className="font-medium text-gray-800">{u.display_name}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-gray-600">{u.email}</td>
                  <td className="table-cell">
                    <Badge label={u.role_label} color={(ROLE_COLORS[u.role_label] ?? 'gray') as never} />
                  </td>
                  <td className="table-cell text-gray-400">{formatDate(u.registered)}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-500 hover:underline" onClick={() => handleEdit(u)}>Sửa</button>
                      <button className="text-xs text-red-500 hover:underline" onClick={() => setDeleteId(u.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật tài khoản' : 'Thêm nhân viên mới'}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpenForm(false); setEditing(null) }}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit(d => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={e => e.preventDefault()}>
          <div>
            <label className="label">Họ tên hiển thị</label>
            <input className="input" {...register('display_name', { required: true })} placeholder="Nguyễn Văn A" />
            {errors.display_name && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          <div>
            <label className="label">Email <span className="text-red-500">*</span></label>
            <input className="input" type="email" {...register('email', { required: true })} placeholder="nhanvien@company.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
          </div>
          {!editing && (
            <>
              <div>
                <label className="label">Tên đăng nhập</label>
                <input className="input" {...register('username')} placeholder="Để trống sẽ dùng email" />
              </div>
              <div>
                <label className="label">Mật khẩu</label>
                <input className="input" type="password" {...register('password')} placeholder="Để trống sẽ tự tạo" />
              </div>
            </>
          )}
          {editing && (
            <div>
              <label className="label">Mật khẩu mới (để trống nếu không đổi)</label>
              <input className="input" type="password" {...register('password')} />
            </div>
          )}
          <div>
            <label className="label">Vai trò</label>
            <select className="input" {...register('role')}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Xóa tài khoản"
        message="Bạn có chắc muốn xóa tài khoản này? Dữ liệu liên quan sẽ không bị xóa nhưng tài khoản sẽ không thể đăng nhập."
      />
    </div>
  )
}
