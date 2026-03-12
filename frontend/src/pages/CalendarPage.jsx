import { useState, useEffect } from 'react'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

const HOURS = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2,'0')}:${m}`
}).filter(t => t <= '18:00')

const STATUS_COLOR = {
  confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
  completed:  'bg-green-100 border-green-300 text-green-800',
  cancelled:  'bg-red-100 border-red-300 text-red-800',
  no_show:    'bg-gray-100 border-gray-300 text-gray-600',
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [chairs, setChairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)

  const dateStr = currentDate.toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
  }, [dateStr])

  async function fetchData() {
    setLoading(true)
    try {
      const [apptRes, chairRes] = await Promise.all([
        axios.get(`/api/appointments?date=${dateStr}&status=confirmed`),
        axios.get('/api/chairs'),
      ])
      setAppointments(apptRes.data.appointments || [])
      setChairs(chairRes.data.chairs || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  function prevDay() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    setCurrentDate(d)
  }

  function nextDay() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    setCurrentDate(d)
  }

  function toToday() {
    setCurrentDate(new Date())
  }

  function formatDateJP(date) {
    const dow = ['日','月','火','水','木','金','土'][date.getDay()]
    return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日（${dow}）`
  }

  function getApptForSlot(chairId, time) {
    return appointments.find(a =>
      a.chair_id === chairId &&
      a.start_time.substring(0,5) === time
    )
  }

  function calcRowSpan(duration) {
    return Math.ceil(duration / 30)
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">予約カレンダー</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          新規予約
        </button>
      </div>

      {/* 日付ナビゲーション */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-700 min-w-64 text-center">
          {formatDateJP(currentDate)}
        </h2>
        <button onClick={nextDay} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight size={20} />
        </button>
        <button
          onClick={toToday}
          className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          今日
        </button>
      </div>

      {/* カレンダーグリッド */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-16 p-2 border-b border-r border-gray-200 text-gray-500 font-medium">時間</th>
                {chairs.map(chair => (
                  <th key={chair.id} className="p-2 border-b border-r border-gray-200 text-gray-700 font-medium min-w-32">
                    {chair.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(time => (
                <tr key={time} className="hover:bg-gray-50">
                  <td className="p-2 border-b border-r border-gray-200 text-gray-400 text-xs text-right">
                    {time}
                  </td>
                  {chairs.map(chair => {
                    const appt = getApptForSlot(chair.id, time)
                    if (appt) {
                      return (
                        <td
                          key={chair.id}
                          className="border-b border-r border-gray-200 p-1 align-top"
                        >
                          <div
                            className={`rounded border p-1 cursor-pointer text-xs ${STATUS_COLOR[appt.status]}`}
                            onClick={() => setSelected(appt)}
                          >
                            <div className="font-medium">{appt.patient_name}</div>
                            <div className="text-xs opacity-75">{appt.treatment_name}</div>
                            <div className="text-xs opacity-75">{appt.start_time.substring(0,5)}〜{appt.end_time.substring(0,5)}</div>
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={chair.id} className="border-b border-r border-gray-200 p-1" />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 予約詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">予約詳細</h3>
              <button onClick={() => setSelected(null)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">患者名</span>
                <span className="font-medium">{selected.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">治療</span>
                <span>{selected.treatment_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">担当</span>
                <span>{selected.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">チェア</span>
                <span>{selected.chair_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">時間</span>
                <span>{selected.start_time.substring(0,5)}〜{selected.end_time.substring(0,5)}</span>
              </div>
              {selected.notes && (
                <div>
                  <span className="text-gray-500">メモ</span>
                  <p className="mt-1 text-gray-700">{selected.notes}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}