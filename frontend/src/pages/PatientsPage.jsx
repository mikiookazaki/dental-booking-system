import { useState, useEffect } from 'react'
import axios from '../api'
import { Search, Plus, X, QrCode } from 'lucide-react'

export default function PatientsPage() {
  const [patients, setPatients]       = useState([])
  const [query, setQuery]             = useState('')
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrData, setQrData]           = useState(null)
  const [qrLoading, setQrLoading]     = useState(false)
  const [form, setForm] = useState({ name: '', name_kana: '', phone: '', birth_date: '', gender: '' })

  useEffect(() => { fetchPatients() }, [])

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

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await axios.post('/api/patients', form)
      setShowModal(false)
      setForm({ name: '', name_kana: '', phone: '', birth_date: '', gender: '' })
      fetchPatients()
    } catch (err) {
      alert('登録に失敗しました')
    }
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
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">電話番号</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">来院回数</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">LINE</th>
              <th className="text-left p-3 border-b border-gray-200 text-gray-600 font-medium">QR</th>
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
                <td className="p-3 text-gray-600">{p.phone || '-'}</td>
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
                {/* QR画像（外部API生成） */}
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
                {/* QR URL コピー */}
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
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">新規患者登録（初診）</h3>
              <button onClick={() => setShowModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              ※ 患者番号は自動採番されます。詳細情報は登録後に追加できます。
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">氏名 *</label>
                <input
                  required value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">氏名（カナ）</label>
                <input
                  value={form.name_kana}
                  onChange={e => setForm({...form, name_kana: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">電話番号</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">生年月日</label>
                <input
                  type="date" value={form.birth_date}
                  onChange={e => setForm({...form, birth_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">性別</label>
                <select
                  value={form.gender}
                  onChange={e => setForm({...form, gender: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">選択してください</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >キャンセル</button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >登録する</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
