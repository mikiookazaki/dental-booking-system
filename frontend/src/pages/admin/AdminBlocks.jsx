// frontend/src/pages/admin/AdminBlocks.jsx
import { useState, useEffect } from 'react'
import { Plus, Trash2, CalendarOff } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''
function authHeader() {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export default function AdminBlocks() {
  const [blocks, setBlocks]   = useState([])
  const [chairs, setChairs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    block_date: '', start_time: '', end_time: '',
    affects_all: true, reason: '', chair_ids: [],
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [bRes, cRes] = await Promise.all([
        fetch(`${API}/api/admin/blocked-slots`, { headers: authHeader() }),
        fetch(`${API}/api/chairs`),
      ])
      const bData = await bRes.json()
      const cData = await cRes.json()
      setBlocks(bData.blocked_slots || [])
      setChairs(cData.chairs || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    try {
      await fetch(`${API}/api/admin/blocked-slots`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setForm({ block_date: '', start_time: '', end_time: '', affects_all: true, reason: '', chair_ids: [] })
      fetchData()
    } catch (err) { alert('追加に失敗しました') }
  }

  async function handleDelete(id) {
    if (!confirm('このブロックを削除しますか？')) return
    await fetch(`${API}/api/admin/blocked-slots/${id}`, { method: 'DELETE', headers: authHeader() })
    fetchData()
  }

  function toggleChair(id) {
    setForm(prev => ({
      ...prev,
      chair_ids: prev.chair_ids.includes(id)
        ? prev.chair_ids.filter(c => c !== id)
        : [...prev.chair_ids, id],
    }))
  }

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>予約制限管理</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>特定の日時・チェアを予約不可に設定します</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
            borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} />ブロックを追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginTop: 0, marginBottom: 16 }}>新しいブロックを追加</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>日付 *</label>
                <input type="date" required value={form.block_date}
                  onChange={e => setForm({...form, block_date: e.target.value})}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>開始時刻（空白=終日）</label>
                <input type="time" value={form.start_time}
                  onChange={e => setForm({...form, start_time: e.target.value})}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>終了時刻</label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm({...form, end_time: e.target.value})}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>理由 *</label>
              <input required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                placeholder="例：院内研修、学会参加"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>対象</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={form.affects_all} onChange={() => setForm({...form, affects_all: true, chair_ids: []})} />
                  全チェア（終日/指定時間）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={!form.affects_all} onChange={() => setForm({...form, affects_all: false})} />
                  特定チェアのみ
                </label>
              </div>
              {!form.affects_all && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  {chairs.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.chair_ids.includes(c.id)} onChange={() => toggleChair(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                キャンセル
              </button>
              <button type="submit"
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                追加する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ブロック一覧 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
        ) : blocks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            <CalendarOff size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
            ブロックが設定されていません
          </div>
        ) : blocks.map((b, idx) => (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: idx < blocks.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                background: '#fef3c7', color: '#92400e', borderRadius: 6,
                padding: '4px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {b.block_date?.substring(0,10)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{b.reason}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {b.start_time ? `${b.start_time.substring(0,5)}〜${b.end_time?.substring(0,5) || ''}` : '終日'}
                  　{b.affects_all ? '全チェア' : `チェア指定（${b.chair_ids?.join(', ')}）`}
                </div>
              </div>
            </div>
            <button onClick={() => handleDelete(b.id)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6 }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
