import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Pagination from '@/components/ui/Pagination'

const TABS = [
  { label: 'Chờ duyệt', value: 'pending' },
  { label: 'Bổ sung hồ sơ', value: 'supplement' },
  { label: 'Từ chối', value: 'rejected' },
  { label: 'Đã duyệt', value: 'approved' },
  { label: 'Tất cả', value: '' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', supplement: 'blue', rejected: 'red', approved: 'green',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt', supplement: 'Bổ sung hồ sơ', rejected: 'Từ chối', approved: 'Đã duyệt',
}

export default function SaleManagement() {
  const [tab, setTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Using WP REST API for sale requests (would need its own endpoint)
  // For now showing mock/empty state
  const isLoading = false
  const requests: never[] = []
  const total = 0
  const totalPages = 1

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý yêu cầu tạo mới Sale</h1>
      </div>

      <div className="tab-nav">
        {TABS.map(t => (
          <button key={t.value} className={`tab-item ${tab === t.value ? 'active' : ''}`} onClick={() => { setTab(t.value); setPage(1) }}>
            {t.label}
            {t.value === 'pending' && <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold">0</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Tìm kiếm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <button className="btn-secondary gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M9 12h6M13 18h2" /></svg>
          Bộ lọc / 1
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Mã yêu cầu', 'Họ và Tên', 'Số điện thoại', 'Email', 'Vùng miền kinh doanh', 'Đội nhóm', 'Trạng thái', 'Người phụ trách'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8}><LoadingState /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={8}><EmptyState message="Không có yêu cầu" /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} perPage={20} onChange={setPage} />
      </div>
    </div>
  )
}
