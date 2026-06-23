import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kpiApi } from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { KPI } from '@/types'
import LoadingState from '@/components/ui/LoadingState'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { Users, Home, Calendar, TrendingUp, DollarSign, Target } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const PERIODS = [
  { label: 'Tháng này', value: 'month' },
  { label: 'Quý này', value: 'quarter' },
  { label: 'Năm này', value: 'year' },
]

interface KPICardProps {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}

function KPICard({ icon: Icon, label, value, color }: KPICardProps) {
  return (
    <div className={`card p-5 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <Icon size={28} className="text-gray-300" />
      </div>
    </div>
  )
}

export default function KPIDashboard() {
  const user = useAuthStore(s => s.user)
  const [period, setPeriod] = useState('month')
  const [year] = useState(new Date().getFullYear())
  const [month] = useState(new Date().getMonth() + 1)
  const [selectedUser, setSelectedUser] = useState<number | null>(null)

  const isAdminOrManager = user?.is_admin || user?.is_manager

  // My KPI
  const { data: myKpiData, isLoading: myLoading } = useQuery({
    queryKey: ['kpi-me', period, year, month],
    queryFn: () => kpiApi.me({ period, year, month }),
  })

  // Summary (admin only)
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['kpi-summary', period, year, month],
    queryFn: () => kpiApi.summary({ period, year, month }),
    enabled: !!isAdminOrManager,
  })

  const myKpi: KPI | null = myKpiData?.data ?? null
  const summary: KPI[] = summaryData?.data ?? []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Báo cáo KPI</h1>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`btn ${period === p.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* My KPI */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">KPI của tôi</h2>
        {myLoading ? (
          <LoadingState rows={2} />
        ) : myKpi ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
              <KPICard icon={Home}       label="Nhà bán đã nhập"    value={myKpi.properties}         color="border-blue-500" />
              <KPICard icon={Users}      label="Khách hàng mới"     value={myKpi.customers}          color="border-green-500" />
              <KPICard icon={Target}     label="Nhu cầu mua"        value={myKpi.needs}              color="border-purple-500" />
              <KPICard icon={Calendar}   label="Lịch hẹn"           value={`${myKpi.appointments_done}/${myKpi.appointments_total}`} color="border-yellow-500" />
              <KPICard icon={TrendingUp} label="Giao dịch"          value={myKpi.transactions}       color="border-orange-500" />
              <KPICard icon={DollarSign} label="Giá trị GD"         value={formatCurrency(myKpi.transaction_value)} color="border-red-500" />
            </div>

            {/* Trend chart */}
            {myKpi.trend && myKpi.trend.length > 0 && (
              <div className="card p-5">
                <h3 className="font-medium text-gray-700 mb-4">Xu hướng 6 tháng gần nhất</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={myKpi.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatNumber(v)} />
                    <Line type="monotone" dataKey="customers" stroke="#22c55e" strokeWidth={2} name="Khách hàng" dot={false} />
                    <Line type="monotone" dataKey="transactions" stroke="#f59e0b" strokeWidth={2} name="Giao dịch" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Team Summary (admin/manager only) */}
      {isAdminOrManager && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Tổng quan nhân viên</h2>
          {summaryLoading ? (
            <LoadingState />
          ) : (
            <>
              {/* Chart */}
              {summary.length > 0 && (
                <div className="card p-5 mb-4">
                  <h3 className="font-medium text-gray-700 mb-4">Số giao dịch theo nhân viên</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="user_name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar dataKey="transactions" fill="#c8932a" name="Giao dịch" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="customers" fill="#22c55e" name="Khách hàng" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Nhân viên', 'Vai trò', 'Nhà bán', 'Khách hàng', 'Nhu cầu', 'Lịch hẹn', 'Giao dịch', 'Giá trị GD', 'Hoa hồng'].map(h => (
                          <th key={h} className="table-header">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(k => (
                        <tr key={k.user_id} className="table-row">
                          <td className="table-cell">
                            <p className="font-medium text-gray-800">{k.user_name}</p>
                            <p className="text-xs text-gray-400">{k.user_email}</p>
                          </td>
                          <td className="table-cell text-gray-500">{k.role}</td>
                          <td className="table-cell text-center font-medium">{k.properties}</td>
                          <td className="table-cell text-center font-medium text-green-600">{k.customers}</td>
                          <td className="table-cell text-center">{k.needs}</td>
                          <td className="table-cell text-center">{k.appointments_done}/{k.appointments_total}</td>
                          <td className="table-cell text-center font-medium text-orange-600">{k.transactions}</td>
                          <td className="table-cell font-medium text-gray-700">{formatCurrency(k.transaction_value)}</td>
                          <td className="table-cell font-medium text-blue-600">{formatCurrency(k.commission)}</td>
                        </tr>
                      ))}
                      {summary.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
