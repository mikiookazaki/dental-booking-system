// frontend/src/pages/admin/AdminLayout.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Settings, BarChart2, CalendarOff, LogOut, ChevronRight, BookOpen, X, MessageSquare, FlaskConical, Users } from 'lucide-react'
import { useTestMode } from '../../context/TestModeContext'

const NAV = [
  { path: '/admin/dashboard', label: '繝繝・す繝･繝懊・繝・, icon: <BarChart2 size={18} /> },
  { path: '/admin/settings',  label: '繧ｷ繧ｹ繝・Β險ｭ螳・,   icon: <Settings size={18} /> },
  { path: '/admin/blocks',    label: '莠育ｴ・宛髯千ｮ｡逅・,   icon: <CalendarOff size={18} /> },
]

const SUPER_NAV = [
  { path: '/admin/line-debug',    label: 'LINE繝・ヰ繝・げ',   icon: <MessageSquare size={18} /> },
  { path: '/admin/test-patients', label: '繝・せ繝域ぅ閠・ｮ｡逅・, icon: <Users size={18} /> },
]

export default function AdminLayout({ onLogout }) {
  const navigate     = useNavigate()
  const location     = useLocation()
  const adminName    = localStorage.getItem('admin_name') || '邂｡逅・・
  const adminRole    = localStorage.getItem('admin_role') || ''
  const isSuperAdmin = adminRole === 'superadmin'
  const [showManualPanel, setShowManualPanel] = useState(false)
  const { testMode, setTestMode } = useTestMode()

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

      {/* 繝・せ繝医Δ繝ｼ繝峨ヰ繝翫・・・uperadmin + 繝・せ繝医Δ繝ｼ繝碓N譎ゑｼ・*/}
      {isSuperAdmin && testMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
          color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 700,
          padding: '5px 16px', letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <FlaskConical size={14} />
          ｧｪ 繝・せ繝医Δ繝ｼ繝画怏蜉ｹ荳ｭ 窶・陦ｨ遉ｺ繝・・繧ｿ縺ｯ縺吶∋縺ｦ繝・せ繝育畑縺ｧ縺・
          <button
            onClick={() => setTestMode(false)}
            style={{
              marginLeft: 12, background: 'rgba(255,255,255,0.25)', border: 'none',
              color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            }}
          >OFF 縺ｫ縺吶ｋ</button>
        </div>
      )}

      {/* 繧ｵ繧､繝峨ヰ繝ｼ */}
      <div style={{
        width: 220, background: '#1e3a5f', display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        marginTop: (isSuperAdmin && testMode) ? 29 : 0,
      }}>
        <div style={{ padding: '24px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>ｦｷ 繧ｹ繝槭う繝ｫ豁ｯ遘・/div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>邂｡逅・・判髱｢</div>
          {isSuperAdmin && (
            <div style={{
              marginTop: 6, fontSize: 10, background: 'rgba(245,158,11,0.2)',
              color: '#fbbf24', borderRadius: 4, padding: '2px 6px', display: 'inline-block',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>笞｡ SUPER ADMIN</div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {/* 騾壼ｸｸ繝｡繝九Η繝ｼ */}
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
                  marginBottom: 2, textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                {item.icon}{item.label}
              </button>
            )
          })}

          {/* 繧ｹ繝ｼ繝代・邂｡逅・・ｰら畑繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ */}
          {isSuperAdmin && (
            <>
              <div style={{
                margin: '12px 4px 6px', fontSize: 10, fontWeight: 700,
                color: '#fbbf24', letterSpacing: '0.08em', textTransform: 'uppercase',
                borderTop: '1px solid rgba(245,158,11,0.3)', paddingTop: 10,
              }}>
                笞｡ 繧ｹ繝ｼ繝代・邂｡逅・・
              </div>

              {/* 繝・せ繝医Δ繝ｼ繝峨ヨ繧ｰ繝ｫ */}
              <div style={{
                margin: '0 4px 6px', borderRadius: 8,
                background: testMode ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                border: testMode ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
                padding: '8px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FlaskConical size={13} color={testMode ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
                    <span style={{ fontSize: 12, color: testMode ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      繝・せ繝医Δ繝ｼ繝・
                    </span>
                  </div>
                  <button
                    onClick={() => setTestMode(!testMode)}
                    style={{
                      position: 'relative', width: 36, height: 20,
                      borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: testMode ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: testMode ? 18 : 3,
                      width: 14, height: 14,
                      borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
                {testMode && (
                  <p style={{ fontSize: 10, color: '#fbbf24', margin: '5px 0 0', opacity: 0.8 }}>
                    繝・せ繝医ョ繝ｼ繧ｿ陦ｨ遉ｺ荳ｭ
                  </p>
                )}
              </div>

              {/* LINE繝・ヰ繝・げ遲峨・繝｡繝九Η繝ｼ */}
              {SUPER_NAV.map(item => {
                const active = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: active ? 'rgba(245,158,11,0.2)' : 'transparent',
                      color: active ? '#fbbf24' : 'rgba(255,255,255,0.65)',
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      marginBottom: 2, textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    {item.icon}{item.label}
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* 荳闊ｬ逕ｻ髱｢縺ｸ謌ｻ繧・*/}
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => navigate('/calendar')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12,
            }}
          >
            <ChevronRight size={14} />荳闊ｬ邂｡逅・判髱｢縺ｸ
          </button>
        </div>

        {/* 繝槭ル繝･繧｢繝ｫ繝懊ち繝ｳ */}
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={openManual}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: showManualPanel ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
              color: showManualPanel ? '#93c5fd' : 'rgba(255,255,255,0.85)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <BookOpen size={15} />当 謫堺ｽ懊・繝九Η繧｢繝ｫ
          </button>
        </div>

        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '0 12px', marginBottom: 6 }}>
            {adminName}
            {isSuperAdmin && <span style={{ marginLeft: 4, color: '#fbbf24' }}>笞｡</span>}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
            }}
          >
            <LogOut size={14} />繝ｭ繧ｰ繧｢繧ｦ繝・
          </button>
        </div>
      </div>

      {/* 繝｡繧､繝ｳ繧ｳ繝ｳ繝・Φ繝・+ 繧ｵ繧､繝峨ヱ繝阪Ν */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
        marginTop: (isSuperAdmin && testMode) ? 29 : 0,
      }}>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>

        {/* 繝槭ル繝･繧｢繝ｫ繧ｵ繧､繝峨ヱ繝阪Ν */}
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
                <BookOpen size={16} /> 謫堺ｽ懊・繝九Η繧｢繝ｫ
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => window.open('/manual.html', '_blank')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  }}
                >竊・蛻･繧ｿ繝悶〒髢九￥</button>
                <button
                  onClick={() => setShowManualPanel(false)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src="/manual.html"
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="謫堺ｽ懊・繝九Η繧｢繝ｫ"
            />
          </div>
        )}
      </div>
    </div>
  )
}
 
