import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'
import { TestModeProvider } from './context/TestModeContext'

axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestModeProvider>
      <App />
    </TestModeProvider>
  </StrictMode>,
)