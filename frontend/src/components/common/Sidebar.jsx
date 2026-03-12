import { Link, useLocation } from 'react-router-dom'
import { Calendar, Users, UserCog, Settings } from 'lucide-react'

const navItems = [
  { path: '/calendar', label: '予約カレンダー', icon: Calendar },
  { path: '/patients', label: '患者管理',       icon: Users },
  { path: '/staff',    label: 'スタッフ管理',   icon: UserCog },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦷</span>
          <div>
            <p className="text-sm font-bold text-gray-800">スマイル歯科</p>
            <p className="text-xs text-gray-500">管理システム</p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-3 space-y-1">
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
      <div className="p-3 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}