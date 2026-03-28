// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

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

function requireAdmin(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.admin?.role)) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ error: 'スーパー管理者権限が必要です' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };