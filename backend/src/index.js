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
app.use('/api/analytics',    require('./routes/analytics'));
app.use('/api/line-debug',   require('./routes/lineDebug'));
app.use('/api/licenses',     require('./routes/licenses'));
app.use('/api/reminders',    require('./routes/reminders'));
app.use('/api/campaigns',    require('./routes/campaigns')); // ← キャンペーン一斉配信

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
    // ── patients ──────────────────────────────────────────
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS name_kana VARCHAR(100)');
    await pool.query("UPDATE patients SET name_kana = name WHERE name_kana IS NULL OR name_kana = ''");
    console.log('  ✅ patients');

    // ── appointments ──────────────────────────────────────
    await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS treatment_color VARCHAR(20) DEFAULT '#4A90D9'");
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chair_number INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(50)');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');
    console.log('  ✅ appointments');

    // ── booking_blocks（テーブルごと作成）─────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_blocks (
        id           SERIAL PRIMARY KEY,
        block_date   DATE NOT NULL,
        block_type   VARCHAR(20) NOT NULL DEFAULT 'time_slot',
        start_time   TIME,
        end_time     TIME,
        reason       TEXT,
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query("ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS block_type VARCHAR(20) DEFAULT 'time_slot'");
    await pool.query('ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS start_time TIME');
    await pool.query('ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS end_time   TIME');
    await pool.query('ALTER TABLE booking_blocks ADD COLUMN IF NOT EXISTS reason     TEXT');
    console.log('  ✅ booking_blocks');

    // ── system_settings（テーブルごと作成）────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id         SERIAL PRIMARY KEY,
        key        VARCHAR(100) UNIQUE NOT NULL,
        value      TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const defaultSettings = [
      ['slot_duration', '30'],
      ['max_chairs',    '3'],
      ['open_days',     '[1,2,3,4,5]'],
      ['open_time',     '09:00'],
      ['close_time',    '18:00'],
      ['lunch_start',   '13:00'],
      ['lunch_end',     '14:00'],
    ];
    for (const [key, value] of defaultSettings) {
      await pool.query(
        'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }
    console.log('  ✅ system_settings');

    // calendar display settings
    await pool.query(
      "INSERT INTO clinic_settings (key, value, description) VALUES ('calendar_display_start', '07:00', 'カレンダー表示開始時刻') ON CONFLICT (key) DO NOTHING"
    );
    await pool.query(
      "INSERT INTO clinic_settings (key, value, description) VALUES ('calendar_display_end', '21:00', 'カレンダー表示終了時刻') ON CONFLICT (key) DO NOTHING"
    );
    // age_group カラム追加
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS age_group VARCHAR(20)');
    // postal_code（郵便番号）追加
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10)');
    // referral_source（来院きっかけ）追加
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50)');
    // line_inquiry_step（問診ステップ管理）追加
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS line_inquiry_step VARCHAR(50)');
    // line_inquiry_data（問診途中データJSON）追加
    await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS line_inquiry_data TEXT');
    console.log('  ✅ patients: postal_code, referral_source, line_inquiry_step, line_inquiry_data');
    // 既存患者で生年月日がある場合は年代を自動計算
    await pool.query(`
      UPDATE patients SET age_group =
        CASE
          WHEN birth_date IS NOT NULL THEN
            CONCAT(FLOOR(DATE_PART('year', AGE(birth_date)) / 10) * 10, '代')
          ELSE age_group
        END
      WHERE birth_date IS NOT NULL AND (age_group IS NULL OR age_group = '')
    `);
    console.log('  ✅ patients.age_group');

    // 問診セッション管理テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS line_inquiry_sessions (
        id           SERIAL PRIMARY KEY,
        line_user_id VARCHAR(100) NOT NULL UNIQUE,
        step         VARCHAR(50)  NOT NULL DEFAULT 'start',
        data         JSONB        NOT NULL DEFAULT '{}',
        created_at   TIMESTAMP    DEFAULT NOW(),
        updated_at   TIMESTAMP    DEFAULT NOW()
      )
    `);
    console.log('  ✅ line_inquiry_sessions テーブル');

    // 曜日別カスタム診療時間の設定キーを追加
    for (const dow of [0,1,2,3,4,5,6]) {
      await pool.query(
        "INSERT INTO clinic_settings (key, value, description) VALUES ($1, '', $2) ON CONFLICT (key) DO NOTHING",
        [`custom_hours_${dow}`, `曜日別カスタム診療時間(${dow})`]
      );
    }
    console.log('  ✅ custom_hours settings');

    // スタッフユーザーの自動作成（初回のみ）
    const bcrypt = require('bcryptjs');
    const staffExists = await pool.query(
      "SELECT id FROM admin_users WHERE username = 'staff'"
    );
    if (staffExists.rows.length === 0) {
      const hash = await bcrypt.hash('dental2026', 10);
      await pool.query(
        "INSERT INTO admin_users (username, password_hash, role, is_active) VALUES ('staff', $1, 'staff', TRUE)",
        [hash]
      );
      console.log('  ✅ スタッフユーザー作成 (staff / dental2026)');
    }

    // ── clinic_licenses（ライセンス管理）────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_licenses (
        id                  SERIAL PRIMARY KEY,
        clinic_id           VARCHAR(100) NOT NULL UNIQUE,
        plan                VARCHAR(20)  NOT NULL DEFAULT 'basic',
        started_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
        expires_at          TIMESTAMP,
        is_active           BOOLEAN      NOT NULL DEFAULT true,
        stripe_customer_id  VARCHAR(100),
        stripe_sub_id       VARCHAR(100),
        notes               TEXT,
        created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO clinic_licenses (clinic_id, plan, is_active)
       VALUES ('default', 'basic', true)
       ON CONFLICT (clinic_id) DO NOTHING`
    );
    console.log('  ✅ clinic_licenses');

    // ── license_history（変更履歴）───────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS license_history (
        id          SERIAL PRIMARY KEY,
        clinic_id   VARCHAR(100) NOT NULL,
        from_plan   VARCHAR(20),
        to_plan     VARCHAR(20)  NOT NULL,
        changed_by  VARCHAR(100),
        changed_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        reason      TEXT
      )
    `);
    console.log('  ✅ license_history');

    // ── reminder_logs・patients リコール用カラム（Supabaseで作成済み）──
    console.log('  ✅ reminder_logs / recall columns（Supabase作成済み）');

    console.log('✅ マイグレーション完了');
  } catch (err) {
    console.error('❌ マイグレーションエラー:', err.message);
  }
};

// ── Cron: 毎日 9:00 JST にリマインダー送信 ──────────────
const cron = require('node-cron');
const { runAppointmentReminders, runRecallReminders } = require('./routes/reminders');

cron.schedule('0 0 * * *', async () => { // UTC 0:00 = JST 9:00
  console.log('⏰ [CRON] リマインダー送信開始...');
  try {
    const [appt, recall] = await Promise.all([
      runAppointmentReminders(),
      runRecallReminders(),
    ]);
    console.log(`✅ [CRON] 予約:${appt.length}件 リコール:${recall.length}件`);
  } catch (err) {
    console.error('❌ [CRON] エラー:', err.message);
  }
});

// ── 起動 ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log('🦷 歯科予約システム バックエンド起動');
  console.log('   PORT: ' + PORT);
  console.log('   ENV:  ' + process.env.NODE_ENV);
  await runMigrations();
});
