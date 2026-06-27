import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, FileText, Download, Trash2 } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { BdsDocument } from '@/types'
import { DOCUMENT_CATEGORY_LABELS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const PROJECTS = ['Vinhomes Ocean Park', 'Vinhomes Golden Avenue', 'Vinhomes Green City', 'Vinhomes Hải Vân Bay', 'Vinhomes Global Gate', 'Vinhomes Golden City', 'Vinhomes Ocean Park 3', 'Vinhomes Green Paradise', 'Vinhomes Wonder City', 'Vinhomes Grand Park', 'Vinhomes Ocean Park 2']

function formatFileSize(bytes: number) {
  if (!bytes) return '--'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentRepository() {
  const [filterProject, setFilterProject] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')
  const [openUpload, setOpenUpload] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadProject, setUploadProject] = useState('')
  const [uploadCategory, setUploadCategory] = useState('price_list')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const canManage = !!user?.is_admin || !!user?.is_manager

  const params = { project_name: filterProject || undefined, category: filterCategory || undefined, search: search || undefined, per_page: 100 }

  const { data, isLoading } = useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentsApi.list(params),
  })
  const documents: BdsDocument[] = data?.data ?? []

  const uploadMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', uploadFile!)
      fd.append('title', uploadTitle)
      fd.append('project_name', uploadProject)
      fd.append('category', uploadCategory)
      return documentsApi.upload(fd)
    },
    onSuccess: () => {
      toast.success('Đã tải lên tài liệu')
      qc.invalidateQueries({ queryKey: ['documents'] })
      setOpenUpload(false); setUploadTitle(''); setUploadProject(''); setUploadCategory('price_list'); setUploadFile(null)
    },
    onError: () => toast.error('Tải lên thất bại!'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => { toast.success('Đã xóa!'); qc.invalidateQueries({ queryKey: ['documents'] }); setDeleteId(null) },
    onError: () => toast.error('Không thể xóa!'),
  })

  return (
    <div className="flex gap-4">
      {/* Sidebar - Projects */}
      <div className="w-56 shrink-0">
        <div className="bds-card">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Theo dự án</p>
          </div>
          <div className="px-2 py-1">
            <button
              onClick={() => setFilterProject('')}
              className={`flex items-center w-full text-left px-2 py-2 rounded text-xs transition-colors ${filterProject === '' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Tất cả dự án
            </button>
            {PROJECTS.map(proj => (
              <button
                key={proj}
                onClick={() => setFilterProject(filterProject === proj ? '' : proj)}
                className={`flex items-center w-full text-left px-2 py-2 rounded text-xs transition-colors ${filterProject === proj ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {proj}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="page-header">
          <h1 className="page-title">Kho tài liệu</h1>
          {canManage && (
            <button className="btn-primary" onClick={() => setOpenUpload(true)}>
              <Plus size={16} /> Thêm tài liệu
            </button>
          )}
        </div>

        <div className="tab-nav overflow-x-auto flex-nowrap">
          <button className={`tab-item shrink-0 ${filterCategory === '' ? 'active' : ''}`} onClick={() => setFilterCategory('')}>Tất cả</button>
          {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([v, l]) => (
            <button key={v} className={`tab-item shrink-0 ${filterCategory === v ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === v ? '' : v)}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-52" placeholder="Tìm kiếm tài liệu" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="bds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Tài liệu', 'Dự án', 'Phân loại', 'Kích thước', 'Người tải lên', 'Ngày tải', 'Thao tác'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7}><LoadingState /></td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="Chưa có tài liệu" /></td></tr>
                ) : documents.map(d => (
                  <tr key={d.id} className="table-row">
                    <td className="table-cell">
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium text-blue-600 hover:underline">
                        <FileText size={14} /> {d.title}
                      </a>
                    </td>
                    <td className="table-cell text-gray-500">{d.project_name || '--'}</td>
                    <td className="table-cell text-gray-500">{DOCUMENT_CATEGORY_LABELS[d.category] || d.category}</td>
                    <td className="table-cell text-gray-500">{formatFileSize(d.file_size)}</td>
                    <td className="table-cell text-gray-500">{d.uploaded_by_name || '--'}</td>
                    <td className="table-cell text-gray-400">{formatDate(d.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          <Download size={12} /> Tải
                        </a>
                        {canManage && (
                          <button className="text-xs text-red-500 hover:underline flex items-center gap-1" onClick={() => setDeleteId(d.id)}>
                            <Trash2 size={12} /> Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={openUpload}
        onClose={() => setOpenUpload(false)}
        title="Thêm tài liệu mới"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpenUpload(false)}>Hủy</button>
            <button className="btn-primary" disabled={!uploadFile || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
              {uploadMutation.isPending ? 'Đang tải lên...' : 'Tải lên'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-full">
            <label className="label">Tên tài liệu</label>
            <input className="input" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="VD: Bảng giá tháng 6" />
          </div>
          <div>
            <label className="label">Dự án</label>
            <select className="input" value={uploadProject} onChange={e => setUploadProject(e.target.value)}>
              <option value="">-- Chọn dự án --</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phân loại</label>
            <select className="input" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label className="label">File <span className="text-red-500">*</span></label>
            <input className="input" type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
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
