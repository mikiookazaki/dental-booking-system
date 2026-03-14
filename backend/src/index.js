require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

// ── ミドルウェア ──────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://dental-booking-frontend.onrender.com',
  ],
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
app.use('/api/admin',        require('./routes/admin'));

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

// ── マイグレーション ──────────────────────────────────────
const pool = require('./config/database');

const runMigrations = async () => {
  console.log('🔄 マイグレーション開始...');
  try {
    // patients: name_kana追加
    await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS name_kana VARCHAR(100)`);
    await pool.query(`UPDATE patients SET name_kana = name WHERE name_kana IS NULL OR name_kana = ''`);

    // appointments: 各カラム追加
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS treatment_color VARCHAR(20) DEFAULT '#4A90D9'`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chair_number INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(50)`);
    await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

    // booking_blocks: 各カラム追加
    await pool.query(`ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS block_type VARCHAR(20) DEFAULT 'time_slot'`);
    await pool.query(`ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS start_time TIME`);
    await pool.query(`ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS end_time TIME`);
    await pool.query(`ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS reason TEXT`);

    // system_settings: 初期値追加
    const defaultSettings = [
      ['slot_duration',  '30'],
      ['max_chairs',     '3'],
      ['open_days',      '[1,2,3,4,5]'],
      ['open_time',      '09:00'],
      ['close_time',     '18:00'],
      ['lunch_start',    '13:00'],
      ['lunch_end',      '14:00'],
    ];
    for (const [key, value] of defaultSettings) {
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }

    console.log('✅ マイグレーション完了');
  } catch (err) {
    console.error('❌ マイグレーションエラー:', err.message);
  }
};

// ── 起動 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🦷 歯科予約システム バックエンド起動`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   ENV:  ${process.env.NODE_ENV}`);
  await runMigrations();
});