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
import Cart from '@/pages/Cart'
import DocumentRepository from '@/pages/DocumentRepository'
import ProjectManagement from '@/pages/ProjectManagement'
import CareLogTimeline from '@/pages/CareLogTimeline'
import { useAuthStore } from '@/store/authStore'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/" replace />
  if (adminOnly && !user.is_admin && !user.is_manager) return <Navigate to="/dashboard" replace />
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
          <Route path="cart" element={<Cart />} />
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
