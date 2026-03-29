// frontend/src/pages/admin/AdminLayout.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Settings, BarChart2, CalendarOff, LogOut, ChevronRight, BookOpen, X, Bug, FlaskConical } from 'lucide-react'
import { useTestMode } from '../../context/TestModeContext'

const NAV = [
  { path: '/admin/dashboard',  label: 'ダッシュボード', icon: <BarChart2 size={18} />,    roles: ['admin','superadmin'] },
  { path: '/admin/settings',   label: 'システム設定',   icon: <Settings size={18} />,     roles: ['admin','superadmin'] },
  { path: '/admin/blocks',     label: '予約制限管理',   icon: <CalendarOff size={18} />,   roles: ['admin','superadmin'] },
  { path: '/admin/line-debug', label: 'LINEデバッグ',   icon: <Bug size={18} />,           roles: ['superadmin'] },
  { path: '/admin/test-patients', label: 'テスト患者管理', icon: <FlaskConical size={18} />, roles: ['superadmin'] },
]

export default function AdminLayout({ onLogout }) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const adminName   = localStorage.getItem('admin_name') || '管理者'
  const currentRole = localStorage.getItem('admin_role') || 'admin'
  const [showManualPanel, setShowManualPanel] = useState(false)
  const { isTestMode, toggleTestMode, isSuperAdmin } = useTestMode()

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

  const visibleNav = NAV.filter(item => item.roles.includes(currentRole))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"Noto Sans JP", sans-serif', background: '#f8fafc' }}>
      {/* サイドバー */}
      <div style={{ width: 220, background: '#1e3a5f', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>🦷 スマイル歯科</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>管理者画面</div>
          {currentRole === 'superadmin' && (
            <div style={{ marginTop: 6, display: 'inline-block', background: '#BA7517', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
              スーパー管理者
            </div>
          )}
        </div>

        {/* テストモードトグル（superadminのみ） */}
        {isSuperAdmin && (
          <div style={{
            margin: '10px 8px',
            padding: '10px 12px',
            borderRadius: 10,
            background: isTestMode ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isTestMode ? '#854d0e' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FlaskConical size={14} color={isTestMode ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isTestMode ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                  テストモード
                </span>
              </div>
              {/* トグルスイッチ */}
              <button onClick={toggleTestMode}
                style={{
                  position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none',
                  background: isTestMode ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                }}>
                <span style={{
                  position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  left: isTestMode ? 18 : 2,
                }} />
              </button>
            </div>
            <div style={{
              fontSize: 10,
              color: isTestMode ? '#fbbf24' : 'rgba(255,255,255,0.35)',
              lineHeight: 1.4,
            }}>
              {isTestMode ? '⚠️ テストデータを表示中' : '本番データを表示中'}
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {visibleNav.map(item => {
            const active = location.pathname === item.path
            const isSuperOnly = item.roles.length === 1 && item.roles[0] === 'superadmin'
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active
                    ? (isSuperOnly ? 'rgba(186,117,23,0.3)' : 'rgba(255,255,255,0.15)')
                    : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  marginBottom: 2, textAlign: 'left', transition: 'all 0.15s',
                }}>
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {isSuperOnly && (
                  <span style={{ fontSize: 9, background: '#BA7517', color: '#fff', padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>
                    DEV
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => navigate('/calendar')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12,
            }}>
            <ChevronRight size={14} />一般管理画面へ
          </button>
        </div>

        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={openManual}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: showManualPanel ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
              color: showManualPanel ? '#93c5fd' : 'rgba(255,255,255,0.85)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}>
            <BookOpen size={15} />📖 操作マニュアル
          </button>
        </div>

        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '0 12px', marginBottom: 6 }}>
            {adminName}
          </div>
          <button onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
            }}>
            <LogOut size={14} />ログアウト
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflow: 'auto' }}>
          {/* テストモードバナー */}
          {isTestMode && (
            <div style={{
              background: '#fef3c7', borderBottom: '2px solid #f59e0b',
              padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: '#92400e', fontWeight: 600,
            }}>
              <FlaskConical size={16} />
              テストモード有効 — テストデータのみ表示されています。本番データには影響しません。
            </div>
          )}
          <Outlet />
        </main>

        {/* マニュアルサイドパネル */}
        {showManualPanel && (
          <div style={{
            width: 520, borderLeft: '2px solid #e5e7eb',
            display: 'flex', flexDirection: 'column',
            background: '#fff', flexShrink: 0,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: '#1e3a5f', color: '#fff', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                <BookOpen size={16} /> 操作マニュアル
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => window.open('/manual.html', '_blank')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  }}>
                  ↗ 別タブで開く
                </button>
                <button onClick={() => setShowManualPanel(false)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src="/manual.html" style={{ flex: 1, border: 'none', width: '100%' }} title="操作マニュアル" />
          </div>
        )}
      </div>
    </div>
  )
}