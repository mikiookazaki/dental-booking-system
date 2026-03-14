// frontend/src/App.jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CalendarPage   from './pages/CalendarPage'
import PatientsPage   from './pages/PatientsPage'
import StaffPage      from './pages/StaffPage'
import Sidebar        from './components/common/Sidebar'
import AdminLogin     from './pages/admin/AdminLogin'
import AdminLayout    from './pages/admin/AdminLayout'
import AdminSettings  from './pages/admin/AdminSettings'
import AdminBlocks    from './pages/admin/AdminBlocks'
import AdminDashboard from './pages/admin/AdminDashboard'

// ── 管理者認証ガード ────────────────────────────────────────
function AdminGuard({ children, onLogout }) {
  const token = localStorage.getItem('admin_token')
  const role  = localStorage.getItem('admin_role')
  if (!token || role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function App() {
  // ログイン状態をstateで管理してリレンダーを発火させる
  const [adminLoggedIn, setAdminLoggedIn] = useState(
    !!(localStorage.getItem('admin_token') && localStorage.getItem('admin_role') === 'admin')
  )

  return (
    <BrowserRouter>
      <Routes>
        {/* ── 一般スタッフ画面 ── */}
        <Route path="/" element={
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Navigate to="/calendar" />
            </main>
          </div>
        } />
        <Route path="/calendar" element={
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto"><CalendarPage /></main>
          </div>
        } />
        <Route path="/patients" element={
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto"><PatientsPage /></main>
          </div>
        } />
        <Route path="/staff" element={
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto"><StaffPage /></main>
          </div>
        } />

        {/* ── 管理者ログイン ── */}
        <Route path="/admin/login" element={
          adminLoggedIn
            ? <Navigate to="/admin/dashboard" replace />
            : <AdminLogin onLogin={() => setAdminLoggedIn(true)} />
        } />

        {/* ── 管理者専用画面 ── */}
        <Route path="/admin" element={
          <AdminGuard>
            <AdminLayout onLogout={() => setAdminLoggedIn(false)} />
          </AdminGuard>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="settings"  element={<AdminSettings />} />
          <Route path="blocks"    element={<AdminBlocks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
