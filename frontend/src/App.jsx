// frontend/src/App.jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CalendarPage      from './pages/CalendarPage'
import PatientsPage      from './pages/PatientsPage'
import StaffPage         from './pages/StaffPage'
import Sidebar           from './components/common/Sidebar'
import AdminLogin        from './pages/admin/AdminLogin'
import AdminLayout       from './pages/admin/AdminLayout'
import AdminSettings     from './pages/admin/AdminSettings'
import AdminBlocks       from './pages/admin/AdminBlocks'
import AdminDashboard    from './pages/admin/AdminDashboard'
import LineDebugPage     from './pages/admin/LineDebugPage'
import TestPatientsPage  from './pages/admin/TestPatientsPage'

// ── 管理者認証ガード ──────────────────────────────────────
function AdminGuard({ children }) {
  const token = localStorage.getItem('admin_token')
  const role  = localStorage.getItem('admin_role')
  if (!token || !['admin', 'superadmin'].includes(role)) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

// ── スーパー管理者専用ガード ──────────────────────────────
function SuperAdminGuard({ children }) {
  const token = localStorage.getItem('admin_token')
  const role  = localStorage.getItem('admin_role')
  if (!token || role !== 'superadmin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return children
}

// ── LINEデバッグウィンドウ（独立ページ） ─────────────────
function LineDebugWindow() {
  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#f9fafb', fontFamily: '"Noto Sans JP", sans-serif' }}>
      <LineDebugPage />
    </div>
  )
}

function App() {
  const [adminLoggedIn, setAdminLoggedIn] = useState(
    !!(localStorage.getItem('admin_token') &&
      ['admin', 'superadmin'].includes(localStorage.getItem('admin_role')))
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

        {/* ── LINEデバッグ独立ウィンドウ（認証不要・別ウィンドウ用） ── */}
        <Route path="/line-debug-window" element={
          <SuperAdminGuard><LineDebugWindow /></SuperAdminGuard>
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

          {/* スーパー管理者専用 */}
          <Route path="line-debug" element={
            <SuperAdminGuard><LineDebugPage /></SuperAdminGuard>
          } />
          <Route path="test-patients" element={
            <SuperAdminGuard><TestPatientsPage /></SuperAdminGuard>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
