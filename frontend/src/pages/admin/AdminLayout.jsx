// frontend/src/pages/admin/AdminLayout.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Settings, BarChart2, CalendarOff, LogOut, ChevronRight, BookOpen } from 'lucide-react'

const NAV = [
  { path: '/admin/dashboard', label: 'ダッシュボード', icon: <BarChart2 size={18} /> },
  { path: '/admin/settings',  label: 'システム設定',   icon: <Settings size={18} /> },
  { path: '/admin/blocks',    label: '予約制限管理',   icon: <CalendarOff size={18} /> },
]

export default function AdminLayout({ onLogout }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const adminName = localStorage.getItem('admin_name') || '管理者'

  function openManual() {
    const mode = localStorage.getItem('manual_display_mode') || 'newtab'
    if (mode === 'newtab') {
      window.open('/manual.html', '_blank')
    } else {
      setShowManualPanel(prev => !prev)
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_role')
    localStorage.removeItem('admin_name')
    onLogout()
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"Noto Sans JP", sans-serif', background: '#f8fafc' }}>
      {/* サイドバー */}
      <div style={{
        width: 220, background: '#1e3a5f', display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '24px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>🦷 スマイル歯科</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>管理者画面</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map(item => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  marginBottom: 2, textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                {item.icon}{item.label}
              </button>
            )
          })}
        </nav>
        {/* 一般画面へ戻る */}
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => navigate('/calendar')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12,
            }}
          >
            <ChevronRight size={14} />一般管理画面へ
          </button>
        </div>
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => openManual()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 12,
              marginBottom: 4,
            }}
          >
            <BookOpen size={14} />管理者マニュアル
          </button>
          <button
            onClick={() => openManual()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: 12,
            }}
          >
            <BookOpen size={14} />LINE予約ガイド
          </button>
        </div>
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '0 12px', marginBottom: 6 }}>
            {adminName}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
            }}
          >
            <LogOut size={14} />ログアウト
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
