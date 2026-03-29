// frontend/src/context/TestModeContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'

const TestModeContext = createContext()

export function TestModeProvider({ children }) {
  const [isTestMode, setIsTestMode] = useState(() => {
    return localStorage.getItem('test_mode') === 'true'
  })

  const role = localStorage.getItem('admin_role') || 'staff'
  const isSuperAdmin = role === 'superadmin'

  function toggleTestMode() {
    if (!isSuperAdmin) return
    const next = !isTestMode
    setIsTestMode(next)
    localStorage.setItem('test_mode', String(next))
    // モード切替時はページをリロードしてデータを再取得
    window.location.reload()
  }

  // superadmin以外は常に本番モード
  const effectiveTestMode = isSuperAdmin ? isTestMode : false

  return (
    <TestModeContext.Provider value={{ isTestMode: effectiveTestMode, toggleTestMode, isSuperAdmin }}>
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  return useContext(TestModeContext)
}