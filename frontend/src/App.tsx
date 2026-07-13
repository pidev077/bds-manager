import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Tasks from '@/pages/Tasks'
import Customers from '@/pages/Customers'
import Properties from '@/pages/Properties'
import Appointments from '@/pages/Appointments'
import Needs from '@/pages/Needs'
import Deposits from '@/pages/Deposits'
import Transactions from '@/pages/Transactions'
import KPIDashboard from '@/pages/KPIDashboard'
import ActivityLog from '@/pages/ActivityLog'
import SaleManagement from '@/pages/SaleManagement'
import UserManagement from '@/pages/UserManagement'
import CartSale from '@/pages/CartSale'
import CartRent from '@/pages/CartRent'
import DocumentRepository from '@/pages/DocumentRepository'
import ProjectManagement from '@/pages/ProjectManagement'
import CareLogTimeline from '@/pages/CareLogTimeline'
import { useAuthStore } from '@/store/authStore'

function ProtectedRoute({ children, adminOnly = false, segment }: { children: React.ReactNode; adminOnly?: boolean; segment?: 'sale' | 'rent' }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/" replace />
  if (adminOnly && !user.is_admin && !user.is_manager) return <Navigate to="/dashboard" replace />
  // Nhân viên bị giới hạn phân khúc không được vào thẳng trang giỏ hàng của phân khúc khác qua URL
  if (segment && !user.is_admin && !user.is_manager && user.segment && user.segment !== 'both' && user.segment !== segment) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="customers" element={<Customers />} />
          <Route path="properties" element={<Properties />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="needs" element={<Needs />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="cart-sale" element={<ProtectedRoute segment="sale"><CartSale /></ProtectedRoute>} />
          <Route path="cart-rent" element={<ProtectedRoute segment="rent"><CartRent /></ProtectedRoute>} />
          <Route path="documents" element={<DocumentRepository />} />
          <Route path="care-logs" element={<CareLogTimeline />} />
          <Route path="sale-management" element={<SaleManagement />} />
          <Route path="kpi" element={<KPIDashboard />} />
          <Route path="activity" element={
            <ProtectedRoute adminOnly><ActivityLog /></ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>
          } />
          <Route path="project-management" element={
            <ProtectedRoute adminOnly><ProjectManagement /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
