import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CalendarPage from './pages/CalendarPage'
import PatientsPage from './pages/PatientsPage'
import StaffPage from './pages/StaffPage'
import Sidebar from './components/common/Sidebar'

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/calendar" />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/staff" element={<StaffPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App