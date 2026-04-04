// frontend/src/components/admin/TestSpecPanel.jsx
// スーパー管理者専用：機能テスト仕様書フローティングパネル

import { useState, useEffect, useRef } from 'react'
import { useTestMode } from '../../context/TestModeContext'

// ─────────────────────────────────────────────
// テスト仕様データ
// ─────────────────────────────────────────────
const TEST_SPECS = [
  {
    id: 'auth',
    category: '🔐 認証・ログイン',
    cases: [
      { id: 'auth-1', label: 'superadmin / smile2026 でログインできる' },
      { id: 'auth-2', label: 'staff / dental2026 でログインできる' },
      { id: 'auth-3', label: '誤ったパスワードでログインできない（エラー表示）' },
      { id: 'auth-4', label: 'ログアウト後、管理画面にアクセスできない' },
      { id: 'auth-5', label: 'staffロールではスーパー管理者メニューが非表示' },
    ],
  },
  {
    id: 'calendar',
    category: '📅 予約カレンダー',
    cases: [
      { id: 'cal-1', label: '日表示・週表示・月表示が切り替えられる' },
      { id: 'cal-2', label: 'カレンダーのチェア列が正しく表示される' },
      { id: 'cal-3', label: '新規予約を作成できる（患者・治療・時間選択）' },
      { id: 'cal-4', label: '担当スタッフ未設定でも予約を保存できる' },
      { id: 'cal-5', label: '予約をクリックして詳細を確認できる' },
      { id: 'cal-6', label: '予約のステータスを変更できる（確定→完了等）' },
      { id: 'cal-7', label: '予約をドラッグ＆ドロップで移動できる' },
      { id: 'cal-8', label: '休診日が正しくグレーアウトされる' },
      { id: 'cal-9', label: 'サイドバーのミニカレンダーから日付移動できる' },
    ],
  },
  {
    id: 'line-bot',
    category: '📱 LINE予約Bot',
    cases: [
      { id: 'line-1', label: '「予約」と送信するとメニューが返ってくる' },
      { id: 'line-2', label: '治療メニューを選択すると日付選択が返ってくる' },
      { id: 'line-3', label: '空きのある日時を選択すると確認メッセージが返る' },
      { id: 'line-4', label: '「確定」を押すと予約完了メッセージが返る' },
      { id: 'line-5', label: '予約完了後、管理画面カレンダーに反映される' },
      { id: 'line-6', label: '「予約確認」と送信すると予約一覧が返る' },
      { id: 'line-7', label: '「キャンセル」で予約をキャンセルできる' },
      { id: 'line-8', label: '満席の日時を選択するとエラーメッセージが返る' },
      { id: 'line-9', label: '未登録患者が予約するとフリガナ入力フローになる' },
      { id: 'line-10', label: '患者登録後、次回からスムーズに予約できる' },
    ],
  },
  {
    id: 'reminder',
    category: '⏰ リマインダー',
    cases: [
      { id: 'rem-1', label: '前日リマインダーがLINEに届く（岡崎様で確認）' },
      { id: 'rem-2', label: 'LINE未連携患者はno_lineステータスで記録される' },
      { id: 'rem-3', label: '送信履歴画面に正しく表示される' },
      { id: 'rem-4', label: '重複送信されない（同じ予約に2回送らない）' },
      { id: 'rem-5', label: '治療後フォロー（当日）がLINEに届く' },
      { id: 'rem-6', label: '誕生日メッセージが届く（誕生日患者で確認）' },
      { id: 'rem-7', label: '手動実行APIで即時送信できる（PowerShellで確認）' },
    ],
  },
  {
    id: 'patient',
    category: '👤 患者管理',
    cases: [
      { id: 'pat-1', label: '患者一覧が表示される' },
      { id: 'pat-2', label: '患者を新規登録できる（P-xxxxx形式のコード生成）' },
      { id: 'pat-3', label: '患者情報を編集できる' },
      { id: 'pat-4', label: '患者を検索できる（名前・カナ・コード）' },
      { id: 'pat-5', label: 'LINE連携済みバッジが正しく表示される' },
      { id: 'pat-6', label: 'テストモードON時、テスト患者のみ表示される' },
    ],
  },
  {
    id: 'settings',
    category: '⚙️ システム設定',
    cases: [
      { id: 'set-1', label: '診療時間・休診日を変更できる' },
      { id: 'set-2', label: '治療メニューを追加・編集・削除できる' },
      { id: 'set-3', label: 'リマインダーのON/OFFを切り替えられる' },
      { id: 'set-4', label: '誕生日メッセージ文を編集できる' },
      { id: 'set-5', label: 'フォローアップメッセージを編集できる' },
      { id: 'set-6', label: 'キャンペーン配信を送信できる' },
    ],
  },
  {
    id: 'superadmin',
    category: '⚡ スーパー管理者機能',
    cases: [
      { id: 'sup-1', label: 'テストモードON/OFFが切り替えられる（エラーなし）' },
      { id: 'sup-2', label: 'LINEデバッグ画面からメッセージを送信できる' },
      { id: 'sup-3', label: 'テスト患者管理画面が表示される' },
      { id: 'sup-4', label: 'テストモードON時、本番患者への送信がブロックされる' },
    ],
  },
]

const STORAGE_KEY = 'smile_test_checks'

export default function TestSpecPanel() {
  const { isSuperAdmin } = useTestMode()
  const [isOpen, setIsOpen] = useState(false)
  const [checks, setChecks] = useState({})
  const [position, setPosition] = useState({ x: 24, y: 80 })
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState('all') // all | done | todo
  const dragRef = useRef(null)
  const panelRef = useRef(null)

  // チェック状態を localStorage から復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecks(JSON.parse(saved))
    } catch {}
  }, [])

  // チェック状態を保存
  function saveChecks(next) {
    setChecks(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function toggleCheck(id) {
    saveChecks({ ...checks, [id]: !checks[id] })
  }

  function clearAll() {
    if (window.confirm('すべてのチェックを消去しますか？')) {
      saveChecks({})
    }
  }

  function checkAll() {
    const all = {}
    TEST_SPECS.forEach(s => s.cases.forEach(c => { all[c.id] = true }))
    saveChecks(all)
  }

  // 集計
  const totalCases = TEST_SPECS.reduce((acc, s) => acc + s.cases.length, 0)
  const doneCases  = Object.values(checks).filter(Boolean).length
  const progress   = Math.round((doneCases / totalCases) * 100)

  // ドラッグ処理
  function onMouseDown(e) {
    if (e.target.closest('button, input, label')) return
    setDragging(true)
    dragRef.current = {
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    }
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e) {
      setPosition({
        x: Math.max(0, e.clientX - dragRef.current.startX),
        y: Math.max(0, e.clientY - dragRef.current.startY),
      })
    }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  if (!isSuperAdmin) return null

  return (
    <>
      {/* フローティングボタン */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed z-50 bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg px-4 py-3 flex items-center gap-2 text-sm font-medium transition-all"
          title="機能テスト仕様書を開く"
        >
          <span>🧪</span>
          <span>テスト仕様書</span>
          <span className="bg-white text-indigo-600 rounded-full text-xs px-2 py-0.5 font-bold">
            {doneCases}/{totalCases}
          </span>
        </button>
      )}

      {/* フローティングパネル */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 9999,
            width: 420,
            maxHeight: '80vh',
            cursor: dragging ? 'grabbing' : 'default',
          }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        >
          {/* ヘッダー（ドラッグ可能） */}
          <div
            onMouseDown={onMouseDown}
            className="bg-indigo-600 px-4 py-3 flex items-center justify-between cursor-grab select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <div>
                <p className="text-white font-bold text-sm">機能テスト仕様書</p>
                <p className="text-indigo-200 text-xs">スマイル歯科 管理システム</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-indigo-200 hover:text-white text-xl leading-none px-1"
            >×</button>
          </div>

          {/* プログレスバー */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">進捗</span>
              <span className="text-xs font-bold text-indigo-600">{doneCases} / {totalCases} ({progress}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* フィルター・操作ボタン */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                {[
                  { key: 'all',  label: 'すべて' },
                  { key: 'todo', label: '未完了' },
                  { key: 'done', label: '完了' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      filter === f.key
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >{f.label}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={checkAll}
                  className="text-xs text-green-600 hover:text-green-700 underline"
                >全選択</button>
                <button
                  onClick={clearAll}
                  className="text-xs text-red-500 hover:text-red-600 underline"
                >一括消去</button>
              </div>
            </div>
          </div>

          {/* テストケース一覧 */}
          <div className="overflow-y-auto flex-1 px-4 py-2">
            {TEST_SPECS.map(section => {
              const filtered = section.cases.filter(c => {
                if (filter === 'done') return !!checks[c.id]
                if (filter === 'todo') return !checks[c.id]
                return true
              })
              if (filtered.length === 0) return null

              const sectionDone = section.cases.filter(c => checks[c.id]).length

              return (
                <div key={section.id} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-700">{section.category}</p>
                    <span className="text-xs text-gray-400">
                      {sectionDone}/{section.cases.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {filtered.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          checks[c.id]
                            ? 'bg-green-50 text-gray-400 line-through'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!checks[c.id]}
                          onChange={() => toggleCheck(c.id)}
                          className="mt-0.5 accent-indigo-600 flex-shrink-0"
                        />
                        <span className="text-xs leading-relaxed">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* フッター */}
          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <p className="text-xs text-gray-400">
              ドラッグで移動 ・ チェックは自動保存
            </p>
          </div>
        </div>
      )}
    </>
  )
}
