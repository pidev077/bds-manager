import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, User, LogOut, BarChart2, Activity, Users, LayoutGrid, Home, ShoppingCart, FileText, Building2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { formatRelativeTime } from '@/lib/utils'
import type { Notification } from '@/types'

type NavItem =
  | { label: string; to: string; dropdown?: never; adminOnly?: boolean }
  | { label: string; to?: never; dropdown: { label: string; to: string; icon?: React.ElementType }[]; adminOnly?: boolean }

const NAV_ITEMS: NavItem[] = [
  { label: 'Quản lý công việc', to: '/tasks' },
  { label: 'Khách hàng', to: '/customers' },
  { label: 'Quỹ căn', to: '/properties' },
  { label: 'Lịch hẹn', to: '/appointments' },
  { label: 'Nhu cầu', to: '/needs' },
  {
    label: 'Hoa hồng',
    dropdown: [{ label: 'Danh sách hoa hồng', to: '/transactions' }],
  },
  { label: 'Quản lý cọc thiện chí', to: '/deposits' },
  { label: 'Quản lý giao dịch', to: '/transactions' },
  {
    label: 'Quản lý Sale',
    dropdown: [{ label: 'Yêu cầu tạo mới Sale', to: '/sale-management' }],
  },
  {
    label: 'Khác',
    adminOnly: true,
    dropdown: [
      { label: 'Chủ nhà', to: '/property-owners', icon: Home },
      { label: 'Giỏ hàng', to: '/cart', icon: ShoppingCart },
      { label: 'Kho tài liệu', to: '/documents', icon: FileText },
      { label: 'Quản lý dự án', to: '/project-management', icon: Building2 },
      { label: 'Báo cáo KPI', to: '/kpi', icon: BarChart2 },
      { label: 'Nhật ký hoạt động', to: '/activity', icon: Activity },
      { label: 'Quản lý nhân viên', to: '/users', icon: Users },
    ],
  },
]

export default function Navbar() {
  const user = useAuthStore(s => s.user)
  const { unreadCount, setUnreadCount } = useNotificationStore()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [showNotif, setShowNotif] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Fetch unread count every 30s
  useQuery({
    queryKey: ['notif-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount()
      setUnreadCount(res.data.count)
      return res.data.count
    },
    refetchInterval: 30_000,
  })

  // Notifications list
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ per_page: 10 }),
    enabled: showNotif,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-count'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      setUnreadCount(0)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setOpenDropdown(null); setShowNotif(false); setShowUserMenu(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const notifications: Notification[] = notifData?.data ?? []

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center h-14 gap-1">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-4 shrink-0 cursor-pointer" onClick={() => navigate('/tasks')}>
            <LayoutGrid size={20} className="text-brand" />
            <span className="font-bold text-base text-gray-800 hidden sm:block">QT AGENT</span>
          </div>

          {/* Nav items */}
          <div className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none">
            {NAV_ITEMS.map(item => {
              if (item.adminOnly && !user?.is_admin && !user?.is_manager) return null

              if (item.dropdown) {
                return (
                  <div key={item.label} className="relative shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md whitespace-nowrap transition-colors"
                      onClick={e => {
                        if (openDropdown === item.label) {
                          setOpenDropdown(null)
                          return
                        }
                        const rect = e.currentTarget.getBoundingClientRect()
                        const left = Math.min(rect.left, window.innerWidth - 180 - 8)
                        setDropdownPos({ top: rect.bottom + 4, left })
                        setOpenDropdown(item.label)
                      }}
                    >
                      {item.label}
                      <ChevronDown size={14} className={`transition-transform ${openDropdown === item.label ? 'rotate-180' : ''}`} />
                    </button>
                    {openDropdown === item.label && dropdownPos && createPortal(
                      <div
                        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-50"
                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                        onClick={e => e.stopPropagation()}
                      >
                        {item.dropdown.map(sub => (
                          <button
                            key={sub.to}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => { navigate(sub.to); setOpenDropdown(null) }}
                          >
                            {sub.icon && <sub.icon size={14} />}
                            {sub.label}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to!}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm rounded-md whitespace-nowrap transition-colors shrink-0 ${
                      isActive
                        ? 'text-brand font-semibold border-b-2 border-brand rounded-none pb-[calc(0.5rem-2px)]'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* Notifications */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                onClick={() => setShowNotif(!showNotif)}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-sm">Thông báo</span>
                    {unreadCount > 0 && (
                      <button className="text-xs text-brand hover:underline" onClick={() => markAllMutation.mutate()}>
                        Đánh dấu tất cả đã đọc
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-gray-400 py-8 text-sm">Không có thông báo</p>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        className={`flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => {
                          if (!n.is_read) markReadMutation.mutate(n.id)
                          setShowNotif(false)
                          if (n.object_type === 'property') navigate('/properties', { state: { openPropertyId: n.object_id } })
                          else if (n.object_type === 'need') navigate('/needs', { state: { openNeedId: n.object_id } })
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0 opacity-0 [&.unread]:opacity-100"
                             style={{ opacity: n.is_read ? 0 : 1 }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 leading-tight">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
                <span className="text-sm text-gray-700 hidden md:block max-w-[120px] truncate">{user?.name}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold text-sm text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                    <p className="text-xs text-brand mt-1">{user?.is_admin ? 'Admin' : user?.is_manager ? 'Quản lý' : 'Nhân viên'}</p>
                  </div>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    onClick={() => { window.location.href = window.bdsConfig?.adminUrl + 'profile.php' }}
                  >
                    <User size={14} />
                    Hồ sơ cá nhân
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    onClick={() => { window.location.href = window.bdsConfig?.siteUrl + '/wp-login.php?action=logout' }}
                  >
                    <LogOut size={14} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
