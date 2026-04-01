// frontend/src/context/TestModeContext.jsx
import { createContext, useContext, useState } from 'react'

const TestModeContext = createContext()

export function TestModeProvider({ children }) {
  const [isTestMode, setIsTestMode] = useState(() => {
    return localStorage.getItem('test_mode') === 'true'
  })

  function toggleTestMode() {
    const role = localStorage.getItem('admin_role') || ''
    if (role !== 'superadmin') return
    const next = !isTestMode
    setIsTestMode(next)
    localStorage.setItem('test_mode', String(next))
    window.location.reload()
  }

  const role = localStorage.getItem('admin_role') || ''
  const isSuperAdmin = role === 'superadmin'
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
