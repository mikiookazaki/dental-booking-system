// frontend/src/pages/admin/AdminDashboard.jsx
import { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const API = import.meta.env.VITE_API_URL || ''
function authHeader() {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

const TREATMENT_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#065f46']

const AGE_COLORS = {
  '10代':'#818cf8','20代':'#38bdf8','30代':'#34d399','40代':'#a3e635',
  '50代':'#fbbf24','60代':'#fb923c','70代':'#f87171','80代':'#c084fc',
  '90代以上':'#94a3b8','不明':'#d1d5db',
}

// ── Chart.js ドーナツ（年代別） ───────────────────────────
function AgeDonutChart({ data }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    inst.current?.destroy()
    const filtered = data.filter(d => d.age_group !== '不明' && parseInt(d.count) > 0)
    inst.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: filtered.map(d => d.age_group),
        datasets: [{
          data: filtered.map(d => parseInt(d.count)),
          backgroundColor: filtered.map(d => AGE_COLORS[d.age_group] || '#94a3b8'),
          borderWidth: 2, borderColor: '#fff',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a,b)=>a+b,0)
                return ` ${ctx.label}: ${ctx.raw}名 (${Math.round(ctx.raw/total*100)}%)`
              }
            }
          }
        }
      }
    })
    return () => inst.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

// ── Chart.js 横棒（年代×性別） ────────────────────────────
function AgeGenderChart({ data }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    inst.current?.destroy()
    const filtered = data.filter(d => d.age_group !== '不明')
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: filtered.map(d => d.age_group),
        datasets: [
          { label: '男性', data: filtered.map(d => parseInt(d.male||0)),   backgroundColor: '#93c5fd', borderRadius: 3 },
          { label: '女性', data: filtered.map(d => parseInt(d.female||0)), backgroundColor: '#f9a8d4', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
        scales: {
          x: { stacked: true, grid: { color: '#f3f4f6' } },
          y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        }
      }
    })
    return () => inst.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

// ── Chart.js 積み上げ棒（月別予約） ──────────────────────
function MonthlyChart({ data }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current || !data?.length) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map(d => {
          const [y, m] = d.month.split('-')
          return `${m}月`
        }),
        datasets: [
          { label: 'LINE',    data: data.map(d => parseInt(d.line||0)),  backgroundColor: '#3b82f6', borderRadius: 3 },
          { label: '電話',    data: data.map(d => parseInt(d.phone||0)), backgroundColor: '#10b981', borderRadius: 3 },
          { label: 'スタッフ', data: data.map(d => parseInt(d.staff||0)), backgroundColor: '#f59e0b', borderRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, grid: { color: '#f3f4f6' } },
        }
      }
    })
    return () => inst.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

// ── Chart.js 棒（曜日別） ─────────────────────────────────
function DowChart({ data }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    const DOW = ['日','月','火','水','木','金','土']
    const counts = Array(7).fill(0)
    data?.forEach(d => { counts[parseInt(d.dow)] = parseInt(d.count) })
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: DOW,
        datasets: [{ data: counts, backgroundColor: counts.map((_,i) => i===0?'#fca5a5':i===6?'#93c5fd':'#6ee7b7'), borderRadius: 5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f3f4f6' } },
        }
      }
    })
    return () => inst.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

// ── Chart.js 棒（時間帯別） ───────────────────────────────
function HourChart({ data }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    const map = {}
    data?.forEach(d => { map[parseInt(d.hour)] = parseInt(d.count) })
    const hours = Array.from({length:12},(_,i)=>i+8)
    const vals  = hours.map(h => map[h]||0)
    const maxV  = Math.max(...vals, 1)
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: hours.map(h=>`${h}時`),
        datasets: [{ data: vals, backgroundColor: vals.map(v=>v===maxV&&maxV>0?'#f59e0b':'#a5b4fc'), borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: '#f3f4f6' } },
        }
      }
    })
    return () => inst.current?.destroy()
  }, [data])
  return <canvas ref={ref} />
}

// ── 年代×治療クロス集計テーブル ──────────────────────────
function CrossTable({ data }) {
  if (!data?.length) return <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center' }}>データなし（予約データが蓄積されると表示されます）</p>

  const ageOrder  = ['10代','20代','30代','40代','50代','60代','70代','80代','90代以上','不明']
  const ageGroups = ageOrder.filter(ag => data.some(d => d.age_group === ag))
  const treatments = [...new Set(data.map(d => d.treatment))].slice(0,8)
  const map = {}
  data.forEach(d => { map[`${d.age_group}::${d.treatment}`] = parseInt(d.count) })
  const maxVal = Math.max(...data.map(d => parseInt(d.count)), 1)

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'#f9fafb' }}>
            <th style={{ padding:'8px 12px', textAlign:'left', color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>年代</th>
            {treatments.map(t => (
              <th key={t} style={{ padding:'8px 8px', textAlign:'center', color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap', fontSize:11 }}>
                {t}
              </th>
            ))}
            <th style={{ padding:'8px 8px', textAlign:'center', color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb' }}>合計</th>
          </tr>
        </thead>
        <tbody>
          {ageGroups.map((ag, ri) => {
            const rowTotal = treatments.reduce((s,t) => s + (map[`${ag}::${t}`]||0), 0)
            return (
              <tr key={ag} style={{ borderBottom:'1px solid #f3f4f6', background: ri%2===0?'#fff':'#fafafa' }}>
                <td style={{ padding:'7px 12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>
                  <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:AGE_COLORS[ag]||'#94a3b8', marginRight:6 }} />
                  {ag}
                </td>
                {treatments.map(t => {
                  const val = map[`${ag}::${t}`]||0
                  const intensity = val / maxVal
                  return (
                    <td key={t} style={{ padding:'7px 8px', textAlign:'center' }}>
                      {val > 0 ? (
                        <span style={{
                          display:'inline-block', minWidth:28, padding:'2px 6px',
                          borderRadius:6, fontSize:11, fontWeight:600,
                          background: `rgba(99,102,241,${0.08 + intensity*0.72})`,
                          color: intensity > 0.4 ? '#3730a3' : '#6366f1',
                        }}>{val}</span>
                      ) : <span style={{ color:'#e5e7eb' }}>-</span>}
                    </td>
                  )
                })}
                <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#374151', fontSize:12 }}>{rowTotal}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── メインダッシュボード ──────────────────────────────────
export default function AdminDashboard() {
  const now = new Date()
  const [month, setMonth]     = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [data, setData]       = useState(null)
  const [ageData, setAgeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ageLoading, setAgeLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'age'

  useEffect(() => { fetchData() }, [month])
  useEffect(() => { fetchAgeData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/dashboard?month=${month}`, { headers: authHeader() })
      setData(await res.json())
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function fetchAgeData() {
    setAgeLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API}/api/analytics/age`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAgeData(await res.json())
    } catch (err) { console.error(err) }
    setAgeLoading(false)
  }

  function handleExport(type) {
    window.open(`${API}/api/admin/export/csv?month=${month}&type=${type}&token=${localStorage.getItem('admin_token')}`)
  }

  const cancelRate = data?.summary
    ? Math.round((Number(data.summary.cancelled) / Math.max(Number(data.summary.total), 1)) * 100)
    : 0
  const workDays = 22
  const maxMinutes = workDays * 9 * 60

  const totalPatients = ageData?.ageGroups?.reduce((s,d) => s+parseInt(d.count),0) || 0
  const unknownCount  = ageData?.ageGroups?.find(d=>d.age_group==='不明')?.count || 0
  const lineLinked    = parseInt(ageData?.lineStats?.linked || 0)
  const lineTotal     = parseInt(ageData?.lineStats?.total  || 0)
  const lineRate      = lineTotal > 0 ? Math.round(lineLinked / lineTotal * 100) : 0
  const monthTrend    = (ageData?.lastMonthAppts || 0) > 0
    ? Math.round(((ageData.thisMonthAppts||0) - ageData.lastMonthAppts) / ageData.lastMonthAppts * 100)
    : null

  const cardStyle = { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }
  const sectionTitle = { fontSize:15, fontWeight:700, color:'#1f2937', marginTop:0, marginBottom:12 }

  return (
    <div style={{ padding:24, background:'#f9fafb', minHeight:'100vh', fontFamily:'"Noto Sans JP",sans-serif' }}>

      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827', margin:0 }}>経営ダッシュボード</h1>
          <p style={{ fontSize:13, color:'#6b7280', margin:'3px 0 0' }}>月次集計・患者分析</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13 }} />
          <button onClick={()=>handleExport('appointments')}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', fontSize:12, cursor:'pointer' }}>
            <Download size={13} />予約CSV
          </button>
          <button onClick={()=>handleExport('patients')}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', fontSize:12, cursor:'pointer' }}>
            <Download size={13} />患者CSV
          </button>
        </div>
      </div>

      {/* タブ切替 */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #e5e7eb' }}>
        {[['overview','📋 月次概要'], ['age','📊 年代分析']].map(([v, label]) => (
          <button key={v} onClick={()=>setActiveTab(v)}
            style={{
              padding:'8px 18px', fontSize:13, fontWeight:600, border:'none', cursor:'pointer',
              background:'transparent', borderBottom: activeTab===v ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab===v ? '#3b82f6' : '#6b7280', marginBottom:-2,
            }}>{label}</button>
        ))}
      </div>

      {/* ── タブ1: 月次概要（既存） ── */}
      {activeTab === 'overview' && (
        loading ? <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>読み込み中...</div>
        : !data ? null : (
          <>
            {/* KPIカード */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
              {[
                { label:'総予約数',     value:data.summary.total, color:'#2563eb', bg:'#eff6ff' },
                { label:'完了・確定',   value:Number(data.summary.confirmed)+Number(data.summary.completed), color:'#059669', bg:'#f0fdf4' },
                { label:'キャンセル数', value:data.summary.cancelled, color:'#dc2626', bg:'#fef2f2' },
                { label:'キャンセル率', value:`${cancelRate}%`, color:'#d97706', bg:'#fffbeb' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:kpi.bg, borderRadius:12, padding:'18px 20px', border:`1px solid ${kpi.color}22` }}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{kpi.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              {/* 治療別件数 */}
              <div style={cardStyle}>
                <h2 style={sectionTitle}>治療別件数</h2>
                {data.byTreatment.length === 0
                  ? <p style={{ color:'#9ca3af', fontSize:13 }}>データなし</p>
                  : data.byTreatment.map((t,i) => {
                    const max = Math.max(...data.byTreatment.map(x=>Number(x.count)))
                    const pct = max>0 ? (Number(t.count)/max)*100 : 0
                    return (
                      <div key={t.name} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'#374151' }}>{t.name}</span>
                          <span style={{ fontWeight:600, color:'#1f2937' }}>{t.count}件</span>
                        </div>
                        <div style={{ height:7, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:t.color||TREATMENT_COLORS[i%TREATMENT_COLORS.length], borderRadius:4, transition:'width 0.4s' }} />
                        </div>
                      </div>
                    )
                  })
                }
              </div>

              {/* スタッフ別ランキング */}
              <div style={cardStyle}>
                <h2 style={sectionTitle}>スタッフ別ランキング</h2>
                {data.byStaff.length === 0
                  ? <p style={{ color:'#9ca3af', fontSize:13 }}>データなし</p>
                  : data.byStaff.map((s,i) => (
                    <div key={s.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{
                        width:26, height:26, borderRadius:'50%', flexShrink:0,
                        background: i===0?'#fbbf24':i===1?'#d1d5db':i===2?'#d97706':'#f3f4f6',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:'#1f2937',
                      }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ fontWeight:500, color:'#1f2937' }}>{s.name}</span>
                          <span style={{ color:'#6b7280' }}>{s.count}件</span>
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>
                          {s.role} ／ キャンセル {s.cancelled}件 ／ {Math.round(Number(s.total_minutes||0)/60)}時間
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* チェア稼働率 */}
            <div style={{ ...cardStyle, marginBottom:16 }}>
              <h2 style={sectionTitle}>チェア稼働率</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }}>
                {data.byChair.map(c => {
                  const pct = Math.min(100, Math.round((Number(c.total_minutes||0)/maxMinutes)*100))
                  const color = pct>=70?'#059669':pct>=40?'#d97706':'#9ca3af'
                  return (
                    <div key={c.name} style={{ textAlign:'center' }}>
                      <svg width="80" height="80" viewBox="0 0 80 80" style={{ display:'block', margin:'0 auto 8px' }}>
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
                          strokeDasharray={`${pct*2.01} 201`} strokeLinecap="round"
                          transform="rotate(-90 40 40)" style={{ transition:'stroke-dasharray 0.5s' }} />
                        <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{pct}%</text>
                      </svg>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{c.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{c.count}件</div>
                    </div>
                  )
                })}
                {data.byChair.length===0 && <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#9ca3af', fontSize:13 }}>データなし</div>}
              </div>
            </div>

            {/* 日別予約数 */}
            <div style={cardStyle}>
              <h2 style={sectionTitle}>日別予約数</h2>
              <div style={{ display:'flex', gap:3, alignItems:'flex-end', flexWrap:'wrap' }}>
                {data.byDay.map(d => {
                  const cnt = Number(d.count)
                  const max = Math.max(...data.byDay.map(x=>Number(x.count)),1)
                  const h   = Math.max(4, (cnt/max)*72)
                  return (
                    <div key={d.date} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:18 }} title={`${d.date}: ${cnt}件`}>
                      <div style={{ width:16, height:h, background:cnt>0?'#3b82f6':'#f3f4f6', borderRadius:'3px 3px 0 0', transition:'height 0.3s' }} />
                      <div style={{ fontSize:9, color:'#9ca3af' }}>{new Date(d.date+'T00:00:00').getDate()}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )
      )}

      {/* ── タブ2: 年代分析 ── */}
      {activeTab === 'age' && (
        ageLoading ? <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>読み込み中...</div>
        : !ageData ? null : (
          <>
            {/* 年代KPIカード */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
              {[
                { label:'患者総数',       value:`${totalPatients}名`, color:'#3b82f6', bg:'#eff6ff',
                  sub:`今月新規: ${ageData.newPatientsMonth}名` },
                { label:'今月の予約',     value:`${ageData.thisMonthAppts}件`, color:'#10b981', bg:'#f0fdf4',
                  sub: monthTrend!==null ? `先月比: ${monthTrend>0?'▲':'▼'}${Math.abs(monthTrend)}%` : '先月比: -' },
                { label:'LINE連携率',     value:`${lineRate}%`, color:'#06b6d4', bg:'#ecfeff',
                  sub:`${lineLinked}/${lineTotal}名` },
                { label:'年代未登録',     value:`${unknownCount}名`, color:'#f59e0b', bg:'#fffbeb',
                  sub:'登録促進が必要' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:kpi.bg, borderRadius:12, padding:'18px 20px', border:`1px solid ${kpi.color}22` }}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{kpi.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:kpi.color }}>{kpi.value}</div>
                  {kpi.sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>{kpi.sub}</div>}
                </div>
              ))}
            </div>

            {/* 年代ドーナツ + 性別横棒 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div style={cardStyle}>
                <h2 style={sectionTitle}>年代別患者構成</h2>
                <div style={{ height:220 }}><AgeDonutChart data={ageData.ageGroups} /></div>
              </div>
              <div style={cardStyle}>
                <h2 style={sectionTitle}>年代 × 性別</h2>
                <div style={{ height:220 }}><AgeGenderChart data={ageData.ageGroups} /></div>
              </div>
            </div>

            {/* 年代バッジ一覧 */}
            <div style={{ ...cardStyle, marginBottom:16 }}>
              <h2 style={sectionTitle}>年代別内訳</h2>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {ageData.ageGroups.filter(d=>d.age_group!=='不明' && parseInt(d.count)>0).map(d => {
                  const pct = totalPatients > 0 ? Math.round(parseInt(d.count)/totalPatients*100) : 0
                  const bar = totalPatients > 0 ? (parseInt(d.count)/totalPatients*100) : 0
                  return (
                    <div key={d.age_group} style={{ flex:'1 1 180px', background:'#f9fafb', borderRadius:10, padding:'12px 14px', border:'1px solid #e5e7eb' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:AGE_COLORS[d.age_group]||'#94a3b8', flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{d.age_group}</span>
                        <span style={{ marginLeft:'auto', fontSize:13, fontWeight:700, color:'#1f2937' }}>{d.count}名</span>
                        <span style={{ fontSize:11, color:'#6b7280' }}>{pct}%</span>
                      </div>
                      <div style={{ background:'#e5e7eb', borderRadius:4, height:5, overflow:'hidden' }}>
                        <div style={{ width:`${bar}%`, height:5, borderRadius:4, background:AGE_COLORS[d.age_group]||'#94a3b8', transition:'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>
                        男{d.male||0}名 ／ 女{d.female||0}名
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 月別予約数（経路別）*/}
            <div style={{ ...cardStyle, marginBottom:16 }}>
              <h2 style={sectionTitle}>月別予約数（予約経路別・過去12ヶ月）</h2>
              <div style={{ height:200 }}><MonthlyChart data={ageData.monthly} /></div>
            </div>

            {/* 曜日・時間帯 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div style={cardStyle}>
                <h2 style={sectionTitle}>曜日別予約傾向</h2>
                <p style={{ fontSize:11, color:'#9ca3af', margin:'-8px 0 10px' }}>過去3ヶ月</p>
                <div style={{ height:150 }}><DowChart data={ageData.dowStats} /></div>
              </div>
              <div style={cardStyle}>
                <h2 style={sectionTitle}>時間帯別予約傾向</h2>
                <p style={{ fontSize:11, color:'#9ca3af', margin:'-8px 0 10px' }}>過去3ヶ月（🟡最多時間帯）</p>
                <div style={{ height:150 }}><HourChart data={ageData.hourStats} /></div>
              </div>
            </div>

            {/* 年代×治療クロス集計 */}
            <div style={cardStyle}>
              <h2 style={sectionTitle}>年代 × 治療種別（過去6ヶ月）</h2>
              <p style={{ fontSize:11, color:'#9ca3af', margin:'-8px 0 14px' }}>色が濃いほど件数が多い。データが蓄積されるにつれて精度が上がります。</p>
              <CrossTable data={ageData.crossTab} />
            </div>
          </>
        )
      )}
    </div>
  )
}
