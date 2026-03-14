// frontend/src/pages/admin/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
function authHeader() {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}` }
}

const TREATMENT_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#065f46']

export default function AdminDashboard() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [month])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/dashboard?month=${month}`, { headers: authHeader() })
      const d   = await res.json()
      setData(d)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function handleExport(type) {
    window.open(`${API}/api/admin/export/csv?month=${month}&type=${type}&token=${localStorage.getItem('admin_token')}`)
  }

  const cancelRate = data?.summary
    ? Math.round((Number(data.summary.cancelled) / Math.max(Number(data.summary.total), 1)) * 100)
    : 0

  // チェア稼働率（月の診療日数×営業時間9h=540分を基準）
  const workDays = 22
  const maxMinutes = workDays * 9 * 60

  return (
    <div style={{ padding: 32, fontFamily: '"Noto Sans JP", sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>経営ダッシュボード</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>月次集計・分析</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
          />
          <button onClick={() => handleExport('appointments')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} />予約CSV
          </button>
          <button onClick={() => handleExport('patients')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} />患者CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>読み込み中...</div>
      ) : !data ? null : (
        <>
          {/* KPIカード */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: '総予約数',       value: data.summary.total,     color: '#2563eb', bg: '#eff6ff' },
              { label: '完了・確定',     value: Number(data.summary.confirmed) + Number(data.summary.completed), color: '#059669', bg: '#f0fdf4' },
              { label: 'キャンセル数',   value: data.summary.cancelled, color: '#dc2626', bg: '#fef2f2' },
              { label: 'キャンセル率',   value: `${cancelRate}%`,       color: '#d97706', bg: '#fffbeb' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: kpi.bg, borderRadius: 12, padding: '20px 24px', border: `1px solid ${kpi.color}22` }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* 治療別件数 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginTop: 0, marginBottom: 16 }}>治療別件数</h2>
              {data.byTreatment.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>データなし</p>
              ) : data.byTreatment.map((t, i) => {
                const max = Math.max(...data.byTreatment.map(x => Number(x.count)))
                const pct = max > 0 ? (Number(t.count) / max) * 100 : 0
                return (
                  <div key={t.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>{t.name}</span>
                      <span style={{ fontWeight: 600, color: '#1f2937' }}>{t.count}件</span>
                    </div>
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: t.color || TREATMENT_COLORS[i % TREATMENT_COLORS.length], borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ドクター・スタッフ別ランキング */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginTop: 0, marginBottom: 16 }}>スタッフ別ランキング</h2>
              {data.byStaff.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>データなし</p>
              ) : data.byStaff.map((s, i) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#d97706' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#1f2937',
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 500, color: '#1f2937' }}>{s.name}</span>
                      <span style={{ color: '#6b7280' }}>{s.count}件</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {s.role} ／ キャンセル {s.cancelled}件 ／ {Math.round(Number(s.total_minutes||0)/60)}時間
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* チェア稼働率 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginTop: 0, marginBottom: 16 }}>チェア稼働率</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
              {data.byChair.map((c, i) => {
                const pct = Math.min(100, Math.round((Number(c.total_minutes || 0) / maxMinutes) * 100))
                const color = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#9ca3af'
                return (
                  <div key={c.name} style={{ textAlign: 'center' }}>
                    {/* 円グラフ風 */}
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block', margin: '0 auto 8px' }}>
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
                        strokeDasharray={`${pct * 2.01} 201`}
                        strokeLinecap="round"
                        transform="rotate(-90 40 40)"
                        style={{ transition: 'stroke-dasharray 0.5s' }}
                      />
                      <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{pct}%</text>
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.count}件</div>
                  </div>
                )
              })}
              {data.byChair.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>データなし</div>
              )}
            </div>
          </div>

          {/* 日別予約数 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginTop: 0, marginBottom: 16 }}>日別予約数</h2>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {data.byDay.map(d => {
                const cnt = Number(d.count)
                const max = Math.max(...data.byDay.map(x => Number(x.count)), 1)
                const h   = Math.max(4, (cnt / max) * 80)
                return (
                  <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 20 }} title={`${d.date}: ${cnt}件`}>
                    <div style={{ width: 18, height: h, background: cnt > 0 ? '#2563eb' : '#f3f4f6', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(d.date + 'T00:00:00').getDate()}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
