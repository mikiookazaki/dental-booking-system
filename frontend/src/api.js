// frontend/src/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://dental-booking-api-k2v1.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ── リクエストインターセプター：トークン & テストモードヘッダー付与 ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const testMode = localStorage.getItem('test_mode');
  if (testMode === 'true') {
    config.headers['x-test-mode'] = 'true';
  }

  return config;
});

// ── レスポンスインターセプター：401時の自動ログアウト制御 ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';

      // ログインAPI自体の401はログアウト処理しない（認証失敗メッセージを表示するため）
      if (url.includes('/api/auth/login')) {
        return Promise.reject(error);
      }

      // トークン期限切れ or 無効 → クリアしてログインへ
      const isExpired = error.response?.data?.expired === true;
      const token = localStorage.getItem('admin_token');

      if (token) {
        // トークンはあるが無効（期限切れ含む）
        console.warn('認証エラー: トークンが無効または期限切れです。再ログインしてください。');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_name');
        // test_mode と darkMode は保持する

        // 現在のパスがadmin系の場合のみリダイレクト
        if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/calendar')) {
          alert(isExpired
            ? 'セッションの有効期限が切れました。再度ログインしてください。'
            : '認証エラーが発生しました。再度ログインしてください。'
          );
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
