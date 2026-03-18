import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Users, UserCog, LogOut, BarChart2 } from 'lucide-react'
import axios from '../../api'

// =============================================
// 【2】日本の祝日計算
// =============================================
function getHolidays(year) {
  const h = {};
  const add = (m, d, name) => { h[`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`] = name; };

  // 固定祝日
  add(1,  1,  '元日');
  add(2,  11, '建国記念の日');
  add(2,  23, '天皇誕生日');
  add(4,  29, '昭和の日');
  add(5,  3,  '憲法記念日');
  add(5,  4,  'みどりの日');
  add(5,  5,  'こどもの日');
  add(8,  11, '山の日');
  add(11, 3,  '文化の日');
  add(11, 23, '勤労感謝の日');

  // ハッピーマンデー（第N月曜日）
  function nthMon(m, n) {
    const d = new Date(year, m-1, 1);
    const first = d.getDay();
    const mon = first <= 1 ? 1 + (1 - first) : 8 - first + 1;
    return mon + (n-1) * 7;
  }
  add(1,  nthMon(1,2),  '成人の日');
  add(7,  nthMon(7,3),  '海の日');
  add(9,  nthMon(9,3),  '敬老の日');
  add(10, nthMon(10,2), 'スポーツの日');

  // 春分・秋分（簡易計算）
  const shunbun = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const shubun  = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  add(3, shunbun, '春分の日');
  add(9, shubun,  '秋分の日');

  // 振替休日（祝日が日曜 → 翌月曜）
  const keys = Object.keys(h);
  keys.forEach(k => {
    const d = new Date(k);
    if (d.getDay() === 0) {
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const nk = next.toISOString().split('T')[0];
      if (!h[nk]) h[nk] = '振替休日';
    }
  });

  return h;
}

const navItems = [
  { path: '/calendar', label: '予約カレンダー', icon: Calendar },
  { path: '/patients', label: '患者管理',       icon: Users },
  { path: '/staff',    label: 'スタッフ管理',   icon: UserCog },
]

// 管理者専用メニュー
const adminNavItems = [
  { path: '/admin/dashboard', label: 'ダッシュボード', icon: BarChart2 },
]

const DOW = ['日','月','火','水','木','金','土']

export default function Sidebar() {
  const location = useLocation()

  // ミニカレンダー用 state
  const today = new Date()
  const [miniMonth, setMiniMonth] = useState({
    year:  today.getFullYear(),
    month: today.getMonth() + 1,
  })
  const [monthAppts, setMonthAppts] = useState({}) // { 'YYYY-MM-DD': count }
  const [openDays, setOpenDays]     = useState([1,2,3,4,5,6])

  // 診療曜日・月間予約件数を取得
  useEffect(() => {
    fetchMiniData()
  }, [miniMonth])

  async function fetchMiniData() {
    try {
      const { year, month } = miniMonth
      const daysInMonth = new Date(year, month, 0).getDate()
      const counts = {}
      const closedDays = new Set()

      // 各日の予約件数と休診判定を取得
      const promises = []
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        promises.push(
          axios.get(`/api/appointments/calendar/${ds}`)
            .then(r => {
              counts[ds] = r.data?.appointments?.length || 0
              // slotsが空 = 休診日
              if (!r.data?.slots?.length) closedDays.add(new Date(ds).getDay())
            })
            .catch(() => { counts[ds] = 0 })
        )
      }
      await Promise.all(promises)
      setMonthAppts(counts)

      // 休診曜日を診療曜日に変換（0-6のうち休診でない曜日）
      const allDows = [0,1,2,3,4,5,6]
      // available-slots で closed になる曜日を除外
      const firstWeekDates = []
      for (let d = 1; d <= 7 && d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        firstWeekDates.push(ds)
      }
      const openDowSet = new Set()
      await Promise.all(firstWeekDates.map(ds =>
        axios.get(`/api/appointments/available-slots/${ds}`)
          .then(r => { if (r.data?.available !== false) openDowSet.add(new Date(ds).getDay()) })
          .catch(() => {})
      ))
      if (openDowSet.size > 0) setOpenDays([...openDowSet])
    } catch {}
  }

  function handleLogout() {
    localStorage.clear()
    window.location.href = '/admin/login'
  }

  function handleDayClick(dateStr) {
    // 現在のviewTypeを保持しつつカレンダーページへ遷移
    // 週表示中なら週表示を維持、それ以外は日表示
    const currentPath = window.location.pathname
    const currentParams = new URLSearchParams(window.location.search)
    const currentView = currentParams.get('view') || 'day'
    // 週表示中（week or week5）なら週表示を維持
    const nextView = (currentView === 'week' || currentView === 'week5') ? currentView : 'day'
    window.location.href = `/calendar?date=${dateStr}&view=${nextView}`
  }

  const { year, month } = miniMonth
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow    = new Date(year, month - 1, 1).getDay()
  const todayStr    = today.toISOString().split('T')[0]
  const holidays    = getHolidays(year)  // 【2】祝日マップ

  // 現在の週表示中かどうかと、選択中の週の日付範囲を取得
  const currentParams = new URLSearchParams(window.location.search)
  const currentView   = currentParams.get('view') || 'day'
  const currentDate   = currentParams.get('date') || todayStr
  const isWeekView    = currentView === 'week' || currentView === 'week5'

  function getWeekRange(dateStr) {
    const d = new Date(dateStr)
    const dow = d.getDay()
    const startD = new Date(d)
    startD.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const endD = new Date(startD)
    endD.setDate(startD.getDate() + 6)
    const start = startD.toISOString().split('T')[0]
    const end   = endD.toISOString().split('T')[0]
    return { start, end }
  }
  const selectedWeek = isWeekView ? getWeekRange(currentDate) : null

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  }

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

      {/* 今日の日付 */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
          <div className="text-xs text-blue-500 font-medium">
            {today.getFullYear()}年{today.getMonth()+1}月{today.getDate()}日
          </div>
          <div className="text-xs text-blue-400">
            {['日','月','火','水','木','金','土'][today.getDay()]}曜日
          </div>
        </div>
      </div>

      {/* ミニカレンダー */}
      <div className="px-2 pb-2 flex-shrink-0">
        {/* 月ナビ */}
        <div className="flex items-center justify-between px-1 py-1">
          <button
            onClick={() => setMiniMonth(m => {
              const d = new Date(m.year, m.month - 2, 1)
              return { year: d.getFullYear(), month: d.getMonth() + 1 }
            })}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50"
          >◀</button>
          <span className="text-xs font-semibold text-gray-700">
            {year}年{month}月
          </span>
          <button
            onClick={() => setMiniMonth(m => {
              const d = new Date(m.year, m.month, 1)
              return { year: d.getFullYear(), month: d.getMonth() + 1 }
            })}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50"
          >▶</button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-0.5">
          {DOW.map((d, i) => (
            <div key={d} className={`text-center text-xs py-0.5 font-medium
              ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-0">
          {cells.map((ds, idx) => {
            if (!ds) return <div key={`e-${idx}`} />
            const d       = new Date(ds).getDate()
            const dow     = new Date(ds).getDay()
            const isToday = ds === todayStr
            const count   = monthAppts[ds] || 0
            const isOpen  = openDays.includes(dow)
            const isPast  = ds < todayStr

            return (
              <button
                key={ds}
                onClick={() => handleDayClick(ds)}
                className={`relative flex flex-col items-center justify-center rounded-md py-0.5 transition-all
                  ${isToday ? 'bg-blue-600 text-white' : ''}
                  ${!isToday && !isOpen ? 'bg-gray-100 text-gray-400' : ''}
                  ${!isToday && isOpen && holidays[ds] ? 'bg-red-50' : ''}
                  ${!isToday && isOpen && !holidays[ds] && !isPast ? 'hover:bg-blue-50 text-gray-700' : ''}
                  ${!isToday && isOpen && !holidays[ds] && isPast ? 'text-gray-400' : ''}
                  ${isWeekView && selectedWeek && ds >= selectedWeek.start && ds <= selectedWeek.end && !isToday ? 'ring-1 ring-blue-300 ring-inset' : ''}`}
              >
                <span className={`text-xs leading-none font-medium
                  ${isToday ? 'text-white' : ''}
                  ${!isToday && (dow === 0 || holidays[ds]) && isOpen ? 'text-red-500' : ''}
                  ${!isToday && dow === 6 && !holidays[ds] && isOpen ? 'text-blue-400' : ''}
                  ${!isOpen ? 'text-gray-400' : ''}`}>
                  {d}
                </span>
                {/* 予約件数ドット（診療日のみ） */}
                {count > 0 && !isToday && isOpen && (
                  <div className="flex gap-0.5 mt-0.5">
                    {[...Array(Math.min(count, 3))].map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-blue-400" />
                    ))}
                    {count > 3 && <div className="w-1 h-1 rounded-full bg-blue-300" />}
                  </div>
                )}
                {count > 0 && isToday && (
                  <div className="w-1 h-1 rounded-full bg-white mt-0.5" />
                )}
                {/* 休診マーク */}
                {!isOpen && (
                  <span className="text-gray-400 font-medium" style={{ fontSize: 7, marginTop: 1 }}>休</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="flex items-center gap-1 text-gray-400" style={{ fontSize: 9 }}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />予約あり
          </span>
          <span className="text-gray-300" style={{ fontSize: 9 }}>休=休診</span>
        </div>
      </div>

      {/* 区切り */}
      <div className="border-t border-gray-100 mx-3 mb-2 flex-shrink-0" />

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}

        {/* 管理者専用メニュー */}
        {localStorage.getItem('admin_role') === 'admin' && (
          <>
            <div className="pt-2 pb-1 px-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">管理者</span>
            </div>
            {adminNavItems.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-purple-50 text-purple-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* フッター */}
      <div className="p-3 border-t border-gray-200 space-y-2 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut size={18} />
          ログアウト
        </button>
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
