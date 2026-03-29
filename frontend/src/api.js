import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

// リクエスト時にトークン・テストモードを自動付与
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  // テストモードヘッダーを自動付与
  const isTestMode = localStorage.getItem('test_mode') === 'true'
  const role       = localStorage.getItem('admin_role') || ''
  if (isTestMode && role === 'superadmin') {
    config.headers['x-test-mode'] = 'true'
  }
  return config
})

export default api