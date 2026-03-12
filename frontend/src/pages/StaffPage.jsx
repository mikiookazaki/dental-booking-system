import { useState, useEffect } from 'react'
import axios from '../api'

const ROLE_LABEL = {
  doctor:     '歯科医師',
  hygienist:  '歯科衛生士',
  assistant:  '歯科助手',
  receptionist:'受付',
}

const DOW = ['日','月','火','水','木','金','土']

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStaff()
  }, [])

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await axios.get('/api/staff')
      setStaff(res.data.staff || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">スタッフ管理</h1>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {staff.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-4">
                {/* カラーアイコン */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: s.color || '#2563eb' }}
                >
                  {s.name.charAt(0)}
                </div>

                {/* 基本情報 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {ROLE_LABEL[s.role] || s.role}
                    </span>
                    {s.title && (
                      <span className="text-xs text-gray-400">{s.title}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{s.name_kana}</div>
                </div>

                {/* シフト情報 */}
                <div className="text-right text-sm text-gray-500">
                  {s.work_days && (
                    <div className="flex gap-1 justify-end mb-1">
                      {DOW.map((d, i) => (
                        <span
                          key={i}
                          className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                            s.work_days.includes(i)
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'bg-gray-100 text-gray-300'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.shift_start && s.shift_end && (
                    <div className="text-xs text-gray-400">
                      {s.shift_start.substring(0,5)} 〜 {s.shift_end.substring(0,5)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}