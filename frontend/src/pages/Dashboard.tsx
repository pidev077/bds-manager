import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Home, Building2, CheckCircle2, XCircle, PackageCheck, Sparkles, Users, CalendarClock } from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { APPOINTMENT_TYPE_LABELS, PROPERTY_STATUS_LABELS } from '@/types'
import type { DashboardStats } from '@/types'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
  onClick?: () => void
}

function StatCard({ icon: Icon, label, value, color, onClick }: StatCardProps) {
  return (
    <div className={`bds-card p-4 border-l-4 ${color} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <Icon size={26} className="text-gray-300" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    refetchInterval: 60_000,
  })

  const stats: DashboardStats | null = data?.data ?? null

  if (isLoading || !stats) {
    return <LoadingState rows={6} />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* Quỹ căn */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quỹ căn</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Building2}    label="Quỹ căn sơ cấp"      value={stats.primary_count}     color="border-blue-500"  onClick={() => navigate('/properties', { state: { filterFundType: 'F0' } })} />
        <StatCard icon={Building2}    label="Quỹ căn thứ cấp"     value={stats.secondary_count}    color="border-indigo-500" onClick={() => navigate('/properties', { state: { filterFundType: 'F1' } })} />
        <StatCard icon={Home}         label="Tổng sản phẩm"       value={stats.total_properties}   color="border-gray-400"  onClick={() => navigate('/properties')} />
        <StatCard icon={CheckCircle2} label="Đang bán/cho thuê"   value={stats.available_count}    color="border-green-500" onClick={() => navigate('/properties', { state: { filterStatus: 'available' } })} />
        <StatCard icon={XCircle}      label="Ngưng bán/cho thuê"  value={stats.cancelled_count}    color="border-gray-400"  onClick={() => navigate('/properties', { state: { filterStatus: 'cancelled' } })} />
        <StatCard icon={PackageCheck} label="Đã bán/cho thuê"     value={stats.sold_count}         color="border-red-500"   onClick={() => navigate('/properties', { state: { filterStatus: 'sold' } })} />
        <StatCard icon={Sparkles}     label="Sản phẩm mới hôm nay" value={stats.new_today_count}   color="border-purple-500" onClick={() => navigate('/properties', { state: { filterCreatedToday: true } })} />
        <StatCard icon={Users}        label="Khách đang cần xử lý" value={stats.needs_pending_count} color="border-yellow-500" onClick={() => navigate('/tasks', { state: { filterTab: 'active' } })} />
        <StatCard icon={CalendarClock} label="Lịch hẹn hôm nay"   value={stats.appointments_today_count} color="border-orange-500" onClick={() => navigate('/appointments', { state: { filterDate: 'today' } })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sản phẩm mới cập nhật hôm nay */}
        <div className="bds-card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">Sản phẩm mới cập nhật hôm nay</h3>
          </div>
          <div className="p-2">
            {stats.new_today_items.length === 0 ? (
              <EmptyState message="Chưa có sản phẩm nào hôm nay" />
            ) : stats.new_today_items.map(item => (
              <div
                key={item.id}
                className="px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate('/properties', { state: { openPropertyId: item.id } })}
              >
                <p className="text-sm font-medium text-gray-800">{item.unit_number || item.code || `#${item.id}`} - {item.title}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500">{item.project_name || '--'} · {PROPERTY_STATUS_LABELS[item.status] ?? item.status}</span>
                  <span className="text-xs font-medium text-gray-600">{formatCurrency(item.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Khách đang cần xử lý */}
        <div className="bds-card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">Khách đang cần xử lý</h3>
          </div>
          <div className="p-2">
            {stats.needs_pending_items.length === 0 ? (
              <EmptyState message="Không có nhu cầu nào cần xử lý" />
            ) : stats.needs_pending_items.map(item => (
              <div
                key={item.id}
                className="px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate('/needs', { state: { openNeedId: item.id } })}
              >
                <p className="text-sm font-medium text-gray-800">{item.title || item.customer_name || `NCD-${item.id}`}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.customer_name || '--'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lịch hẹn hôm nay */}
        <div className="bds-card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">Lịch hẹn hôm nay</h3>
          </div>
          <div className="p-2">
            {stats.appointments_today_items.length === 0 ? (
              <EmptyState message="Không có lịch hẹn nào hôm nay" />
            ) : stats.appointments_today_items.map(item => (
              <div
                key={item.id}
                className="px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate('/appointments')}
              >
                <p className="text-sm font-medium text-gray-800">{item.customer_name || '--'}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500">{APPOINTMENT_TYPE_LABELS[item.type] ?? item.type}</span>
                  <span className="text-xs font-medium text-gray-600">{formatDateTime(item.appointment_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
