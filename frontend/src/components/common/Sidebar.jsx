import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Users, UserCog, LogOut, BarChart2, Sun, Moon, Settings, Bug } from 'lucide-react'
import axios from '../../api'
import { useDarkMode } from '../../hooks/useDarkMode'

const API = import.meta.env.VITE_API_URL || ''

const PLAN_RANK = { basic: 1, standard: 2, pro: 3 }
const PLAN_LABELS = { basic: 'ベーシック', standard: 'スタンダード', pro: 'プロ' }

function canUse(currentPlan, requiredPlan) {
  return (PLAN_RANK[currentPlan] || 1) >= (PLAN_RANK[requiredPlan] || 1)
}

function LockBadge({ plan }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 20,
      background: '#EEEDFE', color: '#534AB7', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      🔒 {PLAN_LABELS[plan]}
    </span>
  )
}

function getHolidays(year) {
  const h = {};
  const add = (m, d, name) => { h[`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`] = name; };
  add(1,1,'元日'); add(2,11,'建国記念の日'); add(2,23,'天皇誕生日');
  add(4,29,'昭和の日'); add(5,3,'憲法記念日'); add(5,4,'みどりの日');
  add(5,5,'こどもの日'); add(8,11,'山の日'); add(11,3,'文化の日'); add(11,23,'勤労感謝の日');
  function nthMon(m, n) {
    const d = new Date(year, m-1, 1); const first = d.getDay();
    const mon = first <= 1 ? 1 + (1 - first) : 8 - first + 1;
    return mon + (n-1) * 7;
  }
  add(1,nthMon(1,2),'成人の日'); add(7,nthMon(7,3),'海の日');
  add(9,nthMon(9,3),'敬老の日'); add(10,nthMon(10,2),'スポーツの日');
  const shunbun = Math.floor(20.8431 + 0.242194*(year-1980) - Math.floor((year-1980)/4));
  const shubun  = Math.floor(23.2488 + 0.242194*(year-1980) - Math.floor((year-1980)/4));
  add(3,shunbun,'春分の日'); add(9,shubun,'秋分の日');
  Object.keys(h).forEach(k => {
    const d = new Date(k);
    if (d.getDay() === 0) {
      const next = new Date(d); next.setDate(d.getDate()+1);
      const nk = next.toISOString().split('T')[0];
      if (!h[nk]) h[nk] = '振替休日';
    }
  });
  return h;
}

const navItems = [
  { path: '/calendar', label: '予約カレンダー', icon: Calendar, feature: null },
  { path: '/patients', label: '患者管理',       icon: Users,    feature: null },
  { path: '/staff',    label: 'スタッフ管理',   icon: UserCog,  feature: null },
]

const adminNavItems = [
  { path: '/admin/dashboard',  label: 'ダッシュボード', icon: BarChart2, feature: null, roles: ['admin','superadmin'] },
  { path: '/admin/settings',   label: 'システム設定',   icon: Settings,  feature: null, roles: ['admin','superadmin'] },
  { path: '/admin/line-debug', label: 'LINEデバッグ',   icon: Bug,       feature: null, roles: ['superadmin'] },
]

const DOW = ['日','月','火','水','木','金','土']

export default function Sidebar() {
  const location = useLocation()
  const [isDark, setIsDark] = useDarkMode()
  const currentRole = localStorage.getItem('admin_role') || 'staff'
  const [currentPlan, setCurrentPlan] = useState('basic')
  const today = new Date()
  const [miniMonth, setMiniMonth] = useState({ year: today.getFullYear(), month: today.getMonth()+1 })
  const [monthAppts, setMonthAppts] = useState({})
  const [openDays, setOpenDays] = useState([1,2,3,4,5,6])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    fetch(`${API}/api/licenses/default`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.plan) setCurrentPlan(data.plan) })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchMiniData() }, [miniMonth])

  async function fetchMiniData() {
    try {
      const { year, month } = miniMonth
      const daysInMonth = new Date(year, month, 0).getDate()
      const counts = {}
      const promises = []
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        promises.push(axios.get(`/api/appointments/calendar/${ds}`).then(r => { counts[ds] = r.data?.appointments?.length || 0 }).catch(() => { counts[ds] = 0 }))
      }
      await Promise.all(promises)
      setMonthAppts(counts)
      const firstWeekDates = []
      for (let d = 1; d <= 7 && d <= daysInMonth; d++) {
        firstWeekDates.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
      }
      const openDowSet = new Set()
      await Promise.all(firstWeekDates.map(ds =>
        axios.get(`/api/appointments/available-slots/${ds}`).then(r => { if (r.data?.available !== false) openDowSet.add(new Date(ds).getDay()) }).catch(() => {})
      ))
      if (openDowSet.size > 0) setOpenDays([...openDowSet])
    } catch {}
  }

  function handleLogout() { localStorage.clear(); window.location.href = '/admin/login' }

  function handleDayClick(dateStr) {
    const currentParams = new URLSearchParams(window.location.search)
    const currentView = currentParams.get('view') || 'day'
    const nextView = (currentView === 'week' || currentView === 'week5') ? currentView : 'day'
    window.location.href = `/calendar?date=${dateStr}&view=${nextView}`
  }

  const { year, month } = miniMonth
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow    = new Date(year, month-1, 1).getDay()
  const todayStr    = today.toISOString().split('T')[0]
  const holidays    = getHolidays(year)
  const currentParams = new URLSearchParams(window.location.search)
  const currentView   = currentParams.get('view') || 'day'
  const currentDate   = currentParams.get('date') || todayStr
  const isWeekView    = currentView === 'week' || currentView === 'week5'

  function getWeekRange(dateStr) {
    const d = new Date(dateStr); const dow = d.getDay()
    const startD = new Date(d); startD.setDate(d.getDate() - (dow === 0 ? 6 : dow-1))
    const endD = new Date(startD); endD.setDate(startD.getDate()+6)
    return { start: startD.toISOString().split('T')[0], end: endD.toISOString().split('T')[0] }
  }
  const selectedWeek = isWeekView ? getWeekRange(currentDate) : null

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)

  const roleLabel = currentRole === 'superadmin' ? 'スーパー管理者' : currentRole === 'admin' ? '管理者' : 'スタッフ'
  const roleBadgeStyle = currentRole === 'superadmin'
    ? { background: '#FAEEDA', color: '#854F0B' }
    : { background: '#EEEDFE', color: '#534AB7' }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦷</span>
          <div>
            <p className="text-sm font-bold text-gray-800">スマイル歯科</p>
            <p className="text-xs text-gray-500">管理システム</p>
          </div>
        </div>
      </div>

      {/* ロールバッジ */}
      {currentRole !== 'staff' && (
        <div className="px-3 pt-2 flex-shrink-0">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 10px', borderRadius:8, fontSize:11, ...roleBadgeStyle }}>
            <span style={{ fontWeight:600 }}>{roleLabel}</span>
            {currentRole !== 'superadmin' && (
              <Link to="/admin/settings" style={{ fontSize:10, color:'#6b7280', textDecoration:'none' }}>変更 →</Link>
            )}
          </div>
        </div>
      )}

      {/* プランバッジ（スーパー管理者以外） */}
      {currentRole !== 'superadmin' && (
        <div className="px-3 pt-1 flex-shrink-0">
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 10px', borderRadius:8,
            background: currentPlan==='pro' ? '#FAEEDA' : currentPlan==='standard' ? '#EEEDFE' : '#E1F5EE', fontSize:11,
          }}>
            <span style={{ color: currentPlan==='pro' ? '#854F0B' : currentPlan==='standard' ? '#534AB7' : '#0F6E56', fontWeight:600 }}>
              {PLAN_LABELS[currentPlan]}プラン
            </span>
            <Link to="/admin/settings" style={{ fontSize:10, color:'#6b7280', textDecoration:'none' }}>変更 →</Link>
          </div>
        </div>
      )}

      {/* 今日の日付 */}
      <div className="px-3 pt-2 pb-1 flex-shrink-0">
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
          <div className="text-xs text-blue-500 font-medium">{today.getFullYear()}年{today.getMonth()+1}月{today.getDate()}日</div>
          <div className="text-xs text-blue-400">{['日','月','火','水','木','金','土'][today.getDay()]}曜日</div>
        </div>
      </div>

      {/* ミニカレンダー */}
      <div className="px-2 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between px-1 py-1">
          <button onClick={() => setMiniMonth(m => { const d = new Date(m.year, m.month-2, 1); return { year:d.getFullYear(), month:d.getMonth()+1 } })} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50">◀</button>
          <span className="text-xs font-semibold text-gray-700">{year}年{month}月</span>
          <button onClick={() => setMiniMonth(m => { const d = new Date(m.year, m.month, 1); return { year:d.getFullYear(), month:d.getMonth()+1 } })} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50">▶</button>
        </div>
        <div className="grid grid-cols-7 mb-0.5">
          {DOW.map((d,i) => <div key={d} className={`text-center text-xs py-0.5 font-medium ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0">
          {cells.map((ds, idx) => {
            if (!ds) return <div key={`e-${idx}`} />
            const d = new Date(ds).getDate(); const dow = new Date(ds).getDay()
            const isToday = ds===todayStr; const count = monthAppts[ds]||0
            const isOpen = openDays.includes(dow); const isPast = ds<todayStr
            return (
              <button key={ds} onClick={() => handleDayClick(ds)}
                className={`relative flex flex-col items-center justify-center rounded-md py-0.5 transition-all
                  ${isToday?'bg-blue-600 text-white':''}
                  ${!isToday&&!isOpen?'bg-gray-100 text-gray-400':''}
                  ${!isToday&&isOpen&&holidays[ds]?'bg-red-50':''}
                  ${!isToday&&isOpen&&!holidays[ds]&&!isPast?'hover:bg-blue-50 text-gray-700':''}
                  ${!isToday&&isOpen&&!holidays[ds]&&isPast?'text-gray-400':''}
                  ${isWeekView&&selectedWeek&&ds>=selectedWeek.start&&ds<=selectedWeek.end&&!isToday?'ring-1 ring-blue-300 ring-inset':''}`}>
                <span className={`text-xs leading-none font-medium ${isToday?'text-white':''} ${!isToday&&(dow===0||holidays[ds])&&isOpen?'text-red-500':''} ${!isToday&&dow===6&&!holidays[ds]&&isOpen?'text-blue-400':''} ${!isOpen?'text-gray-400':''}`}>{d}</span>
                {count>0&&!isToday&&isOpen&&<div className="flex gap-0.5 mt-0.5">{[...Array(Math.min(count,3))].map((_,i)=><div key={i} className="w-1 h-1 rounded-full bg-blue-400"/>)}{count>3&&<div className="w-1 h-1 rounded-full bg-blue-300"/>}</div>}
                {count>0&&isToday&&<div className="w-1 h-1 rounded-full bg-white mt-0.5"/>}
                {!isOpen&&<span className="text-gray-400 font-medium" style={{fontSize:7,marginTop:1}}>休</span>}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="flex items-center gap-1 text-gray-400" style={{fontSize:9}}><div className="w-1.5 h-1.5 rounded-full bg-blue-400"/>予約あり</span>
          <span className="text-gray-300" style={{fontSize:9}}>休=休診</span>
        </div>
      </div>

      <div className="border-t border-gray-100 mx-3 mb-2 flex-shrink-0" />

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon, feature }) => {
          const active = location.pathname === path
          const locked = feature && !canUse(currentPlan, feature)
          return (
            <Link key={path} to={locked?'#':path} onClick={locked?e=>e.preventDefault():undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active?'bg-blue-50 text-blue-700 font-medium':locked?'text-gray-300 cursor-not-allowed':'text-gray-600 hover:bg-gray-50'}`}>
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {locked && <LockBadge plan={feature} />}
            </Link>
          )
        })}

        {/* 管理者専用メニュー */}
        {['admin','superadmin'].includes(currentRole) && (
          <>
            <div className="pt-2 pb-1 px-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">管理者</span>
            </div>
            {adminNavItems.filter(item => item.roles.includes(currentRole)).map(({ path, label, icon: Icon, feature }) => {
              const active = location.pathname === path
              const locked = feature && !canUse(currentPlan, feature)
              const isSuperOnly = path === '/admin/line-debug'
              return (
                <Link key={path} to={locked?'#':path} onClick={locked?e=>e.preventDefault():undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? (isSuperOnly?'bg-amber-50 text-amber-700 font-medium':'bg-purple-50 text-purple-700 font-medium')
                    : locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {isSuperOnly && !active && (
                    <span style={{fontSize:9,background:'#FAEEDA',color:'#854F0B',padding:'1px 5px',borderRadius:10,fontWeight:600}}>DEV</span>
                  )}
                  {locked && <LockBadge plan={feature} />}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* フッター */}
      <div className="p-3 border-t border-gray-200 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {isDark ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-yellow-500" />}
            <span className="text-xs">{isDark?'ダーク':'ライト'}</span>
          </div>
          <button onClick={() => setIsDark(!isDark)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isDark?'bg-blue-600':'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${isDark?'translate-x-4':'translate-x-1'}`}/>
          </button>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors w-full">
          <LogOut size={18} />ログアウト
        </button>
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
