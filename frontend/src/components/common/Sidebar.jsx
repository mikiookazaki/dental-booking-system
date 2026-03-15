import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Users, UserCog, LogOut } from 'lucide-react'
import axios from '../../api'

const navItems = [
  { path: '/calendar', label: '予約カレンダー', icon: Calendar },
  { path: '/patients', label: '患者管理',       icon: Users },
  { path: '/staff',    label: 'スタッフ管理',   icon: UserCog },
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
    // カレンダーページに遷移（URLパラメータで日付を渡す）
    window.location.href = `/calendar?date=${dateStr}`
  }

  const { year, month } = miniMonth
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow    = new Date(year, month - 1, 1).getDay()
  const todayStr    = today.toISOString().split('T')[0]

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
                  ${!isToday && isOpen && !isPast ? 'hover:bg-blue-50 text-gray-700' : ''}
                  ${!isToday && !isOpen ? 'bg-gray-100 text-gray-400' : ''}
                  ${!isToday && isOpen && isPast ? 'text-gray-400' : ''}`}
              >
                <span className={`text-xs leading-none font-medium
                  ${dow === 0 && !isToday && isOpen ? 'text-red-400' : ''}
                  ${dow === 6 && !isToday && isOpen ? 'text-blue-400' : ''}
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
