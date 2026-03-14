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
    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
}

// ── 管理者権限チェック ────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.admin?.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
