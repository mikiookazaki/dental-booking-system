// frontend/src/pages/admin/AdminLayout.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Settings, BarChart2, CalendarOff, LogOut, ChevronRight, BookOpen, X, MessageSquare, FlaskConical, Users } from 'lucide-react'
import { useTestMode } from '../../context/TestModeContext'
import TestSpecPanel from '../../components/admin/TestSpecPanel'

const NAV_DASHBOARD = '/admin/dashboard'
const NAV_SETTINGS  = '/admin/settings'
const NAV_BLOCKS    = '/admin/blocks'
const NAV_LINE      = '/admin/line-debug'
const NAV_TEST_PAT  = '/admin/test-patients'

export default function AdminLayout({ onLogout }) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const adminName   = localStorage.getItem('admin_name') || ''
  const adminRole   = localStorage.getItem('admin_role') || ''
  const isSuperAdmin = adminRole === 'superadmin'
  const [showManual, setShowManual] = useState(false)

  const { isTestMode, toggleTestMode } = useTestMode()

  function openManual() {
    const mode = localStorage.getItem('manual_display_mode') || 'newtab'
    if (mode === 'newtab') {
      window.open('/manual.html', '_blank')
    } else {
      setShowManual(prev => !prev)
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_role')
    localStorage.removeItem('admin_name')
    onLogout()
  }

  function NavBtn({ path, label, icon, activeColor }) {
    const active = location.pathname === path
    const ac = activeColor || 'rgba(255,255,255,0.15)'
    return (
      <button
        onClick={() => navigate(path)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: active ? ac : 'transparent',
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          fontSize: 13, fontWeight: active ? 600 : 400,
          marginBottom: 2, textAlign: 'left', transition: 'all 0.15s',
        }}
      >
        {icon}{label}
      </button>
    )
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'"Noto Sans JP",sans-serif', background:'#f8fafc' }}>

      {/* テストモードバナー */}
      {isSuperAdmin && isTestMode && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:9999,
          background:'linear-gradient(90deg,#f59e0b,#d97706)',
          color:'#fff', textAlign:'center', fontSize:12, fontWeight:700,
          padding:'5px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <FlaskConical size={14} />
          {'テストモード有効中 — 表示データはすべてテスト用です'}
          <button
            onClick={toggleTestMode}
            style={{
              marginLeft:12, background:'rgba(255,255,255,0.25)', border:'none',
              color:'#fff', fontSize:11, padding:'2px 8px', borderRadius:4, cursor:'pointer',
            }}
          >{'OFF にする'}</button>
        </div>
      )}

      {/* サイドバー */}
      <div style={{
        width:220, background:'#1e3a5f', display:'flex', flexDirection:'column', flexShrink:0,
        marginTop: (isSuperAdmin && isTestMode) ? 29 : 0,
      }}>
        <div style={{ padding:'24px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{'スマイル歯科'}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{'管理者画面'}</div>
          {isSuperAdmin && (
            <div style={{
              marginTop:6, fontSize:10, background:'rgba(245,158,11,0.2)',
              color:'#fbbf24', borderRadius:4, padding:'2px 6px', display:'inline-block',
              border:'1px solid rgba(245,158,11,0.3)',
            }}>{'SUPER ADMIN'}</div>
          )}
        </div>

        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          <NavBtn path={NAV_DASHBOARD} label={'ダッシュボード'} icon={<BarChart2 size={18}/>} />
          <NavBtn path={NAV_SETTINGS}  label={'システム設定'}   icon={<Settings size={18}/>} />
          <NavBtn path={NAV_BLOCKS}    label={'予約制限管理'}   icon={<CalendarOff size={18}/>} />

          {/* スーパー管理者専用 */}
          {isSuperAdmin && (
            <>
              <div style={{
                margin:'12px 4px 6px', fontSize:10, fontWeight:700,
                color:'#fbbf24', letterSpacing:'0.08em',
                borderTop:'1px solid rgba(245,158,11,0.3)', paddingTop:10,
              }}>
                {'スーパー管理者'}
              </div>

              {/* テストモードトグル */}
              <div style={{
                margin:'0 4px 6px', borderRadius:8,
                background: isTestMode ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                border: isTestMode ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
                padding:'8px 10px',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <FlaskConical size={13} color={isTestMode ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
                    <span style={{ fontSize:12, color: isTestMode ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontWeight:600 }}>
                      {'テストモード'}
                    </span>
                  </div>
                  <button
                    onClick={toggleTestMode}
                    style={{
                      position:'relative', width:36, height:20,
                      borderRadius:10, border:'none', cursor:'pointer',
                      background: isTestMode ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                      transition:'background 0.2s',
                    }}
                  >
                    <span style={{
                      position:'absolute', top:3,
                      left: isTestMode ? 18 : 3,
                      width:14, height:14, borderRadius:'50%', background:'#fff',
                      transition:'left 0.2s',
                    }} />
                  </button>
                </div>
                {isTestMode && (
                  <p style={{ fontSize:10, color:'#fbbf24', margin:'5px 0 0', opacity:0.8 }}>
                    {'テストデータ表示中'}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  const w = window.open(
                    '/line-debug-window',
                    'LineDebug',
                    'width=560,height=900,left=100,top=50,resizable=yes,scrollbars=no'
                  )
                  w?.focus()
                }}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer',
                  background:'transparent', color:'rgba(255,255,255,0.65)',
                  fontSize:13, fontWeight:400, marginBottom:2, textAlign:'left',
                  transition:'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(245,158,11,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <MessageSquare size={18} style={{ color:'rgba(255,255,255,0.65)' }}/>
                {'LINEデバッグ'}
                <span style={{ marginLeft:'auto', fontSize:9, opacity:0.6 }}>↗</span>
              </button>
              <NavBtn path={NAV_TEST_PAT} label={'テスト患者管理'} icon={<Users size={18}/>} activeColor={'rgba(245,158,11,0.2)'} />
            </>
          )}
        </nav>

        <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => navigate('/calendar')}
            style={{
              display:'flex', alignItems:'center', gap:8, width:'100%',
              padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer',
              background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12,
            }}
          >
            <ChevronRight size={14}/> {'一般管理画面へ'}
          </button>
        </div>

        <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={openManual}
            style={{
              display:'flex', alignItems:'center', gap:8, width:'100%',
              padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer',
              background: showManual ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
              color: showManual ? '#93c5fd' : 'rgba(255,255,255,0.85)',
              fontSize:13, fontWeight:600, transition:'all 0.15s',
            }}
          >
            <BookOpen size={15}/> {'操作マニュアル'}
          </button>
        </div>

        <div style={{ padding:'12px 8px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', padding:'0 12px', marginBottom:6 }}>
            {adminName}
            {isSuperAdmin && <span style={{ marginLeft:4, color:'#fbbf24' }}>{'⚡'}</span>}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display:'flex', alignItems:'center', gap:8, width:'100%',
              padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer',
              background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:13,
            }}
          >
            <LogOut size={14}/> {'ログアウト'}
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{
        flex:1, display:'flex', overflow:'hidden',
        marginTop: (isSuperAdmin && isTestMode) ? 29 : 0,
      }}>
        <main style={{ flex:1, overflow:'auto' }}>
          <Outlet />
        </main>

        {showManual && (
          <div style={{
            width:520, borderLeft:'2px solid #e5e7eb',
            display:'flex', flexDirection:'column',
            background:'#fff', flexShrink:0,
            boxShadow:'-4px 0 24px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px', background:'#1e3a5f', color:'#fff', flexShrink:0,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:700 }}>
                <BookOpen size={16}/> {'操作マニュアル'}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button
                  onClick={() => window.open('/manual.html','_blank')}
                  style={{
                    background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
                    fontSize:11, padding:'4px 10px', borderRadius:6, cursor:'pointer',
                  }}
                >{'別タブで開く'}</button>
                <button
                  onClick={() => setShowManual(false)}
                  style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', padding:4 }}
                >
                  <X size={18}/>
                </button>
              </div>
            </div>
            <iframe src="/manual.html" style={{ flex:1, border:'none', width:'100%' }} title="manual" />
          </div>
        )}
      </div>

      {/* テスト仕様書フローティングパネル（スーパー管理者のみ） */}
      <TestSpecPanel />
    </div>
  )
}
