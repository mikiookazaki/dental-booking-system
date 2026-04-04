// frontend/src/pages/admin/AdminDashboard.jsx
import { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const API = import.meta.env.VITE_API_URL || ''
function authHeader() {
  const token    = localStorage.getItem('admin_token')
  const testMode = localStorage.getItem('test_mode')
  const headers  = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (testMode === 'true') headers['x-test-mode'] = 'true'
  return headers
}

const TREATMENT_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#065f46']

const AGE_COLORS = {
  '10代':'#818cf8','20代':'#38bdf8','30代':'#34d399','40代':'#a3e635',
  '50代':'#fbbf24','60代':'#fb923c','70代':'#f87171','80代':'#c084fc',
  '90代以上':'#94a3b8','不明':'#d1d5db',
}

// 郵便番号 → 座標マッピング（渋谷区・新宿区・港区・世田谷区など周辺エリア）
const POSTAL_COORDS = {
  // 渋谷区
  '150-0001': { lat:35.6580, lng:139.7016, area:'渋谷' },
  '150-0002': { lat:35.6617, lng:139.6995, area:'渋谷（代々木）' },
  '150-0011': { lat:35.6471, lng:139.6983, area:'東' },
  '150-0012': { lat:35.6512, lng:139.6934, area:'広尾' },
  '150-0013': { lat:35.6490, lng:139.7059, area:'恵比寿' },
  '150-0021': { lat:35.6641, lng:139.6944, area:'恵比寿西' },
  '150-0022': { lat:35.6627, lng:139.6894, area:'恵比寿南' },
  '150-0031': { lat:35.6552, lng:139.7095, area:'桜丘町' },
  '150-0032': { lat:35.6584, lng:139.7038, area:'鶯谷町' },
  '150-0033': { lat:35.6601, lng:139.6975, area:'猿楽町' },
  '150-0034': { lat:35.6535, lng:139.6960, area:'代官山町' },
  '150-0035': { lat:35.6516, lng:139.7010, area:'鉢山町' },
  '150-0036': { lat:35.6490, lng:139.6990, area:'南平台町' },
  '150-0041': { lat:35.6638, lng:139.7097, area:'神南' },
  '150-0042': { lat:35.6617, lng:139.7066, area:'宇田川町' },
  '150-0043': { lat:35.6603, lng:139.6985, area:'道玄坂' },
  '150-0044': { lat:35.6559, lng:139.7003, area:'円山町' },
  '150-0045': { lat:35.6570, lng:139.7052, area:'神泉町' },
  '150-0046': { lat:35.6540, lng:139.7030, area:'松濤' },
  '150-0047': { lat:35.6521, lng:139.6978, area:'神山町' },
  // 代々木・新宿区
  '151-0051': { lat:35.6828, lng:139.6921, area:'代々木' },
  '151-0052': { lat:35.6786, lng:139.6940, area:'代々木（富ヶ谷）' },
  '151-0053': { lat:35.6747, lng:139.6960, area:'代々木（元代々木）' },
  '151-0061': { lat:35.6735, lng:139.7012, area:'初台' },
  '151-0062': { lat:35.6760, lng:139.6980, area:'元代々木町' },
  '151-0063': { lat:35.6800, lng:139.6950, area:'富ヶ谷' },
  '151-0064': { lat:35.6720, lng:139.6935, area:'上原' },
  '151-0065': { lat:35.6695, lng:139.6970, area:'大山町' },
  '151-0066': { lat:35.6678, lng:139.6948, area:'西原' },
  '151-0071': { lat:35.6660, lng:139.6920, area:'本町' },
  '151-0072': { lat:35.6642, lng:139.6905, area:'幡ヶ谷' },
  '151-0073': { lat:35.6623, lng:139.6888, area:'笹塚' },
  // 新宿区
  '160-0004': { lat:35.6960, lng:139.7202, area:'四谷' },
  '160-0011': { lat:35.6897, lng:139.7093, area:'若葉' },
  '160-0012': { lat:35.6920, lng:139.7050, area:'南元町' },
  '160-0021': { lat:35.6877, lng:139.7025, area:'歌舞伎町' },
  '160-0022': { lat:35.6836, lng:139.7006, area:'新宿' },
  '160-0023': { lat:35.6920, lng:139.7000, area:'西新宿' },
  // 港区
  '106-0032': { lat:35.6606, lng:139.7297, area:'六本木' },
  '107-0062': { lat:35.6695, lng:139.7305, area:'南青山' },
  '107-0061': { lat:35.6718, lng:139.7172, area:'北青山' },
  // 目黒区
  '153-0042': { lat:35.6400, lng:139.6979, area:'青葉台' },
  '153-0051': { lat:35.6372, lng:139.7020, area:'上目黒' },
  '153-0061': { lat:35.6344, lng:139.6991, area:'中目黒' },
  '153-0062': { lat:35.6315, lng:139.6975, area:'目黒本町' },
  // 世田谷区
  '154-0001': { lat:35.6474, lng:139.6821, area:'池尻' },
  '154-0002': { lat:35.6450, lng:139.6781, area:'下馬' },
  '154-0003': { lat:35.6430, lng:139.6740, area:'野沢' },
  '154-0004': { lat:35.6409, lng:139.6700, area:'太子堂' },
  '154-0005': { lat:35.6389, lng:139.6660, area:'三宿' },
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

// ============================================================
// ツリーマップ（SVGで実装）
// ============================================================
function ReferralTreeMap({ data, total, colors }) {
  if (!data?.length) return <div style={{ color:'#9ca3af', textAlign:'center', padding:40 }}>データなし</div>

  const W = 560, H = 280, GAP = 3

  // 横分割ツリーマップ（上位2件を左右に、残りを右側で縦分割）
  function buildLayout(items, x, y, w, h) {
    if (!items.length) return []
    if (items.length === 1) return [{ ...items[0], x, y, w, h }]

    const totalVal = items.reduce((s, d) => s + d.val, 0)
    const result = []

    // 横幅が高さより大きい場合は横分割、そうでなければ縦分割
    const isWide = w >= h

    if (isWide) {
      // 横に分割
      let cursor = x
      items.forEach((item, i) => {
        const iw = (item.val / totalVal) * w
        result.push({ ...item, x: cursor, y, w: iw, h })
        cursor += iw
      })
    } else {
      // 縦に分割
      let cursor = y
      items.forEach((item, i) => {
        const ih = (item.val / totalVal) * h
        result.push({ ...item, x, y: cursor, w, h: ih })
        cursor += ih
      })
    }
    return result
  }

  // Squarify的な2段階レイアウト
  function squarifyLayout(items, x, y, w, h) {
    if (!items.length) return []
    if (items.length === 1) return [{ ...items[0], x, y, w, h }]
    if (items.length === 2) {
      const total = items[0].val + items[1].val
      if (w >= h) {
        const w0 = w * items[0].val / total
        return [
          { ...items[0], x, y, w: w0, h },
          { ...items[1], x: x + w0, y, w: w - w0, h },
        ]
      } else {
        const h0 = h * items[0].val / total
        return [
          { ...items[0], x, y, w, h: h0 },
          { ...items[1], x, y: y + h0, w, h: h - h0 },
        ]
      }
    }

    const totalVal = items.reduce((s, d) => s + d.val, 0)

    // 最良の分割点を探す（アスペクト比が最小になる分割）
    let bestScore = Infinity
    let bestSplit = 1

    for (let k = 1; k < items.length; k++) {
      const aVal = items.slice(0, k).reduce((s, d) => s + d.val, 0)
      const bVal = totalVal - aVal
      const aFrac = aVal / totalVal
      const bFrac = bVal / totalVal

      let score
      if (w >= h) {
        const aw = w * aFrac, bw = w * bFrac
        const aWorst = items.slice(0, k).reduce((mx, d) => {
          const iw = (d.val / aVal) * aw
          return Math.max(mx, Math.max(iw / h, h / iw))
        }, 0)
        const bWorst = items.slice(k).reduce((mx, d) => {
          const iw = (d.val / bVal) * bw
          return Math.max(mx, Math.max(iw / h, h / iw))
        }, 0)
        score = Math.max(aWorst, bWorst)
      } else {
        const ah = h * aFrac, bh = h * bFrac
        const aWorst = items.slice(0, k).reduce((mx, d) => {
          const ih = (d.val / aVal) * ah
          return Math.max(mx, Math.max(w / ih, ih / w))
        }, 0)
        const bWorst = items.slice(k).reduce((mx, d) => {
          const ih = (d.val / bVal) * bh
          return Math.max(mx, Math.max(w / ih, ih / w))
        }, 0)
        score = Math.max(aWorst, bWorst)
      }
      if (score < bestScore) { bestScore = score; bestSplit = k }
    }

    const aItems = items.slice(0, bestSplit)
    const bItems = items.slice(bestSplit)
    const aVal = aItems.reduce((s, d) => s + d.val, 0)
    const aFrac = aVal / totalVal

    if (w >= h) {
      const aw = w * aFrac
      return [
        ...buildLayout(aItems, x, y, aw, h),
        ...buildLayout(bItems, x + aw, y, w - aw, h),
      ]
    } else {
      const ah = h * aFrac
      return [
        ...buildLayout(aItems, x, y, w, ah),
        ...buildLayout(bItems, x, y + ah, w, h - ah),
      ]
    }
  }

  const sorted = [...data].sort((a, b) => parseInt(b.count) - parseInt(a.count))
  const items = sorted.map((d, i) => ({ ...d, val: parseInt(d.count), color: colors[i % colors.length] }))
  const boxes = squarifyLayout(items, 0, 0, W, H)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden', display: 'block' }}>
      {boxes.map((box) => {
        const pct = total > 0 ? Math.round(box.val / total * 100) : 0
        const cx = box.x + box.w / 2
        const cy = box.y + box.h / 2
        const isLarge = box.w > 100 && box.h > 60
        const isMed = box.w > 60 && box.h > 36
        const nameFontSize = Math.min(14, Math.max(9, Math.min(box.w * 0.13, box.h * 0.2)))
        return (
          <g key={box.source}>
            <rect
              x={box.x + GAP / 2} y={box.y + GAP / 2}
              width={Math.max(box.w - GAP, 1)} height={Math.max(box.h - GAP, 1)}
              rx={2} fill={box.color}
            />
            {isMed && (
              <text
                x={cx} y={isLarge ? cy - 14 : cy}
                textAnchor="middle" dominantBaseline="middle"
                fill="#fff" fontSize={nameFontSize} fontWeight={700}
              >
                {box.source}
              </text>
            )}
            {isLarge && (
              <text
                x={cx} y={cy + 10}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.95)" fontSize={Math.min(26, box.h * 0.25)} fontWeight={800}
              >
                {pct}%
              </text>
            )}
            {isLarge && (
              <text
                x={cx} y={cy + 32}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.7)" fontSize={11}
              >
                {box.val}名
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// バブルマップ（Leaflet.js使用）
// ============================================================
function BubbleMap({ postalData, maxCount, clinicLocation }) {
  const mapRef = useRef(null)
  const leafletMap = useRef(null)
  const markersRef = useRef([])
  const clinicMarkerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (leafletMap.current) {
      // マーカー更新
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (clinicMarkerRef.current) {
        clinicMarkerRef.current.remove()
        clinicMarkerRef.current = null
      }
      addMarkers()
      return
    }

    // Leafletを動的ロード
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      // クリニック座標があればそちらを中心に、なければデフォルト
      const center = (clinicLocation?.lat && clinicLocation?.lng)
        ? [clinicLocation.lat, clinicLocation.lng]
        : [35.659, 139.700]
      leafletMap.current = L.map(mapRef.current, {
        center,
        zoom: 13,
        zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(leafletMap.current)
      addMarkers()
    }
    document.head.appendChild(script)

    function addMarkers() {
      const L = window.L
      if (!L || !leafletMap.current) return

      // 患者バブルマーカー
      postalData.forEach(d => {
        const radius = Math.max(12, Math.sqrt(d.count / maxCount) * 40)
        const circle = L.circleMarker([d.coords.lat, d.coords.lng], {
          radius,
          fillColor: '#3b82f6',
          fillOpacity: 0.55,
          color: '#1d4ed8',
          weight: 1.5,
        }).bindPopup(`
          <b>${d.coords.area}</b><br>
          郵便番号: ${d.postal_code}<br>
          患者数: <b>${d.count}名</b>
        `)
        circle.addTo(leafletMap.current)
        markersRef.current.push(circle)
      })

      // 医院マーカー
      if (clinicLocation?.lat && clinicLocation?.lng) {
        const clinicIcon = L.divIcon({
          html: `
            <div style="
              background:#dc2626; color:#fff;
              border:3px solid #fff; border-radius:50% 50% 50% 0;
              transform:rotate(-45deg); width:32px; height:32px;
              box-shadow:0 2px 8px rgba(0,0,0,0.35);
              display:flex; align-items:center; justify-content:center;
            ">
              <span style="transform:rotate(45deg); font-size:16px; line-height:1;">🦷</span>
            </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -34],
          className: '',
        })
        clinicMarkerRef.current = L.marker(
          [clinicLocation.lat, clinicLocation.lng],
          { icon: clinicIcon, zIndexOffset: 1000 }
        ).bindPopup(`
          <b style="color:#dc2626">🦷 ${clinicLocation.name}</b><br>
          ${clinicLocation.address}
        `).addTo(leafletMap.current)
      }
    }

    return () => { /* cleanup */ }
  }, [postalData, clinicLocation])

  return (
    <div ref={mapRef} style={{ height: 400, borderRadius: 8, border:'1px solid #e5e7eb', overflow:'hidden' }} />
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
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'age' | 'map'

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
        {[['overview','📋 月次概要'], ['age','📊 年代分析'], ['map','🗺️ 地域・流入分析'], ['churn','⚠️ 離脱防止アラート']].map(([v, label]) => (
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

      {/* ── タブ3: 地域・流入分析 ── */}
      {activeTab === 'map' && (
        ageLoading ? <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>読み込み中...</div>
        : !ageData ? null : (
          <MapAndReferralTab ageData={ageData} clinicLocation={ageData.clinicLocation} />
        )
      )}

      {/* ── タブ4: 離脱防止アラート ── */}
      {activeTab === 'churn' && <ChurnAlertTab />}
    </div>
  )
}

// ============================================================
// 離脱防止アラートタブ
// ============================================================
function ChurnAlertTab() {
  const [months, setMonths]           = useState(3)
  const [customMonths, setCustomMonths] = useState('')
  const [patients, setPatients]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState(new Set())
  const [messageText, setMessageText] = useState('しばらくご来院がないことが気になり、ご連絡いたしました。\nお口の健康のために、ぜひ一度ご来院ください。\n\nご予約はLINEから簡単にできます。お待ちしております。')
  const [sending, setSending]         = useState(false)
  const [sendResult, setSendResult]   = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fetched, setFetched]         = useState(false)

  const isTest = localStorage.getItem('test_mode') === 'true'
  const effectiveMonths = customMonths ? parseInt(customMonths) : months

  async function fetchChurnPatients() {
    setLoading(true)
    setSelected(new Set())
    setSendResult(null)
    try {
      const res  = await fetch(`${API}/api/analytics/churn?months=${effectiveMonths}&is_test=${isTest}`, { headers: authHeader() })
      const data = await res.json()
      setPatients(data.patients || [])
      setFetched(true)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleSend() {
    setSending(true)
    setSendResult(null)
    try {
      const ids = [...selected].length > 0 ? [...selected] : patients.filter(p => p.line_user_id).map(p => p.id)
      const res = await fetch(`${API}/api/analytics/churn/send`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ patient_ids: ids, message_text: messageText, is_test: isTest }),
      })
      const data = await res.json()
      setSendResult(data)
    } catch (e) {
      setSendResult({ error: e.message })
    }
    setSending(false)
    setShowConfirm(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(patients.filter(p => p.line_user_id).map(p => p.id)))
  }

  function clearAll() { setSelected(new Set()) }

  const linePatients   = patients.filter(p => p.line_user_id)
  const noLinePatients = patients.filter(p => !p.line_user_id)
  const sendTargetCount = selected.size > 0 ? selected.size : linePatients.length

  const getRiskColor = (m) => {
    if (m >= 12) return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', label: '高リスク' }
    if (m >= 6)  return { bg: '#fff7ed', text: '#d97706', border: '#fed7aa', label: '中リスク' }
    return            { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: '要注意' }
  }

  const cardStyle = { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }

  return (
    <div>
      {/* 設定パネル */}
      <div style={{ ...cardStyle, marginBottom:16 }}>
        <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937', margin:'0 0 16px' }}>⚠️ 離脱防止アラート設定</h2>

        {/* 未来院期間 */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:8 }}>
            未来院期間の閾値
          </label>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            {[3, 6, 12].map(m => (
              <button key={m} onClick={() => { setMonths(m); setCustomMonths('') }}
                style={{
                  padding:'7px 16px', borderRadius:8, border:'1px solid',
                  fontSize:13, cursor:'pointer', fontWeight:600,
                  background: months === m && !customMonths ? '#dc2626' : '#f9fafb',
                  color:      months === m && !customMonths ? '#fff'    : '#374151',
                  borderColor: months === m && !customMonths ? '#dc2626' : '#e5e7eb',
                }}>
                {m}ヶ月以上
              </button>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" min="1" max="60" value={customMonths}
                onChange={e => { setCustomMonths(e.target.value); setMonths(0) }}
                placeholder="カスタム"
                style={{ width:90, padding:'7px 10px', borderRadius:8, border:`1px solid ${customMonths ? '#dc2626' : '#d1d5db'}`, fontSize:13, boxSizing:'border-box' }} />
              <span style={{ fontSize:12, color:'#6b7280' }}>ヶ月以上</span>
            </div>
            <button onClick={fetchChurnPatients} disabled={loading}
              style={{ padding:'8px 20px', borderRadius:8, border:'none', background: loading ? '#93c5fd' : '#2563eb', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {loading ? '検索中...' : '🔍 検索する'}
            </button>
          </div>
        </div>
      </div>

      {/* 検索結果 */}
      {fetched && (
        <>
          {/* サマリー */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            <div style={{ background:'#fef2f2', borderRadius:12, padding:'16px 18px', border:'1px solid #fca5a5' }}>
              <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>離脱リスク患者数</div>
              <div style={{ fontSize:28, fontWeight:700, color:'#dc2626' }}>{patients.length}名</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{effectiveMonths}ヶ月以上未来院</div>
            </div>
            <div style={{ background:'#eff6ff', borderRadius:12, padding:'16px 18px', border:'1px solid #bfdbfe' }}>
              <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>LINE送信可能</div>
              <div style={{ fontSize:28, fontWeight:700, color:'#2563eb' }}>{linePatients.length}名</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>LINE連携済み</div>
            </div>
            <div style={{ background:'#f9fafb', borderRadius:12, padding:'16px 18px', border:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>LINE未連携</div>
              <div style={{ fontSize:28, fontWeight:700, color:'#9ca3af' }}>{noLinePatients.length}名</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>メッセージ送信不可</div>
            </div>
          </div>

          {patients.length === 0 ? (
            <div style={{ ...cardStyle, textAlign:'center', padding:40, color:'#9ca3af' }}>
              {effectiveMonths}ヶ月以上未来院の患者はいません 🎉
            </div>
          ) : (
            <>
              {/* 患者一覧 */}
              <div style={{ ...cardStyle, marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937', margin:0 }}>
                    離脱リスク患者一覧
                    <span style={{ fontSize:12, fontWeight:400, color:'#6b7280', marginLeft:8 }}>
                      {selected.size > 0 ? `${selected.size}名選択中` : 'チェックで個別選択、未選択時は全LINE連携患者が対象'}
                    </span>
                  </h2>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={selectAll}
                      style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                      全選択
                    </button>
                    <button onClick={clearAll}
                      style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                      解除
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight:360, overflowY:'auto' }}>
                  {patients.map(p => {
                    const risk = getRiskColor(p.months_since_visit)
                    const isSelected = selected.has(p.id)
                    return (
                      <div key={p.id}
                        onClick={() => p.line_user_id && toggleSelect(p.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'10px 12px', borderRadius:8, marginBottom:4,
                          border: `1px solid ${isSelected ? '#2563eb' : '#f3f4f6'}`,
                          background: isSelected ? '#eff6ff' : '#fafafa',
                          cursor: p.line_user_id ? 'pointer' : 'default',
                          opacity: p.line_user_id ? 1 : 0.6,
                        }}>
                        {/* チェックボックス */}
                        <div style={{
                          width:18, height:18, borderRadius:4, flexShrink:0,
                          border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                          background: isSelected ? '#2563eb' : '#fff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          {isSelected && <span style={{ color:'#fff', fontSize:11, fontWeight:700 }}>✓</span>}
                        </div>
                        {/* リスクバッジ */}
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:risk.bg, color:risk.text, border:`1px solid ${risk.border}`, whiteSpace:'nowrap' }}>
                          {risk.label}
                        </span>
                        {/* 患者情報 */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{p.name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                            {p.age_group || '年代不明'} ／ 来院{p.total_visits || 0}回
                          </div>
                        </div>
                        {/* 最終来院 */}
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:risk.text }}>{p.months_since_visit}ヶ月未来院</div>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>最終: {p.last_visit_date}</div>
                        </div>
                        {/* LINE状態 */}
                        <div style={{ flexShrink:0 }}>
                          {p.line_user_id
                            ? <span style={{ fontSize:10, background:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:20 }}>LINE連携</span>
                            : <span style={{ fontSize:10, background:'#f3f4f6', color:'#9ca3af', padding:'2px 8px', borderRadius:20 }}>LINE未連携</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* LINEメッセージ送信 */}
              {linePatients.length > 0 && (
                <div style={cardStyle}>
                  <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937', margin:'0 0 16px' }}>📱 LINEフォローメッセージ送信</h2>

                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>メッセージ本文</label>
                    <textarea value={messageText} onChange={e => setMessageText(e.target.value)} rows={5}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, lineHeight:1.6, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{messageText.length}文字</div>
                  </div>

                  {/* プレビュー */}
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:14, marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e40af', marginBottom:8 }}>📱 LINEプレビュー</div>
                    <div style={{ background:'#fff', borderRadius:10, overflow:'hidden', border:'1px solid #e5e7eb', maxWidth:260 }}>
                      <div style={{ background:'#2563eb', padding:'10px 14px' }}>
                        <div style={{ color:'#fff', fontSize:12, fontWeight:600 }}>スマイル歯科からのご連絡</div>
                      </div>
                      <div style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#1f2937', marginBottom:6 }}>〇〇 様</div>
                        <div style={{ fontSize:11, color:'#374151', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{messageText}</div>
                      </div>
                      <div style={{ padding:'10px 14px', background:'#f9fafb', borderTop:'1px solid #e5e7eb' }}>
                        <div style={{ background:'#2563eb', color:'#fff', borderRadius:6, padding:'8px', textAlign:'center', fontSize:12, fontWeight:600 }}>予約する</div>
                      </div>
                    </div>
                  </div>

                  {!showConfirm ? (
                    <button onClick={() => setShowConfirm(true)}
                      style={{ padding:'10px 28px', borderRadius:8, border:'none', background:'#dc2626', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      📣 {sendTargetCount}名にLINE送信する
                    </button>
                  ) : (
                    <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'14px 18px' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#991b1b', marginBottom:8 }}>⚠️ 本当に送信しますか？</div>
                      <div style={{ fontSize:13, color:'#374151', marginBottom:14 }}>
                        <strong>{sendTargetCount}名</strong>にLINEメッセージを送信します。この操作は取り消せません。
                        {isTest && <span style={{ color:'#d97706', marginLeft:8 }}>（テストモード）</span>}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={handleSend} disabled={sending}
                          style={{ padding:'8px 20px', borderRadius:8, border:'none', background: sending ? '#fca5a5' : '#dc2626', color:'#fff', fontSize:13, fontWeight:600, cursor: sending ? 'wait' : 'pointer' }}>
                          {sending ? '送信中...' : '送信する'}
                        </button>
                        <button onClick={() => setShowConfirm(false)} disabled={sending}
                          style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', color:'#6b7280', fontSize:13, cursor:'pointer' }}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}

                  {sendResult && (
                    <div style={{ marginTop:14, background: sendResult.error ? '#fef2f2' : '#f0fdf4', border:`1px solid ${sendResult.error ? '#fca5a5' : '#a7f3d0'}`, borderRadius:10, padding:'12px 16px', fontSize:13 }}>
                      {sendResult.error
                        ? <span style={{ color:'#dc2626' }}>❌ {sendResult.error}</span>
                        : <div style={{ color:'#166534', fontWeight:600 }}>
                            ✅ 送信完了 — 成功: <strong>{sendResult.results?.sent}件</strong>
                            {sendResult.results?.failed > 0 && <span style={{ color:'#dc2626', marginLeft:8 }}>失敗: {sendResult.results.failed}件</span>}
                            {sendResult.results?.no_line > 0 && <span style={{ color:'#9ca3af', marginLeft:8 }}>LINE未連携: {sendResult.results.no_line}件</span>}
                          </div>
                      }
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// 地域・流入分析タブ
// ============================================================
function MapAndReferralTab({ ageData, clinicLocation }) {
  const cardStyle = { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }

  // 流入チャネルデータ
  const referralData = ageData.referralSources || []
  const totalReferral = referralData.reduce((s,d) => s+parseInt(d.count), 0)

  // 郵便番号データを座標に変換
  const postalData = (ageData.postalCounts || [])
    .map(d => ({
      ...d,
      count: parseInt(d.count),
      coords: POSTAL_COORDS[d.postal_code],
    }))
    .filter(d => d.coords)

  const maxCount = Math.max(...postalData.map(d => d.count), 1)

  // ツリーマップのカラー
  const TREE_COLORS = [
    '#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'
  ]

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        <div style={{ background:'#eff6ff', borderRadius:12, padding:'18px 20px', border:'1px solid #bfdbfe' }}>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>郵便番号登録済み</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#3b82f6' }}>
            {(ageData.postalCounts||[]).reduce((s,d)=>s+parseInt(d.count),0)}名
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            {postalData.length}エリア
          </div>
        </div>
        <div style={{ background:'#f5f3ff', borderRadius:12, padding:'18px 20px', border:'1px solid #ddd6fe' }}>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>来院きっかけ登録済み</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#8b5cf6' }}>{totalReferral}名</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            {referralData.length}チャネル
          </div>
        </div>
        <div style={{ background:'#f0fdf4', borderRadius:12, padding:'18px 20px', border:'1px solid #a7f3d0' }}>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>最多流入チャネル</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#10b981' }}>
            {referralData[0]?.source || '-'}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            {referralData[0] ? `${referralData[0].count}名 (${Math.round(parseInt(referralData[0].count)/Math.max(totalReferral,1)*100)}%)` : ''}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

        {/* 流入チャネル ツリーマップ */}
        <div style={cardStyle}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#111827', margin:'0 0 14px' }}>
            流入チャネル（ツリーマップ）
          </h2>
          <ReferralTreeMap data={referralData} total={totalReferral} colors={TREE_COLORS} />
          {/* 凡例 */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
            {referralData.map((d,i) => (
              <div key={d.source} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
                <span style={{ width:8, height:8, borderRadius:2, background:TREE_COLORS[i%TREE_COLORS.length], display:'inline-block' }} />
                <span style={{ color:'#374151' }}>{d.source}</span>
                <span style={{ color:'#9ca3af' }}>{d.count}名</span>
              </div>
            ))}
          </div>
        </div>

        {/* チャネル別棒グラフ */}
        <div style={cardStyle}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#111827', margin:'0 0 14px' }}>
            チャネル別患者数
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {referralData.map((d,i) => {
              const pct = totalReferral > 0 ? Math.round(parseInt(d.count)/totalReferral*100) : 0
              const bar = totalReferral > 0 ? (parseInt(d.count)/totalReferral*100) : 0
              return (
                <div key={d.source}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span style={{ color:'#374151', fontWeight:500 }}>{d.source}</span>
                    <span style={{ color:'#6b7280' }}>{d.count}名 ({pct}%)</span>
                  </div>
                  <div style={{ background:'#f3f4f6', borderRadius:4, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${bar}%`, height:8, borderRadius:4,
                      background:TREE_COLORS[i%TREE_COLORS.length], transition:'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 来院地域バブルマップ */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#111827', margin:0 }}>来院地域マップ</h2>
            <p style={{ fontSize:11, color:'#9ca3af', margin:'3px 0 0' }}>
              バブルの大きさ = 患者数　渋谷区・代々木周辺エリア
            </p>
          </div>
          <div style={{ fontSize:11, color:'#6b7280' }}>
            {postalData.length}エリア / {postalData.reduce((s,d)=>s+d.count,0)}名
          </div>
        </div>
        <BubbleMap postalData={postalData} maxCount={maxCount} clinicLocation={clinicLocation} />

        {/* エリア別ランキング */}
        <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          {postalData.sort((a,b)=>b.count-a.count).slice(0,8).map((d,i) => (
            <div key={d.postal_code} style={{
              display:'flex', alignItems:'center', gap:8,
              background:'#f9fafb', borderRadius:8, padding:'8px 10px',
              border:'1px solid #e5e7eb',
            }}>
              <div style={{
                width:24, height:24, borderRadius:'50%', flexShrink:0,
                background: i===0?'#fbbf24':i===1?'#d1d5db':i===2?'#d97706':'#eff6ff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, color: i<3?'#fff':'#3b82f6',
              }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {d.coords?.area || d.postal_code}
                </div>
                <div style={{ fontSize:10, color:'#9ca3af' }}>{d.postal_code} / {d.count}名</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

