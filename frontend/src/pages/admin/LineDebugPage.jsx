// frontend/src/pages/admin/LineDebugPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useTestMode } from '../../context/TestModeContext'
import { FlaskConical } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

function authHeader() {
  const token      = localStorage.getItem('admin_token')
  const isTestMode = localStorage.getItem('test_mode') === 'true'
  const role       = localStorage.getItem('admin_role') || ''
  return {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(isTestMode && role === 'superadmin' ? { 'x-test-mode': 'true' } : {}),
  }
}

function ChatBubble({ message, isUser, onPostback }) {
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={{ background: '#06C755', color: '#fff', padding: '10px 14px', borderRadius: '14px 2px 14px 14px', fontSize: 13, maxWidth: 240, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.text}
        </div>
      </div>
    )
  }

  const renderContent = (msg) => {
    if (msg.type === 'text') {
      return (
        <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '2px 14px 14px 14px', fontSize: 13, maxWidth: 280, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #e5e7eb' }}>
          {msg.text}
        </div>
      )
    }
    if (msg.type === 'flex') {
      const bubble = msg.contents
      const header = bubble?.header?.contents?.[0]?.text
      const bgColor = bubble?.header?.backgroundColor || '#06C755'
      const bodyItems = bubble?.body?.contents || []
      return (
        <div style={{ maxWidth: 280, borderRadius: '2px 14px 14px 14px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          {header && (
            <div style={{ background: bgColor, padding: '10px 14px' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{header}</div>
            </div>
          )}
          <div style={{ background: '#fff', padding: '10px 14px' }}>
            {bodyItems.filter(item => item.type === 'text').map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: item.color || '#333', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{item.text}</div>
            ))}
          </div>
        </div>
      )
    }
    if (msg.type === 'template') {
      const t = msg.template
      if (t.type === 'carousel') {
        return (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: 340, paddingBottom: 4 }}>
            {(t.columns || []).map((col, i) => (
              <div key={i} style={{ minWidth: 180, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{col.title}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{col.text}</div>
                </div>
                {(col.actions || []).map((action, j) => (
                  <button key={j} onClick={() => action.type === 'postback' && onPostback && onPostback(action.data, action.label)}
                    style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderTop: j > 0 ? '1px solid #e5e7eb' : 'none', background: '#fff', color: '#06C755', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                    onMouseEnter={e => e.target.style.background='#f0fdf4'} onMouseLeave={e => e.target.style.background='#fff'}>
                    {action.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )
      }
      return (
        <div style={{ maxWidth: 280, background: '#fff', borderRadius: '2px 14px 14px 14px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '10px 14px', fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.text}</div>
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            {(t.actions || []).map((action, i) => (
              <button key={i}
                onClick={() => { if (action.type === 'postback' && onPostback) onPostback(action.data, action.label); else if (action.type === 'message' && onPostback) onPostback(null, action.text, action.text); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 13, color: '#06C755', fontWeight: 500, border: 'none', borderBottom: i < t.actions.length-1 ? '1px solid #e5e7eb' : 'none', background: '#fff', cursor: 'pointer', textAlign: 'center' }}
                onMouseEnter={e => e.target.style.background='#f0fdf4'} onMouseLeave={e => e.target.style.background='#fff'}>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return <div style={{ fontSize: 12, color: '#666', background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>[{msg.type}]</div>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>S</div>
      <div>{renderContent(message)}</div>
    </div>
  )
}

export default function LineDebugPage() {
  const { isTestMode } = useTestMode()
  const [patients, setPatients]               = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [messages, setMessages]               = useState([])
  const [inputText, setInputText]             = useState('')
  const [loading, setLoading]                 = useState(false)
  const [logs, setLogs]                       = useState([])
  const [productionMode, setProductionMode]   = useState(false)
  const [deleteMsg, setDeleteMsg]             = useState('')
  const chatEndRef = useRef(null)

  const QUICK = [
    { label: '予約する',   text: '予約する' },
    { label: 'キャンセル', text: 'キャンセル' },
    { label: '予約確認',   text: '予約確認' },
    { label: 'フォロー',   text: 'follow' },
  ]

  useEffect(() => {
    fetchPatients()
    setMessages([{ type: 'bot', message: { type: 'text', text: 'スマイル歯科クリニックへようこそ！\n\nご予約・変更・キャンセルはメニューからどうぞ。' } }])
  }, [isTestMode]) // テストモード切替時に患者一覧を再取得

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchPatients() {
    try {
      const res  = await fetch(`${API}/api/line-debug/patients`, { headers: authHeader() })
      const data = await res.json()
      setPatients(data.patients || [])
      setSelectedPatient(data.patients?.[0] || null)
    } catch (err) { console.error(err) }
  }

  async function sendMessage(text, isPostback = false, postbackData = null, displayText = null) {
    if (!text && !postbackData) return
    setLoading(true)
    const userText = displayText || text
    if (userText && userText !== 'follow') {
      setMessages(prev => [...prev, { type: 'user', message: { type: 'text', text: userText } }])
    }
    try {
      let endpoint, body
      if (isPostback && postbackData) {
        endpoint = '/api/line-debug/postback'
        body = { data: postbackData, patientId: selectedPatient?.id, productionMode }
      } else {
        endpoint = '/api/line-debug/simulate'
        body = { type: text === 'follow' ? 'follow' : 'message', text, patientId: selectedPatient?.id, productionMode }
      }
      const res  = await fetch(`${API}${endpoint}`, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) })
      const data = await res.json()
      if (data.responses) data.responses.forEach(msg => setMessages(prev => [...prev, { type: 'bot', message: msg }]))
      if (data.logs)      setLogs(prev => [...data.logs.map(l => ({ ...l, timeStr: new Date(l.time).toLocaleTimeString('ja-JP') })), ...prev].slice(0, 50))
      if (data.error)     setMessages(prev => [...prev, { type: 'bot', message: { type: 'text', text: `エラー: ${data.error}` } }])
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', message: { type: 'text', text: `通信エラー: ${err.message}` } }])
    }
    setInputText('')
    setLoading(false)
  }

  function handlePostback(postbackData, label, messageText = null) {
    if (messageText) sendMessage(messageText, false, null, label)
    else if (postbackData) sendMessage(null, true, postbackData, label)
  }

  function clearChat() {
    setMessages([{ type: 'bot', message: { type: 'text', text: 'チャットをリセットしました。' } }])
    setLogs([])
  }

  async function deleteTestAppointments() {
    try {
      const url  = selectedPatient
        ? `${API}/api/line-debug/test-appointments?patientId=${selectedPatient.id}`
        : `${API}/api/line-debug/test-appointments`
      const res  = await fetch(url, { method: 'DELETE', headers: authHeader() })
      const data = await res.json()
      setDeleteMsg(data.message || 'テスト予約を削除しました')
      setTimeout(() => setDeleteMsg(''), 3000)
    } catch {
      setDeleteMsg('削除に失敗しました')
      setTimeout(() => setDeleteMsg(''), 3000)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, padding: 24, height: 'calc(100vh - 48px)', boxSizing: 'border-box' }}>

      {/* 左: LINEシミュレーター */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>LINE デバッグ</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>スーパー管理者専用 — 実際のLINE Bot動作をシミュレート</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* テストモードバッジ */}
            {isTestMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#fef3c7', border: '1px solid #f59e0b', fontSize: 11, color: '#92400e', fontWeight: 600 }}>
                <FlaskConical size={12} />テストモード
              </div>
            )}
            {/* 本番モードトグル */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: productionMode ? '#FEF3C7' : '#F3F4F6', border: `1px solid ${productionMode ? '#F59E0B' : '#E5E7EB'}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: productionMode ? '#92400E' : '#6B7280' }}>
                {productionMode ? '🔴 本番モード' : '⚪ シミュレーション'}
              </span>
              <button onClick={() => setProductionMode(!productionMode)}
                style={{ position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none', background: productionMode ? '#F59E0B' : '#D1D5DB', cursor: 'pointer', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 2, left: productionMode ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
            <button onClick={clearChat}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
              リセット
            </button>
          </div>
        </div>

        {/* 本番モード警告 */}
        {productionMode && (
          <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>⚠️ 本番モードON — 予約確定するとDBに保存されます（source: line_debug）</span>
            <button onClick={deleteTestAppointments}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #F59E0B', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#92400E', fontWeight: 600 }}>
              テスト予約を削除
            </button>
          </div>
        )}
        {deleteMsg && (
          <div style={{ background: '#D1FAE5', border: '1px solid #10B981', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#065F46', flexShrink: 0 }}>
            ✅ {deleteMsg}
          </div>
        )}

        {/* LINEチャット */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#06C755', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#06C755', fontWeight: 700 }}>S</div>
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>スマイル歯科</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                テスト中: {selectedPatient ? selectedPatient.name : '未登録ユーザー'}
                {isTestMode && <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 10, fontSize: 10 }}>🧪 テスト</span>}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#86CEAC', padding: 16, overflowY: 'auto', minHeight: 0 }}>
            {messages.map((m, i) => (
              m.type === 'user'
                ? <ChatBubble key={i} message={m.message} isUser={true} />
                : <ChatBubble key={i} message={m.message} isUser={false} onPostback={handlePostback} />
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff' }}>S</div>
                <div style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', padding: '10px 14px', fontSize: 13, color: '#999', border: '1px solid #e5e7eb' }}>入力中...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input type="text" value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && inputText.trim() && sendMessage(inputText)}
              placeholder="メッセージを入力..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
            <button onClick={() => inputText.trim() && sendMessage(inputText)} disabled={loading || !inputText.trim()}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#06C755', color: '#fff', cursor: 'pointer', fontSize: 16, opacity: loading || !inputText.trim() ? 0.5 : 1 }}>↑</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {QUICK.map(s => (
            <button key={s.text} onClick={() => sendMessage(s.text)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #06C755', background: '#fff', color: '#06C755', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 右: コントロールパネル */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>テストユーザー</div>
            {isTestMode && (
              <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                🧪 テストデータ
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            <div onClick={() => setSelectedPatient(null)}
              style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, border: `1px solid ${!selectedPatient ? '#06C755' : '#e5e7eb'}`, background: !selectedPatient ? '#f0fdf4' : '#f9fafb', color: !selectedPatient ? '#065f46' : '#374151' }}>
              未登録ユーザー（問診フロー用）
            </div>
            {patients.map(p => (
              <div key={p.id} onClick={() => setSelectedPatient(p)}
                style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, border: `1px solid ${selectedPatient?.id === p.id ? '#06C755' : '#e5e7eb'}`, background: selectedPatient?.id === p.id ? '#f0fdf4' : '#f9fafb', color: selectedPatient?.id === p.id ? '#065f46' : '#374151' }}>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>
                  {p.patient_code} / {p.line_user_id ? 'LINE連携済' : '未連携'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 10 }}>APIログ</div>
          <div style={{ background: '#111827', borderRadius: 8, padding: 10, minHeight: 120, maxHeight: 300, overflowY: 'auto' }}>
            {logs.length === 0
              ? <div style={{ color: '#6b7280', fontSize: 11 }}>メッセージを送信するとログが表示されます</div>
              : logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 4, fontSize: 11, fontFamily: 'monospace' }}>
                  <span style={{ color: '#6b7280' }}>[{log.timeStr}] </span>
                  <span style={{ color: log.type === 'reply' ? '#34d399' : '#60a5fa' }}>{log.type === 'reply' ? 'REPLY' : 'PUSH'}</span>
                  <span style={{ color: '#d1d5db' }}> {log.messages?.length}件</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}