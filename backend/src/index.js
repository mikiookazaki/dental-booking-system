require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ── ミドルウェア ──────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// LINE Webhookは生のbodyが必要なので先に登録
app.use('/api/line/webhook', express.raw({ type: 'application/json' }));

// 他のルートはJSON
app.use(express.json());

// ── ルーティング ──────────────────────────────────────────
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/patients',     require('./routes/patients'));
app.use('/api/staff',        require('./routes/staff'));
app.use('/api/treatments',   require('./routes/treatments'));
app.use('/api/chairs',       require('./routes/chairs'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/blocked-slots',require('./routes/blockedSlots'));
app.use('/api/line',         require('./routes/line'));
app.use('/api/auth',         require('./routes/auth'));

// ── ヘルスチェック ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── エラーハンドラー ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔥 サーバーエラー:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ── 起動 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🦷 歯科予約システム バックエンド起動`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   ENV:  ${process.env.NODE_ENV}`);
});
