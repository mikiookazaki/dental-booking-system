// ============================================================
// routes/auth.js （Supabase移行版）
// ============================================================
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
  }
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
    }

    const ok = await bcrypt.compare(password, data.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
    }

    // JWTトークン発行（24時間有効）
    const token = jwt.sign(
      { id: data.id, username: data.username, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.id);

    res.json({ token, role: data.role, username: data.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/setup - 初回管理者ユーザー作成（開発用）
router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('admin_users')
      .insert({ username, password_hash: hash, role: 'admin' })
      .select('id, username')
      .single();

    if (error) throw error;
    res.status(201).json({ message: '管理者ユーザーを作成しました', user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
