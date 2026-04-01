// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

// ── JWT認証ミドルウェア ────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;

    // テストモード判定（superadminのみ有効）
    const isTestMode = req.headers['x-test-mode'] === 'true' && decoded.role === 'superadmin';
    req.isTestMode = isTestMode;

    next();
  } catch (err) {
    // 期限切れとその他のエラーを区別してログ出力
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'トークンの有効期限が切れました。再ログインしてください。', expired: true });
    }
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

// ── 管理者権限チェック（admin と superadmin 両方を許可）────
function requireAdmin(req, res, next) {
  const role = req.admin?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

// ── スーパー管理者のみ ────────────────────────────────────
function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ error: 'スーパー管理者権限が必要です' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
