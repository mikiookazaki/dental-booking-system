// frontend/src/pages/admin/LineDebugPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useTestMode } from '../../context/TestModeContext'
import { FlaskConical, ExternalLink, X } from 'lucide-react'

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
      const footerItems = bubble?.footer?.contents || []
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
          {footerItems.filter(item => item.type === 'button').map((item, i) => (
            <button key={i}
              onClick={() => item.action?.type === 'postback' && onPostback?.(item.action.data, item.action.label)}
              style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderTop: '1px solid #e5e7eb', background: '#fff', color: '#06C755', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
              onMouseEnter={e => e.target.style.background='#f0fdf4'} onMouseLeave={e => e.target.style.background='#fff'}>
              {item.action?.label}
            </button>
          ))}
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
                  <button key={j} onClick={() => action.type === 'postback' && onPostback?.(action.data, action.label)}
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

  // フローティングウィンドウかどうかを検出
  const isFloating = window.opener !== null || window.name === 'LineDebug'

  const [patients, setPatients]               = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [messages, setMessages]               = useState([])
  const [inputText, setInputText]             = useState('')
  const [loading, setLoading]                 = useState(false)
  const [logs, setLogs]                       = useState([])
  const [productionMode, setProductionMode]   = useState(false)
  const [deleteMsg, setDeleteMsg]             = useState(''
  const [showPatients, setShowPatients]       = useState(!isFloating)
  const [showLogs, setShowLogs]               = useState(!isFloating)
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
    // ウィンドウタイトル設定
    if (isFloating) document.title = '🦷 LINEデバッグ | スマイル歯科'
  }, [isTestMode])

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

  // フローティングウィンドウ用のコンパクトレイアウト
  if (isFloating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb', fontFamily: '"Noto Sans JP",sans-serif', overflow: 'hidden' }}>
        {/* ウィンドウヘッダー */}
        <div style={{ background: '#1e3a5f', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🦷</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>LINEデバッグ</span>
            {isTestMode && (
              <span style={{ background: 'rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>🧪 テスト</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* カレンダーを開く */}
            <button
              onClick={() => { window.opener?.focus() || window.open('/calendar', '_blank') }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} /> カレンダー
            </button>
            {/* 本番モードトグル */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: productionMode ? '#fbbf24' : 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                {productionMode ? '🔴 本番' : '⚪ シミュ'}
              </span>
              <button onClick={() => setProductionMode(!productionMode)}
                style={{ position: 'relative', width: 32, height: 18, borderRadius: 9, border: 'none', background: productionMode ? '#f59e0b' : 'rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                <span style={{ position: 'absolute', top: 2, left: productionMode ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          </div>
        </div>

        {/* テストユーザー選択（コンパクト） */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '6px 10px', flexShrink: 0 }}>
          <select
            value={selectedPatient?.id || ''}
            onChange={e => {
              const p = patients.find(p => String(p.id) === e.target.value)
              setSelectedPatient(p || null)
            }}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
            <option value="">未登録ユーザー（問診フロー用）</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} / {p.line_user_id ? 'LINE連携' : '未連携'}</option>
            ))}
          </select>
        </div>

        {/* 本番モード警告 */}
        {productionMode && (
          <div style={{ background: '#fef3c7', borderBottom: '1px solid #f59e0b', padding: '5px 12px', fontSize: 11, color: '#92400e', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ 本番モードON — DBに保存されます</span>
            <button onClick={deleteTestAppointments}
              style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #f59e0b', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#92400e' }}>
              テスト予約削除
            </button>
          </div>
        )}
        {deleteMsg && <div style={{ background: '#d1fae5', padding: '5px 12px', fontSize: 11, color: '#065f46', flexShrink: 0 }}>✅ {deleteMsg}</div>}

        {/* LINEチャット */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#06C755', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#06C755', fontWeight: 700 }}>S</div>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>スマイル歯科</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>
                {selectedPatient ? selectedPatient.name : '未登録ユーザー'}
                {isTestMode && <span style={{ marginLeft: 5, background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 8, fontSize: 9 }}>🧪</span>}
              </div>
            </div>
            <button onClick={clearChat} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
              リセット
            </button>
          </div>

          <div style={{ flex: 1, background: '#86CEAC', padding: 12, overflowY: 'auto', minHeight: 0 }}>
            {messages.map((m, i) => (
              m.type === 'user'
                ? <ChatBubble key={i} message={m.message} isUser={true} />
                : <ChatBubble key={i} message={m.message} isUser={false} onPostback={handlePostback} />
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>S</div>
                <div style={{ background: '#fff', borderRadius: '2px 12px 12px 12px', padding: '8px 12px', fontSize: 12, color: '#999', border: '1px solid #e5e7eb' }}>入力中...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* クイックボタン */}
          <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '6px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            {QUICK.map(s => (
              <button key={s.text} onClick={() => sendMessage(s.text)}
                style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #06C755', background: '#fff', color: '#06C755', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* 入力エリア */}
          <div style={{ padding: '8px 10px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input type="text" value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && inputText.trim() && sendMessage(inputText)}
              placeholder="メッセージを入力..."
              style={{ flex: 1, padding: '7px 12px', borderRadius: 18, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none' }} />
            <button onClick={() => inputText.trim() && sendMessage(inputText)} disabled={loading || !inputText.trim()}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#06C755', color: '#fff', cursor: 'pointer', fontSize: 14, opacity: loading || !inputText.trim() ? 0.5 : 1, flexShrink: 0 }}>↑</button>
          </div>
        </div>

        {/* APIログ（折りたたみ） */}
        <div style={{ background: '#111827', borderTop: '1px solid #374151', flexShrink: 0 }}>
          <button onClick={() => setShowLogs(v => !v)}
            style={{ width: '100%', padding: '5px 12px', background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
            <span>APIログ {logs.length > 0 ? `(${logs.length})` : ''}</span>
            <span>{showLogs ? '▼' : '▲'}</span>
          </button>
          {showLogs && (
            <div style={{ padding: '6px 12px', maxHeight: 120, overflowY: 'auto' }}>
              {logs.length === 0
                ? <div style={{ color: '#6b7280', fontSize: 10 }}>送信するとログが表示されます</div>
                : logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: 3, fontSize: 10, fontFamily: 'monospace' }}>
                    <span style={{ color: '#6b7280' }}>[{log.timeStr}] </span>
                    <span style={{ color: log.type === 'reply' ? '#34d399' : '#60a5fa' }}>{log.type === 'reply' ? 'REPLY' : 'PUSH'}</span>
                    <span style={{ color: '#d1d5db' }}> {log.messages?.length}件</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    )
  }

  // 通常レイアウト（管理画面内埋め込み）
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, padding: 24, height: 'calc(100vh - 48px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>LINE デバッグ</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>スーパー管理者専用 — 実際のLINE Bot動作をシミュレート</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isTestMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#fef3c7', border: '1px solid #f59e0b', fontSize: 11, color: '#92400e', fontWeight: 600 }}>
                <FlaskConical size={12} />テストモード
              </div>
            )}
            {/* フローティングウィンドウで開くボタン */}
            <button
              onClick={() => {
                const w = window.open('/line-debug-window', 'LineDebug', 'width=560,height=900,left=100,top=50,resizable=yes')
                w?.focus()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <ExternalLink size={13} /> 別ウィンドウで開く
            </button>
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
