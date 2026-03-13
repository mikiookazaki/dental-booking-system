import { useState, useEffect, useCallback } from 'react'
import axios from '../api'
import { ChevronLeft, ChevronRight, X, Plus, Calendar, User } from 'lucide-react'

const HOURS = []
for (let h = 9; h <= 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 18 && m > 0) break
    HOURS.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
}

const DOW = ['日','月','火','水','木','金','土']

const STATUS_COLOR = {
  confirmed: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  completed:  { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
  cancelled:  { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
  no_show:    { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
}

export default function CalendarPage() {
  const [viewMonth, setViewMonth]       = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [monthAppts, setMonthAppts]     = useState([])
  const [chairs, setChairs]             = useState([])
  const [staff, setStaff]               = useState([])
  const [groupBy, setGroupBy]           = useState('chair') // 'chair' | 'staff'
  const [loading, setLoading]           = useState(false)
  const [selected, setSelected]         = useState(null)

  // タイムゾーンずれ防止：ローカル日付文字列を使用
  function toLocalDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  const selectedStr = toLocalDateStr(selectedDate)
  const monthStr    = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,'0')}`

  // 月間予約取得
  useEffect(() => {
    fetchMonthAppts()
  }, [monthStr])

  // 日別予約取得
  useEffect(() => {
    fetchDayAppts()
  }, [selectedStr])

  // チェア・スタッフ取得
  useEffect(() => {
    Promise.all([
      axios.get('/api/chairs'),
      axios.get('/api/staff'),
    ]).then(([c, s]) => {
      setChairs(c.data.chairs || [])
      setStaff((s.data.staff || []).filter(s => s.role === 'doctor' || s.role === 'hygienist'))
    })
  }, [])

  async function fetchMonthAppts() {
    try {
      const res = await axios.get(`/api/appointments?month=${monthStr}`)
      setMonthAppts(res.data.appointments || [])
    } catch (err) { console.error(err) }
  }

  async function fetchDayAppts() {
    setLoading(true)
    try {
      const res = await axios.get(`/api/appointments?date=${selectedStr}`)
      setAppointments(res.data.appointments || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // ── 月間カレンダーの計算 ───────────────────────────────────
  function getMonthDays() {
    const year  = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const first = new Date(year, month, 1)
    const last  = new Date(year, month + 1, 0)
    const days  = []
    // 前月の空白
    for (let i = 0; i < first.getDay(); i++) days.push(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }

  function countAppts(date) {
    if (!date) return 0
    const str = toLocalDateStr(date)
    return monthAppts.filter(a => a.appointment_date.substring(0,10) === str && a.status === 'confirmed').length
  }

  function isToday(date) {
    if (!date) return false
    return toLocalDateStr(date) === toLocalDateStr(new Date())
  }

  function isSelected(date) {
    if (!date) return false
    return toLocalDateStr(date) === toLocalDateStr(selectedDate)
  }

  // ── 日別グリッドの計算 ────────────────────────────────────
  const columns = groupBy === 'chair'
    ? chairs.filter(c => c.is_active)
    : staff

  function getAppt(colId, time) {
    return appointments.filter(a => {
      const col = groupBy === 'chair' ? a.chair_id : a.staff_id
      return col === colId && a.start_time.substring(0,5) === time && a.status !== 'cancelled'
    })
  }

  function slotHeight(duration) {
    return Math.max(1, Math.round(duration / 30)) * 40
  }

  // 各列の予約をtime→apptのマップに変換（重複スキップ用）
  function buildColMap(colId) {
    const map = {}
    const occupied = new Set()
    appointments
      .filter(a => {
        const col = groupBy === 'chair' ? a.chair_id : a.staff_id
        return col === colId && a.status !== 'cancelled'
      })
      .sort((a, b) => (a.start_time||'').localeCompare(b.start_time||''))
      .forEach(appt => {
        const start = (appt.start_time || '').substring(0,5)
        const slots = Math.ceil((appt.treatment_duration || 30) / 30)
        const startIdx = HOURS.indexOf(start)
        if (startIdx === -1) return
        for (let i = 0; i < slots; i++) {
          if (HOURS[startIdx + i]) occupied.add(HOURS[startIdx + i])
        }
        map[start] = appt
      })
    return { map, occupied }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Noto Sans JP", sans-serif' }}>

      {/* ── 左パネル：月間カレンダー ── */}
      <div style={{
        width: 280, flexShrink: 0, borderRight: '1px solid #e5e7eb',
        background: '#fafafa', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* 月ナビ */}
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6b7280' }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>
              {viewMonth.getFullYear()}年{viewMonth.getMonth()+1}月
            </span>
            <button
              onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6b7280' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {/* 曜日ヘッダー */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {DOW.map((d, i) => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '2px 0',
                color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#9ca3af'
              }}>{d}</div>
            ))}
          </div>
          {/* 日付グリッド */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {getMonthDays().map((date, idx) => {
              const count = countAppts(date)
              const _today    = date && isToday(date)
              const _selected = date && isSelected(date)
              return (
                <div
                  key={idx}
                  onClick={() => date && setSelectedDate(date)}
                  style={{
                    textAlign: 'center', padding: '3px 0', borderRadius: 8,
                    cursor: date ? 'pointer' : 'default',
                    background: _selected ? '#2563eb' : _today ? '#eff6ff' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {date && (
                    <>
                      <div style={{
                        fontSize: 13, lineHeight: 1.4,
                        color: _selected ? '#fff' : _today ? '#2563eb'
                          : date.getDay() === 0 ? '#ef4444'
                          : date.getDay() === 6 ? '#3b82f6' : '#374151',
                        fontWeight: _today || _selected ? 700 : 400,
                      }}>{date.getDate()}</div>
                      {count > 0 && (
                        <div style={{
                          fontSize: 9, lineHeight: 1,
                          color: _selected ? 'rgba(255,255,255,0.8)' : '#2563eb',
                          fontWeight: 600,
                        }}>{count}件</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 選択日の予約サマリー */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
            {selectedDate.getMonth()+1}月{selectedDate.getDate()}日の予約
          </div>
          {appointments.filter(a => a.status === 'confirmed').length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingTop: 16 }}>予約なし</div>
          ) : appointments.filter(a => a.status === 'confirmed').map(a => (
            <div
              key={a.id}
              onClick={() => setSelected(a)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
                borderLeft: `3px solid ${STATUS_COLOR[a.status]?.border || '#93c5fd'}`,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: '#1f2937' }}>{a.patient_name}</div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>
                {a.start_time.substring(0,5)}〜 {a.treatment_name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 右パネル：日別タイムライン ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* ヘッダー */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n })}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', minWidth: 200, textAlign: 'center' }}>
              {selectedDate.getFullYear()}年{selectedDate.getMonth()+1}月{selectedDate.getDate()}日（{DOW[selectedDate.getDay()]}）
            </span>
            <button
              onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n })}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => { const t = new Date(); setSelectedDate(t); setViewMonth(t) }}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer', color: '#374151' }}
            >今日</button>
          </div>

          {/* 切り替えタブ */}
          <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            {[
              { key: 'chair', label: 'チェア別', icon: <Calendar size={14} /> },
              { key: 'staff', label: 'ドクター別', icon: <User size={14} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setGroupBy(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  background: groupBy === tab.key ? '#fff' : 'transparent',
                  color: groupBy === tab.key ? '#2563eb' : '#6b7280',
                  boxShadow: groupBy === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >{tab.icon}{tab.label}</button>
            ))}
          </div>
        </div>

        {/* タイムライングリッド */}
        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
            読み込み中...
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 56 }} />
                {columns.map(c => <col key={c.id} />)}
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
                <tr>
                  <th style={{ padding: '8px 4px', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>時間</th>
                  {columns.map(col => (
                    <th key={col.id} style={{
                      padding: '8px 12px', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
                      fontSize: 13, fontWeight: 600, color: '#1f2937', textAlign: 'center',
                      background: '#fff',
                    }}>
                      {col.name}
                      {groupBy === 'staff' && col.title && (
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{col.title}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((time, timeIdx) => {
                  const isHour = time.endsWith(':00')
                  return (
                    <tr key={time} style={{ height: 40 }}>
                      <td style={{
                        padding: '0 6px', borderBottom: '1px solid #f3f4f6',
                        borderRight: '1px solid #e5e7eb', verticalAlign: 'top',
                        fontSize: 11, color: '#9ca3af', textAlign: 'right', paddingTop: 2,
                        background: isHour ? '#fafafa' : '#fff',
                        fontWeight: isHour ? 600 : 400,
                      }}>
                        {isHour ? time : ''}
                      </td>
                      {columns.map(col => {
                        const { map, occupied } = buildColMap(col.id)
                        const appt = map[time]
                        // このスロットが別の予約に占有されている場合はスキップ
                        if (!appt && occupied.has(time) && timeIdx > 0) return null
                        if (appt) {
                          const h = slotHeight(appt.treatment_duration)
                          const color = STATUS_COLOR[appt.status] || STATUS_COLOR.confirmed
                          const slots = Math.ceil(appt.treatment_duration / 30)
                          return (
                            <td
                              key={col.id}
                              rowSpan={slots}
                              style={{
                                padding: 4, borderBottom: '1px solid #f3f4f6',
                                borderRight: '1px solid #e5e7eb', verticalAlign: 'top',
                                background: isHour ? '#fafafa' : '#fff',
                              }}
                            >
                              <div
                                onClick={() => setSelected(appt)}
                                style={{
                                  background: color.bg, border: `1px solid ${color.border}`,
                                  borderLeft: `3px solid ${color.border}`,
                                  borderRadius: 6, padding: '4px 8px',
                                  cursor: 'pointer', height: h - 10,
                                  overflow: 'hidden', fontSize: 12,
                                  transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                              >
                                <div style={{ fontWeight: 600, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {appt.patient_name}
                                </div>
                                <div style={{ color: color.text, opacity: 0.8, fontSize: 11, marginTop: 2 }}>
                                  {appt.treatment_name}
                                </div>
                                <div style={{ color: color.text, opacity: 0.7, fontSize: 11 }}>
                                  {appt.start_time.substring(0,5)}〜{appt.end_time.substring(0,5)}
                                </div>
                              </div>
                            </td>
                          )
                        }
                        return (
                          <td key={col.id} style={{
                            borderBottom: '1px solid #f3f4f6',
                            borderRight: '1px solid #e5e7eb',
                            background: isHour ? '#fafafa' : '#fff',
                          }} />
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 予約詳細モーダル */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24, width: 380 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>予約詳細</span>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              {[
                ['患者名', selected.patient_name],
                ['患者番号', selected.patient_code],
                ['治療', selected.treatment_name],
                ['担当', selected.staff_name],
                ['チェア', selected.chair_name],
                ['時間', `${selected.start_time.substring(0,5)}〜${selected.end_time.substring(0,5)}`],
                ['予約元', selected.source === 'line' ? 'LINE' : selected.source === 'staff' ? '院内' : selected.source],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ fontWeight: 500, color: '#1f2937' }}>{value || '-'}</span>
                </div>
              ))}
              {selected.notes && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151' }}>
                  {selected.notes}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setSelected(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151' }}
              >閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
