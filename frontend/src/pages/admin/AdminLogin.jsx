// frontend/src/pages/admin/AdminLogin.jsx
import { useState } from 'react'
import axios from '../../api'

export default function AdminLogin({ onLogin }) {
  const [mode, setMode]         = useState('admin') // 'admin' | 'staff'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { username, password })

      if (mode === 'admin') {
        // admin と superadmin 両方を管理者ログインとして許可
        if (res.data.role !== 'admin' && res.data.role !== 'superadmin') {
          setError('管理者権限がありません')
          setLoading(false)
          return
        }
        localStorage.setItem('admin_token', res.data.token)
        localStorage.setItem('admin_role',  res.data.role)
        localStorage.setItem('admin_name',  res.data.username)
        onLogin()
      } else {
        // スタッフログイン → カレンダーへ
        localStorage.setItem('admin_token', res.data.token)
        localStorage.setItem('admin_role',  res.data.role)
        localStorage.setItem('admin_name',  res.data.username)
        window.location.href = '/calendar'
      }
    } catch (err) {
      setError(err.response?.data?.error || 'ログインに失敗しました')
    }
    setLoading(false)
  }

  const isAdmin = mode === 'admin'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🦷</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>スマイル歯科</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>管理システム</div>
        </div>

        {/* モード切替 */}
        <div style={{
          display: 'flex', borderRadius: 10, overflow: 'hidden',
          border: '1px solid #e5e7eb', marginBottom: 20,
        }}>
          {[['admin','🔐 管理者'],['staff','👨‍⚕️ スタッフ']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setMode(v); setError('') }}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: mode === v ? (v === 'admin' ? '#2563eb' : '#059669') : '#f9fafb',
                color: mode === v ? '#fff' : '#6b7280',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{
          background: isAdmin ? '#eff6ff' : '#f0fdf4', borderRadius: 8,
          padding: '8px 12px', marginBottom: 20, fontSize: 12,
          color: isAdmin ? '#1d4ed8' : '#065f46',
        }}>
          {isAdmin
            ? '管理者としてログイン。ダッシュボード・システム設定にアクセスできます。'
            : 'スタッフとしてログイン。予約カレンダー・患者管理にアクセスできます。'}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>ユーザー名</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              required autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>パスワード</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : isAdmin ? '#2563eb' : '#059669',
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'ログイン中...' : `${isAdmin ? '管理者' : 'スタッフ'}としてログイン`}
          </button>
        </form>
      </div>
    </div>
  )
}
