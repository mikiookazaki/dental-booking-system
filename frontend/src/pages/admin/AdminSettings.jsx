// frontend/src/pages/admin/AdminSettings.jsx
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

function authHeader() {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const SETTING_GROUPS = [
  {
    title: '患者操作制限',
    desc:  'LINEから患者ができる操作を制限します',
    keys:  [
      { key: 'can_patient_book',   label: 'LINE予約を許可',       type: 'bool' },
      { key: 'can_patient_cancel', label: 'LINEキャンセルを許可', type: 'bool' },
      { key: 'can_patient_change', label: 'LINE変更を許可',       type: 'bool' },
    ],
  },
  {
    title: 'メンテナンスモード',
    desc:  'ONにすると患者のLINE操作を一時停止します',
    keys:  [
      { key: 'maintenance_mode',    label: 'メンテナンスモード',       type: 'bool' },
      { key: 'maintenance_message', label: 'メンテナンス中メッセージ', type: 'text' },
    ],
  },
  {
    title: '予約ルール',
    desc:  '予約・キャンセルの制限時間などを設定します',
    keys:  [
      { key: 'cancel_deadline_hours',   label: 'キャンセル受付期限（時間前）', type: 'number' },
      { key: 'change_deadline_hours',   label: '変更受付期限（時間前）',       type: 'number' },
      { key: 'min_booking_hours_ahead', label: '最短予約リードタイム（時間）', type: 'number' },
      { key: 'max_future_booking_days', label: '先行予約受付期間（日）',       type: 'number' },
      { key: 'max_active_bookings',     label: '1患者あたりの最大予約件数',   type: 'number' },
    ],
  },
  {
    title: 'クリニック基本情報',
    keys:  [
      { key: 'clinic_name',    label: 'クリニック名', type: 'text' },
      { key: 'clinic_tel',     label: '電話番号',     type: 'text' },
      { key: 'clinic_address', label: '住所',         type: 'text' },
    ],
  },
]

// マニュアル表示モード（localStorageで管理）
const MANUAL_MODES = [
  { value: 'tab',    label: '新しいタブで開く',       desc: 'シンプル・使い慣れた方法' },
  { value: 'window', label: '別ウィンドウで開く',     desc: '画面を並べて確認できる' },
]

export default function AdminSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [openDays, setOpenDays] = useState([1,2,3,4,5,6])

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/admin/settings`, { headers: authHeader() })
      const data = await res.json()
      const flat = {}
      Object.entries(data.settings).forEach(([k, v]) => { flat[k] = v.value })
      setSettings(flat)
      if (flat.open_days) {
        try { setOpenDays(JSON.parse(flat.open_days)) } catch {}
      }
    } catch { setError('設定の取得に失敗しました') }
    setLoading(false)
  }

  // 住所→座標変換（OpenStreetMap Nominatim）
  async function geocodeAddress(address) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=ja`
      const res = await fetch(url, { headers: { 'User-Agent': 'SmileDental/1.0' } })
      const data = await res.json()
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    } catch {}
    return null
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const updates = { ...settings, open_days: JSON.stringify(openDays) }

      // 住所が入力されていればジオコーディングして座標も保存
      if (settings.clinic_address) {
        const coords = await geocodeAddress(settings.clinic_address)
        if (coords) {
          updates.clinic_lat = String(coords.lat)
          updates.clinic_lng = String(coords.lng)
        }
      }

      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setError('保存に失敗しました') }
    setSaving(false)
  }

  function update(key, val) { setSettings(prev => ({ ...prev, [key]: val })) }

  function toggleDay(d) {
    setOpenDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>読み込み中...</div>

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>システム設定</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>患者操作の制限・診療時間・クリニック情報を管理します</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: saved ? '#059669' : '#2563eb', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
          <Save size={15} />{saved ? '保存しました ✓' : saving ? '保存中...' : '保存する'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── 診療時間・休診日 ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>診療時間・休診日</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>診療曜日・時間・昼休みを設定します</p>
        </div>

        {/* 診療曜日 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>診療曜日</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {DOW_LABELS.map((label, i) => {
              const active = openDays.includes(i)
              return (
                <button key={i} onClick={() => toggleDay(i)}
                  style={{
                    width: 44, height: 44, borderRadius: 10,
                    border: active ? 'none' : '1px solid #d1d5db',
                    background: active ? (i===0 ? '#fee2e2' : i===6 ? '#dbeafe' : '#2563eb') : '#f9fafb',
                    color: active ? (i===0 ? '#dc2626' : i===6 ? '#2563eb' : '#fff') : '#9ca3af',
                    fontWeight: active ? 700 : 400, fontSize: 14, cursor: 'pointer',
                    position: 'relative',
                  }}>
                  {label}
                  {!active && (
                    <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#dc2626', fontWeight: 700 }}>休</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 診療時間 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>診療開始時刻</label>
            <input type="time" value={settings.open_time || '09:00'}
              onChange={e => update('open_time', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>診療終了時刻</label>
            <input type="time" value={settings.close_time || '18:30'}
              onChange={e => update('close_time', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* 昼休み */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>昼休みあり</label>
            <div onClick={() => update('has_lunch_break', settings.has_lunch_break === 'false' ? 'true' : 'false')}
              style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: settings.has_lunch_break === 'false' ? '#d1d5db' : '#2563eb',
                position: 'relative' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: settings.has_lunch_break === 'false' ? 3 : 23,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
          {settings.has_lunch_break !== 'false' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>昼休み開始</label>
                <input type="time" value={settings.lunch_start || '13:00'}
                  onChange={e => update('lunch_start', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>昼休み終了</label>
                <input type="time" value={settings.lunch_end || '14:00'}
                  onChange={e => update('lunch_end', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </div>
          )}
        </div>

        {/* プレビュー */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>診療日：</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
            {openDays.length === 0 ? '未設定' : DOW_LABELS.filter((_, i) => openDays.includes(i)).join('・') + '曜日'}
          </span>
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 16 }}>
            {settings.open_time || '09:00'}〜{settings.close_time || '18:30'}
          </span>
        </div>
      </div>

      {/* ── 【4】曜日別カスタム診療時間 ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>曜日別カスタム診療時間</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>
            通常の診療時間と異なる曜日がある場合に設定します。例: 土曜日は午前のみ、特定曜日は休診など。
          </p>
        </div>
        {['月','火','水','木','金','土','日'].map((day, idx) => {
          const dow = [1,2,3,4,5,6,0][idx];
          const key = `custom_hours_${dow}`;
          const val = settings[key] ? JSON.parse(settings[key]) : null;
          const isOpen = openDays.includes(dow);
          return (
            <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                background: isOpen ? (dow === 0 ? '#fee2e2' : dow === 6 ? '#dbeafe' : '#dbeafe') : '#f3f4f6',
                color: isOpen ? (dow === 0 ? '#dc2626' : '#2563eb') : '#9ca3af' }}>
                {day}
              </div>
              <span style={{ fontSize: 13, color: '#6b7280', width: 80 }}>
                {isOpen ? '通常診療' : '休診日'}
              </span>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={!!settings[key]}
                  onChange={e => {
                    if (e.target.checked) {
                      update(key, JSON.stringify({ open: settings.open_time || '09:00', close: settings.close_time || '18:30' }))
                    } else {
                      update(key, '')
                    }
                  }}
                />
                カスタム時間を設定
              </label>
              {settings[key] && (() => {
                let parsed = { open: '09:00', close: '18:30' };
                try { parsed = JSON.parse(settings[key]); } catch {}
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={parsed.open}
                      onChange={e => update(key, JSON.stringify({ ...parsed, open: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <span style={{ color: '#9ca3af' }}>〜</span>
                    <input type="time" value={parsed.close}
                      onChange={e => update(key, JSON.stringify({ ...parsed, close: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: '#059669' }}>({day}曜のみ適用)</span>
                  </div>
                );
              })()}
            </div>
          );
        })}
        <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginTop: 4, fontSize: 12, color: '#92400e' }}>
          💡 設定した曜日はLINE予約・カレンダーの空き枠計算に反映されます
        </div>
      </div>

      {/* ── 【4】カレンダー表示時間（診療時間外） ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>カレンダー表示時間</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>
            診療時間外でもスタッフが予約を入れられるよう、カレンダーの表示範囲を設定します。
            診療時間外はLINE予約には影響しません。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              表示開始時刻
              <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>（診療開始より前）</span>
            </label>
            <input type="time" value={settings.calendar_display_start || '07:00'}
              onChange={e => update('calendar_display_start', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              表示終了時刻
              <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>（診療終了より後）</span>
            </label>
            <input type="time" value={settings.calendar_display_end || '21:00'}
              onChange={e => update('calendar_display_end', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#92400e' }}>
          💡 例: 診療時間が 09:00〜18:30 でも、表示を 07:00〜21:00 にすると時間外予約が可能になります
        </div>
      </div>

      {/* その他の設定グループ */}
      {SETTING_GROUPS.map(group => (
        <div key={group.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>{group.title}</h2>
            {group.desc && <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{group.desc}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {group.keys.map(({ key, label, type }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <label style={{ fontSize: 14, color: '#374151', flex: 1 }}>{label}</label>
                {type === 'bool' ? (
                  <div onClick={() => update(key, settings[key] === 'true' ? 'false' : 'true')}
                    style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                      background: settings[key] === 'true' ? '#2563eb' : '#d1d5db',
                      position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: settings[key] === 'true' ? 23 : 3,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                ) : type === 'number' ? (
                  <input type="number" value={settings[key] || ''}
                    onChange={e => update(key, e.target.value)}
                    style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, textAlign: 'right' }} />
                ) : (
                  <input type="text" value={settings[key] || ''}
                    onChange={e => update(key, e.target.value)}
                    style={{ width: 260, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── マニュアル表示設定 ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📖</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>ヘルプマニュアルの表示方法</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>サイドバーの「マニュアル」ボタンを押した時の動作</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MANUAL_MODES.map(mode => {
            const current = localStorage.getItem('manual_display_mode') || 'tab'
            const isSelected = current === mode.value
            return (
              <div key={mode.value}
                onClick={() => { localStorage.setItem('manual_display_mode', mode.value); update('_manual_mode_ui', mode.value) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                  background: isSelected ? '#eff6ff' : '#f9fafb',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                  background: isSelected ? '#2563eb' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#1e40af' : '#374151' }}>{mode.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{mode.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>📖 マニュアルを今すぐ確認</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '👑 管理者マニュアル', url: '/manual.html' },
              { label: '👩‍⚕️ スタッフマニュアル', url: '/manual.html' },
              { label: '📱 LINE予約ガイド',  url: '/manual.html'  },
            ].map(m => (
              <button key={m.url}
                onClick={() => window.open(m.url, '_blank')}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid #059669',
                  background: '#fff', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >{m.label}</button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
