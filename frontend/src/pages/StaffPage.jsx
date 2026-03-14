import { useState, useEffect } from 'react'
import axios from '../api'
import { Plus, X, Edit2 } from 'lucide-react'

const ROLE_LABEL = {
  doctor:      '歯科医師',
  hygienist:   '歯科衛生士',
  assistant:   '歯科助手',
  receptionist:'受付',
}
const DOW    = ['日','月','火','水','木','金','土']
const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#dc2626','#db2777']

export default function StaffPage() {
  const [staff, setStaff]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editStaff, setEditStaff] = useState(null)

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await axios.get('/api/staff')
      setStaff(res.data.staff || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function handleEdit(s) { setEditStaff(s); setShowModal(true) }
  function handleNew()   { setEditStaff(null); setShowModal(true) }

  async function handleDelete(s) {
    if (!window.confirm(`${s.name} を削除しますか？`)) return
    try {
      await axios.delete(`/api/staff/${s.id}`)
      fetchStaff()
    } catch { alert('削除に失敗しました') }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">スタッフ管理</h1>
        <button onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus size={16} />スタッフ追加
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {staff.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              {/* 【横スクロール対応】overflow-x-auto で内部をスクロール可能に */}
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: s.color || '#2563eb' }}>
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                      {ROLE_LABEL[s.role] || s.role}
                    </span>
                    {s.title && <span className="text-xs text-gray-400 flex-shrink-0">{s.title}</span>}
                    {!s.is_active && <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded-full flex-shrink-0">無効</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{s.name_kana}</div>
                  {s.email && <div className="text-xs text-gray-400 truncate">{s.email}</div>}
                </div>

                {/* シフト情報 */}
                <div className="flex-shrink-0 text-right">
                  <div className="flex gap-1 justify-end mb-1">
                    {DOW.map((d, i) => (
                      <span key={i} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center flex-shrink-0
                        ${s.work_days && s.work_days.includes(i)
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'bg-gray-100 text-gray-300'}`}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {s.shift_start && s.shift_end ? (
                    <div className="text-xs text-gray-400">
                      {s.shift_start.substring(0,5)} 〜 {s.shift_end.substring(0,5)}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300">シフト未設定</div>
                  )}
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(s)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(s)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <StaffModal
          staff={editStaff}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchStaff() }}
        />
      )}
    </div>
  )
}

// =============================================
// スタッフ登録・編集モーダル
// =============================================
function StaffModal({ staff, onClose, onSave }) {
  const isEdit = !!staff
  const [form, setForm] = useState({
    name:        staff?.name        || '',
    name_kana:   staff?.name_kana   || '',
    role:        staff?.role        || 'doctor',
    title:       staff?.title       || '',
    color:       staff?.color       || '#2563eb',
    email:       staff?.email       || '',
    phone:       staff?.phone       || '',
    is_active:   staff?.is_active   ?? true,
    work_days:   staff?.work_days   || [1,2,3,4,5],
    shift_start: staff?.shift_start?.substring(0,5) || '09:00',
    shift_end:   staff?.shift_end?.substring(0,5)   || '18:00',
    break_start: staff?.break_start?.substring(0,5) || '13:00',
    break_end:   staff?.break_end?.substring(0,5)   || '14:00',
  })
  const [saving, setSaving] = useState(false)

  function toggleDay(i) {
    setForm(f => ({
      ...f,
      work_days: f.work_days.includes(i)
        ? f.work_days.filter(d => d !== i)
        : [...f.work_days, i].sort((a,b) => a-b)
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('氏名は必須です'); return }
    setSaving(true)
    try {
      let staffId = staff?.id

      // ① スタッフ基本情報を保存
      if (isEdit) {
        await axios.put(`/api/staff/${staffId}`, {
          name: form.name, name_kana: form.name_kana,
          role: form.role, title: form.title,
          color: form.color, email: form.email,
          phone: form.phone, is_active: form.is_active,
        })
      } else {
        const res = await axios.post('/api/staff', {
          name: form.name, name_kana: form.name_kana,
          role: form.role, title: form.title,
          color: form.color, email: form.email,
          phone: form.phone,
        })
        staffId = res.data.staff?.id || res.data.id
      }

      // ② シフト情報を保存（work_days・勤務時間）
      await axios.put(`/api/staff/${staffId}/shift`, {
        work_days:   form.work_days,
        start_time:  form.shift_start,
        end_time:    form.shift_end,
        break_start: form.break_start,
        break_end:   form.break_end,
      })

      onSave()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || '保存に失敗しました')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">{isEdit ? 'スタッフ編集' : 'スタッフ追加'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 氏名・フリガナ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">氏名 *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="田中 一郎"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">フリガナ</label>
              <input value={form.name_kana} onChange={e => setForm(f => ({...f, name_kana: e.target.value}))}
                placeholder="タナカ イチロウ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* 役職・肩書き */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">役職 *</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">肩書き</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                placeholder="院長・副院長など"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* カラー */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">カラー</label>
            <div className="flex gap-2 flex-wrap items-center">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({...f, color: c}))}
                  className={`w-8 h-8 rounded-full transition-transform flex-shrink-0
                    ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={form.color}
                onChange={e => setForm(f => ({...f, color: e.target.value}))}
                className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5" title="カスタムカラー" />
            </div>
          </div>

          {/* 連絡先 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">メール</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                placeholder="example@clinic.jp"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">電話</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                placeholder="090-0000-0000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* 勤務曜日 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">
              勤務曜日
              <span className="ml-2 font-normal text-gray-400">（クリックでON/OFF）</span>
            </label>
            <div className="flex gap-2">
              {DOW.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-all flex-shrink-0
                    ${form.work_days.includes(i)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              選択中: {form.work_days.map(i => DOW[i]).join('・') || 'なし'}
            </p>
          </div>

          {/* 勤務時間 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">勤務時間</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">出勤</label>
                <input type="time" value={form.shift_start}
                  onChange={e => setForm(f => ({...f, shift_start: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">退勤</label>
                <input type="time" value={form.shift_end}
                  onChange={e => setForm(f => ({...f, shift_end: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">休憩開始</label>
                <input type="time" value={form.break_start}
                  onChange={e => setForm(f => ({...f, break_start: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">休憩終了</label>
                <input type="time" value={form.break_end}
                  onChange={e => setForm(f => ({...f, break_end: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* 有効/無効（編集時のみ） */}
          {isEdit && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <label className="text-xs font-semibold text-gray-600">ステータス</label>
              <button type="button" onClick={() => setForm(f => ({...f, is_active: !f.is_active}))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                {form.is_active ? '✅ 有効' : '❌ 無効（カレンダーに表示されません）'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">
            {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}
