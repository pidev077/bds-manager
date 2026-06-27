import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { projectsApi, parseError } from '@/lib/api'
import type { Project } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

type FormData = { name: string }

export default function ProjectManagement() {
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })
  const projects: Project[] = data?.data ?? []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const saveMutation = useMutation({
    mutationFn: (d: FormData) => editing ? projectsApi.update(editing.id, d) : projectsApi.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm mới thành công!')
      qc.invalidateQueries({ queryKey: ['projects'] })
      setOpenForm(false); setEditing(null); reset()
    },
    onError: (err) => toast.error(parseError(err).message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['projects'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  const handleEdit = (p: Project) => { setEditing(p); reset({ name: p.name }); setOpenForm(true) }
  const handleAdd = () => { setEditing(null); reset({ name: '' }); setOpenForm(true) }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý dự án</h1>
        <button className="btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Thêm dự án
        </button>
      </div>

      <div className="bds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Tên dự án', 'Số căn', 'Thao tác'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3}><LoadingState /></td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={3}><EmptyState message="Chưa có dự án nào" /></td></tr>
              ) : projects.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell font-medium">{p.name}</td>
                  <td className="table-cell text-gray-500">{p.property_count}</td>
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
      </div>

      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null) }}
        title={editing ? 'Cập nhật dự án' : 'Thêm dự án mới'}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpenForm(false); setEditing(null) }}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit(d => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form onSubmit={e => e.preventDefault()}>
          <label className="label">Tên dự án <span className="text-red-500">*</span></label>
          <input className="input w-full" {...register('name', { required: true })} placeholder="VD: Vinhomes Ocean Park" />
          {errors.name && <p className="text-red-500 text-xs mt-1">Bắt buộc nhập</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        message="Bạn có chắc muốn xóa dự án này? Các căn đang gắn dự án này sẽ không bị xóa."
      />
    </div>
  )
}
