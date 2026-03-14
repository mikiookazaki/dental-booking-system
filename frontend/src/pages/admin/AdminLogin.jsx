// frontend/src/pages/admin/AdminLogin.jsx
import { useState } from 'react'
import axios from '../../api'

export default function AdminLogin({ onLogin }) {
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
      if (res.data.role !== 'admin') {
        setError('管理者権限がありません')
        setLoading(false)
        return
      }
      localStorage.setItem('admin_token', res.data.token)
      localStorage.setItem('admin_role',  res.data.role)
      localStorage.setItem('admin_name',  res.data.username)
      onLogin()
    } catch (err) {
      setError(err.response?.data?.error || 'ログインに失敗しました')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🦷</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>スマイル歯科</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>管理者ログイン</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>ユーザー名</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              required autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>パスワード</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
