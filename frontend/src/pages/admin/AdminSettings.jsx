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

const MANUAL_MODES = [
  { value: 'tab',    label: '新しいタブで開く',   desc: 'シンプル・使い慣れた方法' },
  { value: 'window', label: '別ウィンドウで開く', desc: '画面を並べて確認できる' },
]

// ─────────────────────────────────────────────
// プラン定義
// ─────────────────────────────────────────────
const PLAN_LABELS = { basic: 'ベーシック', standard: 'スタンダード', pro: 'プロ' }
const PLAN_PRICES = { basic: '¥9,800 / 月', standard: '¥19,800 / 月', pro: '¥29,800〜 / 月' }
const PLAN_RANK   = { basic: 1, standard: 2, pro: 3 }
const PLAN_THEME  = {
  basic:    { bg: '#E1F5EE', text: '#0F6E56', border: '#1D9E75' },
  standard: { bg: '#EEEDFE', text: '#534AB7', border: '#534AB7' },
  pro:      { bg: '#FAEEDA', text: '#854F0B', border: '#BA7517' },
}

const FEATURE_GROUPS = [
  {
    label: '予約・来院サポート',
    items: [
      { key: 'APPOINTMENT_CALENDAR',    label: '予約カレンダー',           plan: 'basic'    },
      { key: 'LINE_BOOKING',            label: 'LINE予約・変更・キャンセル', plan: 'basic'    },
      { key: 'LINE_QUESTIONNAIRE',      label: '問診票フロー（LINE）',      plan: 'basic'    },
      { key: 'REMINDER_AUTO_SEND',      label: 'リマインダー自動送信',      plan: 'standard' },
      { key: 'CHECKUP_REMINDER',        label: '定期検診リマインド',        plan: 'standard' },
      { key: 'POST_TREATMENT_FOLLOWUP', label: '治療後フォローメッセージ',  plan: 'standard' },
    ],
  },
  {
    label: '患者管理・ナーチャリング',
    items: [
      { key: 'PATIENT_MANAGEMENT',    label: '患者登録・LINE連携・QR',    plan: 'basic'    },
      { key: 'PATIENT_TAGS_SEGMENTS', label: 'タグ・セグメント管理',      plan: 'standard' },
      { key: 'BIRTHDAY_MESSAGE',      label: '誕生日・記念日メッセージ',  plan: 'standard' },
      { key: 'NURTURING_SCENARIO',    label: 'ナーチャリングシナリオ自動化', plan: 'pro'   },
    ],
  },
  {
    label: 'マーケティング・集客',
    items: [
      { key: 'COUPON',             label: 'クーポン発行・管理',     plan: 'standard' },
      { key: 'SURVEY',             label: 'アンケート機能',         plan: 'standard' },
      { key: 'CAMPAIGN_BROADCAST', label: 'キャンペーン一斉配信',  plan: 'pro'      },
      { key: 'REVIEW_PROMOTION',   label: '口コミ誘導（Google）',  plan: 'pro'      },
    ],
  },
  {
    label: 'AI・自動化',
    items: [
      { key: 'AI_FAQ',            label: 'FAQ自動応答（AI Bot）',       plan: 'pro' },
      { key: 'AI_TRIAGE',         label: 'AIトリアージ（症状→予約案内）', plan: 'pro' },
      { key: 'AI_SYMPTOM_ADVICE', label: 'AI症状アドバイス',             plan: 'pro' },
    ],
  },
  {
    label: '分析・レポート',
    items: [
      { key: 'DASHBOARD_BASIC',        label: '月次KPIダッシュボード',    plan: 'basic'    },
      { key: 'DASHBOARD_ADVANCED',     label: '年代・地域・流入分析',     plan: 'standard' },
      { key: 'CHURN_ALERT',            label: '離脱防止アラート',         plan: 'standard' },
      { key: 'LINE_ROI_ANALYSIS',      label: 'LINE配信ROI・開封率分析',  plan: 'pro'      },
      { key: 'MULTI_CLINIC_DASHBOARD', label: '複数院横断ダッシュボード', plan: 'pro'      },
    ],
  },
]

// ─────────────────────────────────────────────
// リマインダータブ
// ─────────────────────────────────────────────
function ReminderTab() {
  const [settings, setSettings] = useState({
    reminder_enabled:        'true',
    reminder_same_day:       'true',
    reminder_send_time:      '09:00',
    reminder_message_before: '明日のご予約リマインダーです。\n\n時間: {time}\n内容: {treatment}\n\nご不明な点はお気軽にご連絡ください。',
    reminder_message_same:   '本日のご予約リマインダーです。\n\n時間: {time}\n内容: {treatment}\n\nご来院をお待ちしております。',
    recall_enabled:          'true',
    recall_message:          '前回の来院から{months}ヶ月が経過しました。\n定期検診はお済みでしょうか？\n\nお口の健康を守るために、定期的な検診をおすすめします。',
  })
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [running, setRunning]     = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [activeSection, setActiveSection] = useState('settings')

  useEffect(() => { fetchSettings(); fetchLogs() }, [])

  async function fetchSettings() {
    try {
      const res  = await fetch(`${API}/api/admin/settings`, { headers: authHeader() })
      const data = await res.json()
      const flat = {}
      Object.entries(data.settings).forEach(([k, v]) => { flat[k] = v.value })
      setSettings(prev => ({
        ...prev,
        ...(flat.reminder_enabled        !== undefined && { reminder_enabled:        flat.reminder_enabled }),
        ...(flat.reminder_same_day       !== undefined && { reminder_same_day:       flat.reminder_same_day }),
        ...(flat.reminder_send_time      !== undefined && { reminder_send_time:      flat.reminder_send_time }),
        ...(flat.reminder_message_before !== undefined && { reminder_message_before: flat.reminder_message_before }),
        ...(flat.reminder_message_same   !== undefined && { reminder_message_same:   flat.reminder_message_same }),
        ...(flat.recall_enabled          !== undefined && { recall_enabled:          flat.recall_enabled }),
        ...(flat.recall_message          !== undefined && { recall_message:          flat.recall_message }),
      }))
    } catch {}
    setLoading(false)
  }

  async function fetchLogs() {
    try {
      const res  = await fetch(`${API}/api/reminders/logs?limit=30`, { headers: authHeader() })
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`${API}/api/admin/settings`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ updates: settings }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  async function handleRunNow() {
    setRunning(true)
    setRunResult(null)
    try {
      const res  = await fetch(`${API}/api/reminders/run`, {
        method: 'POST',
        headers: { ...authHeader(), 'x-cron-secret': 'smile-dental-cron-2026' },
      })
      const data = await res.json()
      setRunResult(data)
      fetchLogs()
    } catch (e) {
      setRunResult({ error: e.message })
    }
    setRunning(false)
  }

  function update(key, val) { setSettings(prev => ({ ...prev, [key]: val })) }

  function Toggle({ keyName }) {
    const on = settings[keyName] === 'true'
    return (
      <div onClick={() => update(keyName, on ? 'false' : 'true')}
        style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
          background: on ? '#2563eb' : '#d1d5db', position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: on ? 23 : 3,
          transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    )
  }

  const TYPE_LABELS = {
    appointment_day_before: '前日リマインダー',
    appointment_same_day:   '当日リマインダー',
    recall_3month:          '定期検診（3ヶ月）',
    recall_6month:          '定期検診（6ヶ月）',
  }
  const TYPE_COLORS = {
    appointment_day_before: { bg: '#dbeafe', text: '#1e40af' },
    appointment_same_day:   { bg: '#dcfce7', text: '#166534' },
    recall_3month:          { bg: '#fef9c3', text: '#854d0e' },
    recall_6month:          { bg: '#ffedd5', text: '#9a3412' },
  }

  if (loading) return <div style={{ padding: 32, color: '#9ca3af' }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: 720 }}>
      {/* セクション切替 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['settings', '⚙️ 設定'], ['logs', '📋 送信履歴']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeSection === id ? '#2563eb' : '#f3f4f6',
              color: activeSection === id ? '#fff' : '#6b7280',
              fontSize: 13, fontWeight: 600,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 設定セクション */}
      {activeSection === 'settings' && (
        <>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>基本設定</h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>予約リマインダー</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>前日・当日に予約のリマインドをLINE送信します</div>
              </div>
              <Toggle keyName="reminder_enabled" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
              opacity: settings.reminder_enabled === 'true' ? 1 : 0.4,
              pointerEvents: settings.reminder_enabled === 'true' ? 'auto' : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>当日リマインダー</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Standard / Pro プランのみ有効</div>
              </div>
              <Toggle keyName="reminder_same_day" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: settings.reminder_enabled === 'true' ? 1 : 0.4,
              pointerEvents: settings.reminder_enabled === 'true' ? 'auto' : 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>送信時刻</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>毎日この時刻に自動送信されます</div>
              </div>
              <input type="time" value={settings.reminder_send_time || '09:00'}
                onChange={e => update('reminder_send_time', e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }} />
            </div>

            <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 12, color: '#92400e' }}>
              💡 送信時刻を変更した場合は開発者に連絡してください（サーバー側の cron 設定も変更が必要です）
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>定期検診リマインド</h2>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>最終来院から3・6ヶ月後に自動送信（Standard / Pro）</div>
              </div>
              <Toggle keyName="recall_enabled" />
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>メッセージ文言</h2>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
              使えるタグ：
              <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{'{time}'}</code> 時間　
              <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{'{treatment}'}</code> 治療内容　
              <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{'{months}'}</code> ヶ月数
            </div>
            {[
              { key: 'reminder_message_before', label: '前日リマインダー' },
              { key: 'reminder_message_same',   label: '当日リマインダー' },
              { key: 'recall_message',           label: '定期検診リマインド' },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
                <textarea value={settings[key] || ''} onChange={e => update(key, e.target.value)} rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                    fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: saved ? '#059669' : '#2563eb', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              {saved ? '保存しました ✓' : saving ? '保存中...' : '💾 設定を保存'}
            </button>
            <button onClick={handleRunNow} disabled={running}
              style={{
                padding: '10px 24px', borderRadius: 8,
                border: '1px solid #d1d5db', background: '#fff',
                color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              {running ? '送信中...' : '▶ 今すぐ送信テスト'}
            </button>
          </div>

          {runResult && (
            <div style={{
              background: runResult.error ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${runResult.error ? '#fca5a5' : '#a7f3d0'}`,
              borderRadius: 10, padding: '14px 18px', fontSize: 13,
            }}>
              {runResult.error ? (
                <span style={{ color: '#dc2626' }}>❌ エラー: {runResult.error}</span>
              ) : (
                <div style={{ color: '#166534' }}>
                  ✅ 実行完了 — 予約リマインダー: <strong>{runResult.summary?.appt_sent}件</strong>送信 /
                  定期検診: <strong>{runResult.summary?.recall_sent}件</strong>送信
                  {runResult.summary?.appt_failed > 0 && (
                    <span style={{ color: '#dc2626', marginLeft: 8 }}>（失敗: {runResult.summary.appt_failed}件）</span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 送信履歴セクション */}
      {activeSection === 'logs' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>送信履歴（直近30件）</h2>
            <button onClick={fetchLogs}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              🔄 更新
            </button>
          </div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>まだ送信履歴がありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => {
                const typeColor = TYPE_COLORS[log.reminder_type] || { bg: '#f3f4f6', text: '#6b7280' }
                return (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: 16, flexShrink: 0 }}>
                      {log.status === 'sent' ? '✅' : log.status === 'failed' ? '❌' : '⏭️'}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: typeColor.bg, color: typeColor.text, whiteSpace: 'nowrap',
                    }}>
                      {TYPE_LABELS[log.reminder_type] || log.reminder_type}
                    </span>
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>
                      {log.patients?.name || `患者ID: ${log.patient_id}`}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {new Date(log.sent_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.error_message && (
                      <span style={{ fontSize: 11, color: '#dc2626', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.error_message}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// ライセンスタブ
// ─────────────────────────────────────────────
function LicenseTab() {
  const [currentPlan, setCurrentPlan]   = useState('basic')
  const [expiresAt, setExpiresAt]       = useState(null)
  const [isValid, setIsValid]           = useState(true)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('basic')
  const [showConfirm, setShowConfirm]   = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')

  useEffect(() => {
    fetch(`${API}/api/licenses/default`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setCurrentPlan(data.plan || 'basic')
        setSelectedPlan(data.plan || 'basic')
        setExpiresAt(data.expires_at || null)
        setIsValid(data.is_valid !== false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handlePlanChange() {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/licenses/default`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ plan: selectedPlan }),
      })
      if (res.ok) {
        setCurrentPlan(selectedPlan)
        setSaveMsg('プランを変更しました。ページを再読み込みすると完全に反映されます。')
      } else {
        setSaveMsg('エラーが発生しました。もう一度お試しください。')
      }
    } catch {
      setSaveMsg('エラーが発生しました。')
    }
    setSaving(false)
    setShowConfirm(false)
    setTimeout(() => setSaveMsg(''), 5000)
  }

  if (loading) return <div style={{ padding: 32, color: '#9ca3af' }}>読み込み中...</div>

  const theme = PLAN_THEME[currentPlan]

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ border: `2px solid ${theme.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24, background: theme.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 4 }}>現在のプラン</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{PLAN_LABELS[currentPlan]}</div>
            <div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{PLAN_PRICES[currentPlan]}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: theme.text }}>
            {expiresAt ? `有効期限: ${new Date(expiresAt).toLocaleDateString('ja-JP')}` : '有効期限: 無期限'}
            {!isValid && <div style={{ color: '#dc2626', marginTop: 4, fontWeight: 600 }}>⚠️ ライセンスの有効期限が切れています</div>}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>プラン変更</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {['basic', 'standard', 'pro'].map(plan => {
            const t = PLAN_THEME[plan]
            const isSelected = selectedPlan === plan
            return (
              <button key={plan} onClick={() => setSelectedPlan(plan)}
                style={{
                  border: `2px solid ${isSelected ? t.border : '#e5e7eb'}`,
                  borderRadius: 10, padding: '14px 12px',
                  background: isSelected ? t.bg : '#f9fafb',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? t.text : '#6b7280', marginBottom: 2 }}>{PLAN_LABELS[plan]}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isSelected ? t.text : '#1f2937' }}>
                  {plan === 'pro' ? '¥29,800〜' : plan === 'standard' ? '¥19,800' : '¥9,800'}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>/ 月</div>
              </button>
            )
          })}
        </div>
        {selectedPlan !== currentPlan && !showConfirm && (
          <button onClick={() => setShowConfirm(true)}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: PLAN_THEME[selectedPlan].border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {PLAN_LABELS[selectedPlan]}に変更する
          </button>
        )}
        {showConfirm && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#1f2937' }}>
              <strong>{PLAN_LABELS[currentPlan]}</strong> → <strong>{PLAN_LABELS[selectedPlan]}</strong> に変更します。よろしいですか？
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePlanChange} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: PLAN_THEME[selectedPlan].border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '変更中...' : '確定する'}
              </button>
              <button onClick={() => setShowConfirm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </div>
        )}
        {saveMsg && <div style={{ marginTop: 12, fontSize: 13, color: '#059669', fontWeight: 600 }}>{saveMsg}</div>}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>現在のプランで使える機能</h2>
        {FEATURE_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', padding: '6px 12px', background: '#f9fafb', borderRadius: 6, marginBottom: 4 }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const enabled = PLAN_RANK[currentPlan] >= PLAN_RANK[item.plan]
              const t = PLAN_THEME[item.plan]
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: enabled ? '#1D9E75' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                      {enabled ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: 13, color: enabled ? '#1f2937' : '#9ca3af' }}>{item.label}</span>
                  </div>
                  {!enabled && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: t.bg, color: t.text, whiteSpace: 'nowrap' }}>
                      🔒 {PLAN_LABELS[item.plan]}以上
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────
const TABS = [
  { id: 'general',  label: 'システム設定' },
  { id: 'reminder', label: '🔔 リマインダー' },
  { id: 'license',  label: '🔑 ライセンス' },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [openDays, setOpenDays]   = useState([1,2,3,4,5,6])

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/admin/settings`, { headers: authHeader() })
      const data = await res.json()
      const flat = {}
      Object.entries(data.settings).forEach(([k, v]) => { flat[k] = v.value })
      setSettings(flat)
      if (flat.open_days) { try { setOpenDays(JSON.parse(flat.open_days)) } catch {} }
    } catch { setError('設定の取得に失敗しました') }
    setLoading(false)
  }

  async function geocodeAddress(address) {
    try {
      const url  = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=ja`
      const res  = await fetch(url, { headers: { 'User-Agent': 'SmileDental/1.0' } })
      const data = await res.json()
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {}
    return null
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const updates = { ...settings, open_days: JSON.stringify(openDays) }
      if (settings.clinic_address) {
        const coords = await geocodeAddress(settings.clinic_address)
        if (coords) { updates.clinic_lat = String(coords.lat); updates.clinic_lng = String(coords.lng) }
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
  function toggleDay(d) { setOpenDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()) }

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>読み込み中...</div>

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      {/* タブ切替 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none',
              fontSize: 14, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', transition: 'all .15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* リマインダータブ */}
      {activeTab === 'reminder' && <ReminderTab />}

      {/* ライセンスタブ */}
      {activeTab === 'license' && <LicenseTab />}

      {/* システム設定タブ */}
      {activeTab === 'general' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>システム設定</h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>患者操作の制限・診療時間・クリニック情報を管理します</p>
            </div>
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saved ? '#059669' : '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <Save size={15} />{saved ? '保存しました ✓' : saving ? '保存中...' : '保存する'}
            </button>
          </div>

          {error && <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

          {/* 診療時間・休診日 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>診療時間・休診日</h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>診療曜日・時間・昼休みを設定します</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>診療曜日</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DOW_LABELS.map((label, i) => {
                  const active = openDays.includes(i)
                  return (
                    <button key={i} onClick={() => toggleDay(i)}
                      style={{ width: 44, height: 44, borderRadius: 10, border: active ? 'none' : '1px solid #d1d5db', background: active ? (i===0 ? '#fee2e2' : i===6 ? '#dbeafe' : '#2563eb') : '#f9fafb', color: active ? (i===0 ? '#dc2626' : i===6 ? '#2563eb' : '#fff') : '#9ca3af', fontWeight: active ? 700 : 400, fontSize: 14, cursor: 'pointer', position: 'relative' }}>
                      {label}
                      {!active && <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#dc2626', fontWeight: 700 }}>休</div>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>診療開始時刻</label>
                <input type="time" value={settings.open_time || '09:00'} onChange={e => update('open_time', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>診療終了時刻</label>
                <input type="time" value={settings.close_time || '18:30'} onChange={e => update('close_time', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>昼休みあり</label>
                <div onClick={() => update('has_lunch_break', settings.has_lunch_break === 'false' ? 'true' : 'false')}
                  style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: settings.has_lunch_break === 'false' ? '#d1d5db' : '#2563eb', position: 'relative' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settings.has_lunch_break === 'false' ? 3 : 23, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
              {settings.has_lunch_break !== 'false' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>昼休み開始</label>
                    <input type="time" value={settings.lunch_start || '13:00'} onChange={e => update('lunch_start', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>昼休み終了</label>
                    <input type="time" value={settings.lunch_end || '14:00'} onChange={e => update('lunch_end', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>診療日：</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                {openDays.length === 0 ? '未設定' : DOW_LABELS.filter((_, i) => openDays.includes(i)).join('・') + '曜日'}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 16 }}>{settings.open_time || '09:00'}〜{settings.close_time || '18:30'}</span>
            </div>
          </div>

          {/* 曜日別カスタム診療時間 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>曜日別カスタム診療時間</h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>通常の診療時間と異なる曜日がある場合に設定します。</p>
            </div>
            {['月','火','水','木','金','土','日'].map((day, idx) => {
              const dow = [1,2,3,4,5,6,0][idx]
              const key = `custom_hours_${dow}`
              const isOpen = openDays.includes(dow)
              return (
                <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, background: isOpen ? (dow === 0 ? '#fee2e2' : '#dbeafe') : '#f3f4f6', color: isOpen ? (dow === 0 ? '#dc2626' : '#2563eb') : '#9ca3af' }}>
                    {day}
                  </div>
                  <span style={{ fontSize: 13, color: '#6b7280', width: 80 }}>{isOpen ? '通常診療' : '休診日'}</span>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!settings[key]}
                      onChange={e => {
                        if (e.target.checked) { update(key, JSON.stringify({ open: settings.open_time || '09:00', close: settings.close_time || '18:30' })) }
                        else { update(key, '') }
                      }} />
                    カスタム時間を設定
                  </label>
                  {settings[key] && (() => {
                    let parsed = { open: '09:00', close: '18:30' }
                    try { parsed = JSON.parse(settings[key]) } catch {}
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="time" value={parsed.open} onChange={e => update(key, JSON.stringify({ ...parsed, open: e.target.value }))}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                        <span style={{ color: '#9ca3af' }}>〜</span>
                        <input type="time" value={parsed.close} onChange={e => update(key, JSON.stringify({ ...parsed, close: e.target.value }))}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                        <span style={{ fontSize: 11, color: '#059669' }}>({day}曜のみ適用)</span>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
            <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginTop: 4, fontSize: 12, color: '#92400e' }}>
              💡 設定した曜日はLINE予約・カレンダーの空き枠計算に反映されます
            </div>
          </div>

          {/* カレンダー表示時間 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>カレンダー表示時間</h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>診療時間外でもスタッフが予約を入れられるよう、カレンダーの表示範囲を設定します。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  表示開始時刻<span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>（診療開始より前）</span>
                </label>
                <input type="time" value={settings.calendar_display_start || '07:00'} onChange={e => update('calendar_display_start', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  表示終了時刻<span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>（診療終了より後）</span>
                </label>
                <input type="time" value={settings.calendar_display_end || '21:00'} onChange={e => update('calendar_display_end', e.target.value)}
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
                        style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: settings[key] === 'true' ? '#2563eb' : '#d1d5db', position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settings[key] === 'true' ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    ) : type === 'number' ? (
                      <input type="number" value={settings[key] || ''} onChange={e => update(key, e.target.value)}
                        style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, textAlign: 'right' }} />
                    ) : (
                      <input type="text" value={settings[key] || ''} onChange={e => update(key, e.target.value)}
                        style={{ width: 260, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* マニュアル表示設定 */}
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
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`, background: isSelected ? '#eff6ff' : '#f9fafb', transition: 'all 0.15s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`, background: isSelected ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  { label: '📱 LINE予約ガイド', url: '/manual.html' },
                ].map(m => (
                  <button key={m.url} onClick={() => window.open(m.url, '_blank')}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #059669', background: '#fff', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}