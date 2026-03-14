// frontend/src/pages/admin/AdminSettings.jsx
import { useState, useEffect } from 'react'
import { Save, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

function authHeader() {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

const SETTING_GROUPS = [
  {
    title: '患者操作制限',
    desc:  'LINEから患者ができる操作を制限します',
    keys:  [
      { key: 'can_patient_book',   label: 'LINE予約を許可',         type: 'bool' },
      { key: 'can_patient_cancel', label: 'LINEキャンセルを許可',   type: 'bool' },
      { key: 'can_patient_change', label: 'LINE変更を許可',         type: 'bool' },
    ],
  },
  {
    title: 'メンテナンスモード',
    desc:  'ONにすると患者のLINE操作を一時停止します',
    keys:  [
      { key: 'maintenance_mode',    label: 'メンテナンスモード',     type: 'bool' },
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
      { key: 'clinic_name',    label: 'クリニック名',   type: 'text' },
      { key: 'clinic_tel',     label: '電話番号',       type: 'text' },
      { key: 'clinic_address', label: '住所',           type: 'text' },
      { key: 'open_time',      label: '診療開始時刻',   type: 'text' },
      { key: 'close_time',     label: '診療終了時刻',   type: 'text' },
    ],
  },
]

export default function AdminSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/admin/settings`, { headers: authHeader() })
      const data = await res.json()
      const flat = {}
      Object.entries(data.settings).forEach(([k, v]) => { flat[k] = v.value })
      setSettings(flat)
    } catch (err) { setError('設定の取得に失敗しました') }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({ updates: settings }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { setError('保存に失敗しました') }
    setSaving(false)
  }

  function update(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>読み込み中...</div>

  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>システム設定</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>患者操作の制限・予約ルール・クリニック情報を管理します</p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: saved ? '#059669' : '#2563eb', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Save size={15} />{saved ? '保存しました ✓' : saving ? '保存中...' : '保存する'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {SETTING_GROUPS.map(group => (
        <div key={group.title} style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: 24, marginBottom: 16,
        }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>{group.title}</h2>
            {group.desc && <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{group.desc}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {group.keys.map(({ key, label, type }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <label style={{ fontSize: 14, color: '#374151', flex: 1 }}>{label}</label>
                {type === 'bool' ? (
                  <div
                    onClick={() => update(key, settings[key] === 'true' ? 'false' : 'true')}
                    style={{
                      width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                      background: settings[key] === 'true' ? '#2563eb' : '#d1d5db',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: settings[key] === 'true' ? 23 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                ) : type === 'number' ? (
                  <input
                    type="number" value={settings[key] || ''} onChange={e => update(key, e.target.value)}
                    style={{
                      width: 80, padding: '6px 10px', borderRadius: 6,
                      border: '1px solid #d1d5db', fontSize: 14, textAlign: 'right',
                    }}
                  />
                ) : (
                  <input
                    type="text" value={settings[key] || ''} onChange={e => update(key, e.target.value)}
                    style={{
                      width: 260, padding: '6px 10px', borderRadius: 6,
                      border: '1px solid #d1d5db', fontSize: 14,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
