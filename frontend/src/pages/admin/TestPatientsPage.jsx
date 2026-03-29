// frontend/src/pages/admin/TestPatientsPage.jsx
import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Save, X, FlaskConical, RefreshCw } from 'lucide-react'
import api from '../../api'

const API = import.meta.env.VITE_API_URL || ''

function authHeader() {
  const token = localStorage.getItem('admin_token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-test-mode': 'true',
  }
}

const EMPTY_FORM = {
  name: '', name_kana: '', phone: '', email: '',
  birth_date: '', gender: '', address: '', notes: '',
  age_group: '', postal_code: '', referral_source: '',
}

const AGE_GROUPS   = ['10代','20代','30代','40代','50代','60代','70代','80代','90代以上']
const GENDER_OPTS  = [{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }, { value: 'other', label: 'その他' }]
const REFERRAL_OPTS = ['インターネット検索','SNS・Instagram','公式HP','ご紹介','看板・チラシ','TVCM','その他']

// デモ用テストデータ一括投入
const DEMO_PATIENTS = [
  { name: 'テスト 太郎',   name_kana: 'テスト タロウ',   phone: '090-0001-0001', gender: 'male',   age_group: '40代', referral_source: 'インターネット検索', notes: 'デモ用患者①' },
  { name: 'テスト 花子',   name_kana: 'テスト ハナコ',   phone: '090-0001-0002', gender: 'female', age_group: '30代', referral_source: 'ご紹介',           notes: 'デモ用患者②' },
  { name: 'テスト 次郎',   name_kana: 'テスト ジロウ',   phone: '090-0001-0003', gender: 'male',   age_group: '50代', referral_source: 'SNS・Instagram',   notes: 'デモ用患者③' },
  { name: 'テスト 三郎',   name_kana: 'テスト サブロウ',  phone: '090-0001-0004', gender: 'male',   age_group: '20代', referral_source: '公式HP',           notes: 'デモ用患者④' },
  { name: 'テスト 幸子',   name_kana: 'テスト サチコ',   phone: '090-0001-0005', gender: 'female', age_group: '60代', referral_source: '看板・チラシ',       notes: 'デモ用患者⑤' },
]

export default function TestPatientsPage() {
  const [patients, setPatients]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoMsg, setDemoMsg]     = useState('')

  useEffect(() => { fetchPatients() }, [])

  async function fetchPatients() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/patients`, { headers: authHeader() })
      const data = await res.json()
      setPatients(data.patients || [])
    } catch { setPatients([]) }
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name?.trim())       { setError('氏名は必須です'); return }
    if (!form.name_kana?.trim())  { setError('フリガナは必須です'); return }
    setSaving(true); setError('')
    try {
      const url    = editId ? `${API}/api/patients/${editId}` : `${API}/api/patients`
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: authHeader(),
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || '保存に失敗しました')
      } else {
        setShowForm(false); setEditId(null); setForm(EMPTY_FORM)
        fetchPatients()
      }
    } catch { setError('保存に失敗しました') }
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`「${name}」を削除しますか？`)) return
    try {
      await fetch(`${API}/api/patients/${id}`, { method: 'DELETE', headers: authHeader() })
      fetchPatients()
    } catch {}
  }

  async function handleEdit(patient) {
    setForm({
      name:             patient.name             || '',
      name_kana:        patient.name_kana        || '',
      phone:            patient.phone            || '',
      email:            patient.email            || '',
      birth_date:       patient.birth_date       || '',
      gender:           patient.gender           || '',
      address:          patient.address          || '',
      notes:            patient.notes            || '',
      age_group:        patient.age_group        || '',
      postal_code:      patient.postal_code      || '',
      referral_source:  patient.referral_source  || '',
    })
    setEditId(patient.id)
    setShowForm(true)
    setError('')
  }

  async function handleDemoInsert() {
    if (!window.confirm(`デモ用テストデータ ${DEMO_PATIENTS.length}件 を一括登録しますか？`)) return
    setDemoLoading(true); setDemoMsg('')
    let count = 0
    for (const p of DEMO_PATIENTS) {
      try {
        const res = await fetch(`${API}/api/patients`, {
          method: 'POST', headers: authHeader(),
          body: JSON.stringify(p),
        })
        if (res.ok) count++
      } catch {}
    }
    setDemoMsg(`✅ ${count}件 登録しました`)
    setDemoLoading(false)
    fetchPatients()
    setTimeout(() => setDemoMsg(''), 4000)
  }

  async function handleDeleteAll() {
    if (!window.confirm('テストデータを全て削除しますか？この操作は元に戻せません。')) return
    for (const p of patients) {
      try {
        await fetch(`${API}/api/patients/${p.id}`, { method: 'DELETE', headers: authHeader() })
      } catch {}
    }
    fetchPatients()
  }

  function update(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FlaskConical size={22} color="#d97706" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>テスト患者管理</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
              デバッグ・デモ用のテストデータを管理します。本番データには影響しません。
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchPatients}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            <RefreshCw size={14} />更新
          </button>
          <button onClick={handleDemoInsert} disabled={demoLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b', background: '#fef3c7', fontSize: 13, cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>
            <FlaskConical size={14} />{demoLoading ? '登録中...' : 'デモデータ一括登録'}
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} />新規追加
          </button>
        </div>
      </div>

      {/* デモ登録結果メッセージ */}
      {demoMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', fontWeight: 600 }}>
          {demoMsg}
        </div>
      )}

      {/* テストモードバナー */}
      <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
        <FlaskConical size={14} />
        ここで作成・編集した患者データはテストモード専用です。本番の患者データとは完全に分離されています。
      </div>

      {/* 新規作成・編集フォーム */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>
              {editId ? '患者情報を編集' : 'テスト患者を新規作成'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setError('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={20} />
            </button>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { key: 'name',     label: '氏名 *',   type: 'text', placeholder: '山田 花子' },
              { key: 'name_kana',label: 'フリガナ *', type: 'text', placeholder: 'ヤマダ ハナコ' },
              { key: 'phone',    label: '電話番号',  type: 'text', placeholder: '090-1234-5678' },
              { key: 'email',    label: 'メール',    type: 'email', placeholder: 'test@example.com' },
              { key: 'birth_date', label: '生年月日', type: 'date', placeholder: '' },
              { key: 'postal_code', label: '郵便番号', type: 'text', placeholder: '150-0001' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>性別</label>
              <select value={form.gender} onChange={e => update('gender', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                <option value="">選択してください</option>
                {GENDER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>年代</label>
              <select value={form.age_group} onChange={e => update('age_group', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                <option value="">選択してください</option>
                {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>来院きっかけ</label>
              <select value={form.referral_source} onChange={e => update('referral_source', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                <option value="">選択してください</option>
                {REFERRAL_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>メモ</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
              <Save size={14} />{saving ? '保存中...' : '保存する'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setError('') }}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 患者一覧 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
            テスト患者一覧 <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>（{patients.length}件）</span>
          </span>
          {patients.length > 0 && (
            <button onClick={handleDeleteAll}
              style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              全て削除
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>読み込み中...</div>
        ) : patients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            テスト患者データがありません。<br />「デモデータ一括登録」または「新規追加」から追加してください。
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['患者番号','氏名','フリガナ','電話番号','年代','LINE連携','メモ','操作'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{p.patient_code}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{p.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{p.name_kana}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.phone || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.age_group || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.line_user_id
                      ? <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>連携済</span>
                      : <span style={{ fontSize: 11, background: '#f3f4f6', color: '#9ca3af', padding: '2px 8px', borderRadius: 20 }}>未連携</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleEdit(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#374151' }}>
                        <Edit2 size={11} />編集
                      </button>
                      <button onClick={() => handleDelete(p.id, p.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}>
                        <Trash2 size={11} />削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}