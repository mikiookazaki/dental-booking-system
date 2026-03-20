import { useState, useEffect } from 'react'
import axios from '../api'
import { Search, Plus, X, QrCode, Pencil } from 'lucide-react'

// 年代自動計算
function calcAgeGroup(birthDate) {
  if (!birthDate) return null;
  const age = Math.floor((new Date() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 365.25));
  return `${Math.floor(age / 10) * 10}代`;
}

const AGE_GROUPS = ['10代','20代','30代','40代','50代','60代','70代','80代','90代以上'];

// カタカナバリデーション
function validateKana(val) {
  if (!val || !val.trim()) return 'フリガナ（カタカナ）は必須です'
  if (!/^[ァ-ヶー　\s]+$/.test(val.trim())) return 'カタカナで入力してください（例: ヤマダ タロウ）'
  return ''
}

export default function PatientsPage() {
  const [patients, setPatients]       = useState([])
  const [query, setQuery]             = useState('')
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)  // 編集対象患者
  const [qrData, setQrData]           = useState(null)
  const [qrLoading, setQrLoading]     = useState(false)
  const [form, setForm] = useState({
    name: '', name_kana: '', phone: '', birth_date: '', gender: '', age_group: '', postal_code: '', referral_source: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => { fetchPatients() }, [])

  // 編集ボタンクリック
  function handleEdit(p) {
    setEditPatient(p)
    setForm({
      name:             p.name || '',
      name_kana:        p.name_kana || '',
      phone:            p.phone || '',
      birth_date:       p.birth_date?.substring(0,10) || '',
      gender:           p.gender || '',
      age_group:        p.age_group || '',
      postal_code:      p.postal_code || '',
      referral_source:  p.referral_source || '',
      notes:            p.notes || '',
    })
    setErrors({})
    setShowModal(true)
  }

  // 編集保存
  async function handleUpdate(e) {
    e.preventDefault()
    const kanaErr = validateKana(form.name_kana)
    if (kanaErr) { setErrors({ name_kana: kanaErr }); return }
    try {
      const age_group = form.birth_date ? calcAgeGroup(form.birth_date) : form.age_group
      await axios.put(`/api/patients/${editPatient.id}`, { ...form, age_group })
      setShowModal(false)
      setEditPatient(null)
      setForm({ name:'', name_kana:'', phone:'', birth_date:'', gender:'', age_group:'', postal_code:'', referral_source:'', notes:'' })
      fetchPatients()
    } catch (err) {
      alert(err.response?.data?.error || '更新に失敗しました')
    }
  }

  async function fetchPatients() {
    setLoading(true)
    try {
      const res = await axios.get(`/api/patients${query ? `?q=${query}` : ''}`)
      setPatients(res.data.patients || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleSearch(e) {
    e.preventDefault()
    fetchPatients()
  }

  // フィールド更新＋リアルタイムバリデーション
  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (key === 'name') {
      setErrors(e => ({ ...e, name: val.trim() ? '' : '氏名は必須です' }))
    }
    if (key === 'name_kana') {
      setErrors(e => ({ ...e, name_kana: validateKana(val) }))
    }
  }

  function validate() {
    const errs = {}
    if (!form.name?.trim()) errs.name = '氏名は必須です'
    const kanaErr = validateKana(form.name_kana)
    if (kanaErr) errs.name_kana = kanaErr
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!validate()) return
    try {
      const age_group = form.birth_date ? calcAgeGroup(form.birth_date) : form.age_group;
      await axios.post('/api/patients', { ...form, age_group })
      setShowModal(false)
      setForm({ name: '', name_kana: '', phone: '', birth_date: '', gender: '', age_group: '', postal_code: '', referral_source: '' })
      setErrors({})
      fetchPatients()
    } catch (err) {
      alert(err.response?.data?.error || '登録に失敗しました')
    }
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditPatient(null)
    setForm({ name: '', name_kana: '', phone: '', birth_date: '', gender: '', age_group: '', postal_code: '', referral_source: '', notes: '' })
    setErrors({})
  }

  async function handleShowQR(patient) {
    setQrData(null)
    setShowQRModal(true)
    setQrLoading(true)
    try {
      const res = await axios.get(`/api/patients/${patient.id}/qr`)
      setQrData({ ...res.data, patientName: patient.name })
    } catch (err) {
      alert('QRコードの取得に失敗しました')
      setShowQRModal(false)
    }
    setQrLoading(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">患者管理</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} />新規患者登録
        </button>
      </div>

      {/* 検索 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="氏名・カナ・患者番号・レセコンID・電話番号で検索"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button type="submit" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          <Search size={18} />
        </button>
      </form>

      {/* 患者一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">患者番号</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">氏名</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">カナ</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">年代</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">電話番号</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">郵便番号</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">来院きっかけ</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">来院回数</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">LINE</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">QR</th>
              <th className="p-3 border-b border-gray-200"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">読み込み中...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">患者が見つかりません</td></tr>
            ) : patients.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 border-b border-gray-100">
                <td className="p-3 font-mono text-gray-500">
                  {p.patient_code}
                  {p.rececon_id && (
                    <span className="ml-1 px-1 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                      レセコン
                    </span>
                  )}
                </td>
                <td className="p-3 font-medium text-gray-800">{p.name}</td>
                <td className="p-3 text-gray-500">{p.name_kana || '-'}</td>
                <td className="p-3 text-gray-600">
                  {p.birth_date ? calcAgeGroup(p.birth_date) : (p.age_group || '-')}
                </td>
                <td className="p-3 text-gray-600">{p.phone || '-'}</td>
                <td className="p-3 text-gray-500 font-mono text-xs">{p.postal_code || '-'}</td>
                <td className="p-3">
                  {p.referral_source ? (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      {p.referral_source}
                    </span>
                  ) : '-'}
                </td>
                <td className="p-3 text-gray-600">{p.total_visits}回</td>
                <td className="p-3">
                  {p.line_user_id
                    ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">連携済み</span>
                    : <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">未連携</span>
                  }
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleShowQR(p)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100"
                  >
                    <QrCode size={14} />QR
                  </button>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleEdit(p)}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs hover:bg-gray-100 border border-gray-200"
                  >
                    <Pencil size={13} />編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QRコードモーダル */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">LINE連携QRコード</h3>
              <button onClick={() => setShowQRModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            {qrLoading ? (
              <div className="text-center py-10 text-gray-400">読み込み中...</div>
            ) : qrData ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-gray-700">
                  {qrData.name} 様（{qrData.patient_code}）
                </p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qr_url)}`}
                  alt="QRコード"
                  className="w-48 h-48 border border-gray-200 rounded-lg"
                />
                <p className="text-xs text-gray-500 text-center">
                  このQRコードはこの患者番号に<br />
                  永久に紐づいています
                </p>
                {qrData.line_linked ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    ✅ LINE連携済み
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs">
                    未連携 / スマホのLINEカメラで読み取ってください
                  </span>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(qrData.qr_url)}
                  className="w-full py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                >
                  URLをコピー
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 新規登録モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">新規患者登録（初診）</h3>
              <button onClick={handleCloseModal}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              ※ 患者番号は自動採番されます。詳細情報は登録後に追加できます。
            </p>
            <form onSubmit={editPatient ? handleUpdate : handleCreate} className="space-y-3">

              {/* 氏名 */}
              <div>
                <label className="text-xs text-gray-500">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="例: 山田 太郎"
                  className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2
                    ${errors.name
                      ? 'border-red-400 focus:ring-red-300'
                      : 'border-gray-300 focus:ring-blue-300'}`}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>
                )}
              </div>

              {/* フリガナ（カタカナ必須）*/}
              <div>
                <label className="text-xs text-gray-500">
                  フリガナ <span className="text-red-500">*</span>
                  <span className="text-gray-400 ml-1">（カタカナ）</span>
                </label>
                <input
                  value={form.name_kana}
                  onChange={e => setField('name_kana', e.target.value)}
                  placeholder="例: ヤマダ タロウ"
                  className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2
                    ${errors.name_kana
                      ? 'border-red-400 focus:ring-red-300'
                      : 'border-gray-300 focus:ring-blue-300'}`}
                />
                {errors.name_kana ? (
                  <p className="text-xs text-red-500 mt-0.5">{errors.name_kana}</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">カタカナのみ入力可</p>
                )}
              </div>

              {/* 電話番号 */}
              <div>
                <label className="text-xs text-gray-500">電話番号</label>
                <input
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="090-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* 生年月日 */}
              <div>
                <label className="text-xs text-gray-500">生年月日</label>
                <input
                  type="date" value={form.birth_date}
                  onChange={e => setField('birth_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* 性別 */}
              <div>
                <label className="text-xs text-gray-500">性別</label>
                <select
                  value={form.gender}
                  onChange={e => setField('gender', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">選択してください</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>

              {/* 備考・アレルギー（編集時のみ表示） */}
              {editPatient && (
                <div>
                  <label className="text-xs text-gray-500">備考・アレルギー</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={e => setField('notes', e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="アレルギー、服用中のお薬など"
                  />
                </div>
              )}

              {/* 郵便番号 */}
              <div>
                <label className="text-xs text-gray-500">郵便番号（任意）</label>
                <input
                  value={form.postal_code}
                  onChange={e => setField('postal_code', e.target.value)}
                  placeholder="150-0001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* 来院きっかけ */}
              <div>
                <label className="text-xs text-gray-500">来院きっかけ（任意）</label>
                <select
                  value={form.referral_source}
                  onChange={e => setField('referral_source', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">選択してください</option>
                  <option value="インターネット検索">インターネット検索</option>
                  <option value="SNS・Instagram">SNS・Instagram</option>
                  <option value="ご紹介">ご紹介</option>
                  <option value="看板・チラシ">看板・チラシ</option>
                  <option value="TVCM">TVCM</option>
                <option value="公式HP">公式HP</option>
                  <option value="その他">その他</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button" onClick={handleCloseModal}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >キャンセル</button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >{editPatient ? '保存する' : '登録する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
