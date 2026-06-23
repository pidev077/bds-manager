import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import { activityApi } from '@/lib/api'

const PAGE_LABELS: Record<string, string> = {
  '/tasks':           'Quản lý công việc',
  '/customers':       'Trang Khách hàng',
  '/properties':      'Trang Quỹ căn',
  '/appointments':    'Trang Lịch hẹn',
  '/needs':           'Trang Nhu cầu',
  '/deposits':        'Trang Cọc thiện chí',
  '/transactions':    'Trang Giao dịch',
  '/sale-management': 'Trang Quản lý Sale',
  '/kpi':             'Trang Báo cáo KPI',
  '/activity':        'Trang Nhật ký hoạt động',
  '/users':           'Trang Quản lý nhân viên',
}

export default function MainLayout() {
  const location = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    const label = PAGE_LABELS[location.pathname] ?? location.pathname
    const action = isFirstRender.current ? 'app_open' : 'page_view'
    const desc = isFirstRender.current
      ? `Mở ứng dụng → ${label}`
      : `Chuyển sang ${label}`

    isFirstRender.current = false

    activityApi.track(action, 'page', 0, desc).catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 py-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
