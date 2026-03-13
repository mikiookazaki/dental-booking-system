-- ============================================================
-- スマイル歯科クリニック 予約管理システム
-- データベーススキーマ（PostgreSQL）
-- ============================================================

-- 既存テーブルをリセット（開発用）
DROP TABLE IF EXISTS appointment_logs CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS blocked_slots CASCADE;
DROP TABLE IF EXISTS blocked_slot_chairs CASCADE;
DROP TABLE IF EXISTS staff_chair_assignments CASCADE;
DROP TABLE IF EXISTS staff_shifts CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS treatments CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS chairs CASCADE;
DROP TABLE IF EXISTS clinic_settings CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP SEQUENCE IF EXISTS patient_code_seq CASCADE;

-- ============================================================
-- 1. クリニック設定
-- ============================================================
CREATE TABLE clinic_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(100) UNIQUE NOT NULL,
  value           TEXT NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMP DEFAULT NOW()
);

INSERT INTO clinic_settings (key, value, description) VALUES
  ('clinic_name',             'スマイル歯科クリニック',     'クリニック名'),
  ('clinic_name_en',          'Smile Dental Clinic',        '英語名'),
  ('clinic_tel',              '03-1234-5678',               '電話番号'),
  ('clinic_email',            'info@smile-dental.jp',       'メールアドレス'),
  ('clinic_address',          '東京都渋谷区○○1-2-3 ビル4F', '住所'),
  ('open_days',               '[1,2,3,4,5,6]',              '診療曜日（0=日〜6=土）'),
  ('open_time',               '09:00',                      '診療開始時刻'),
  ('close_time',              '18:30',                      '診療終了時刻'),
  ('lunch_start',             '13:00',                      '昼休み開始'),
  ('lunch_end',               '14:00',                      '昼休み終了'),
  ('slot_minutes',            '30',                         '予約スロット単位（分）'),
  ('cancel_deadline_hours',   '24',                         'キャンセル受付期限（時間前）'),
  ('change_deadline_hours',   '24',                         '変更受付期限（時間前）'),
  ('reminder_hours_before',   '24',                         'リマインド送信タイミング（時間前）'),
  ('max_future_booking_days', '60',                         '先行予約受付期間（日）'),
  ('min_booking_hours_ahead', '2',                          '最短予約リードタイム（時間）'),
  ('max_active_bookings',     '3',                          '1患者あたりの最大予約件数'),
  ('maintenance_mode',        'false',                      'メンテナンスモード'),
  ('maintenance_message',     'システムメンテナンス中です', 'メンテナンス中メッセージ'),
  ('can_patient_book',        'true',                       '患者のLINE予約可否'),
  ('can_patient_cancel',      'true',                       '患者のLINEキャンセル可否'),
  ('can_patient_change',      'true',                       '患者のLINE変更可否'),
  -- レセコン連携設定
  ('data_source',             'local',                      'データソース: local / rececon'),
  ('rececon_type',            '',                           'レセコン種別: ORCA / その他（将来用）');

-- ============================================================
-- 2. チェア（診療台）
-- ============================================================
CREATE TABLE chairs (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50) NOT NULL,
  display_order   INTEGER DEFAULT 0,
  line_bookable   BOOLEAN DEFAULT TRUE,
  note            TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

INSERT INTO chairs (name, display_order, line_bookable, note) VALUES
  ('チェア1', 1, TRUE,  ''),
  ('チェア2', 2, TRUE,  ''),
  ('チェア3', 3, TRUE,  ''),
  ('チェア4', 4, FALSE, 'スタッフ専用'),
  ('チェア5', 5, FALSE, '急患・スタッフ専用');

-- ============================================================
-- 3. スタッフ
-- ============================================================
CREATE TABLE staff (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  name_kana       VARCHAR(100),
  role            VARCHAR(50) NOT NULL,
  title           VARCHAR(100),
  color           VARCHAR(7) DEFAULT '#2563eb',
  email           VARCHAR(255),
  phone           VARCHAR(20),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

INSERT INTO staff (name, name_kana, role, title, color, email, phone) VALUES
  ('田中 一郎', 'タナカ イチロウ', 'doctor',     '院長',         '#2563eb', 'tanaka@smile-dental.jp',  '090-1111-2222'),
  ('佐藤 健二', 'サトウ ケンジ',   'doctor',     '副院長',       '#7c3aed', 'sato@smile-dental.jp',    '090-3333-4444'),
  ('鈴木 愛',   'スズキ アイ',     'hygienist',  'チーフ衛生士', '#059669', 'suzuki@smile-dental.jp',  '090-5555-6666'),
  ('山田 さくら','ヤマダ サクラ',  'hygienist',  '歯科衛生士',   '#d97706', 'yamada@smile-dental.jp',  '090-7777-8888'),
  ('中村 恵',   'ナカムラ メグミ', 'assistant',  '歯科助手',     '#0891b2', 'nakamura@smile-dental.jp','090-9999-0000');

-- ============================================================
-- 4. スタッフシフト
-- ============================================================
CREATE TABLE staff_shifts (
  id              SERIAL PRIMARY KEY,
  staff_id        INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_days       INTEGER[] NOT NULL,
  start_time      TIME NOT NULL DEFAULT '09:00',
  end_time        TIME NOT NULL DEFAULT '18:00',
  break_start     TIME DEFAULT '13:00',
  break_end       TIME DEFAULT '14:00',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(staff_id)
);

INSERT INTO staff_shifts (staff_id, work_days, start_time, end_time, break_start, break_end) VALUES
  (1, ARRAY[1,2,3,4,5], '09:00', '18:00', '13:00', '14:00'),
  (2, ARRAY[1,2,4,5,6], '10:00', '17:00', '13:00', '14:00'),
  (3, ARRAY[1,2,3,5,6], '09:00', '17:00', '12:00', '13:00'),
  (4, ARRAY[2,3,4,5],   '10:00', '18:00', '13:00', '14:00'),
  (5, ARRAY[1,3,5],     '09:00', '17:00', '12:00', '13:00');

CREATE TABLE staff_chair_assignments (
  staff_id  INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  chair_id  INTEGER NOT NULL REFERENCES chairs(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, chair_id)
);

INSERT INTO staff_chair_assignments (staff_id, chair_id) VALUES
  (1, 1),(1, 2),
  (2, 3),
  (3, 2),(3, 4),
  (4, 4),(4, 5);

-- ============================================================
-- 5. 治療メニュー
-- ============================================================
CREATE TABLE treatments (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),
  duration        INTEGER NOT NULL DEFAULT 30,
  category        VARCHAR(50),
  assignable_roles TEXT[] DEFAULT ARRAY['doctor'],
  price           INTEGER DEFAULT 0,
  color           VARCHAR(20) DEFAULT '#dbeafe',
  is_active       BOOLEAN DEFAULT TRUE,
  line_visible    BOOLEAN DEFAULT TRUE,
  display_order   INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

INSERT INTO treatments (name, name_en, duration, category, assignable_roles, price, color, line_visible, display_order) VALUES
  ('定期検診',          'Regular Checkup',       30, '予防',        ARRAY['doctor','hygienist'], 3000,  '#dbeafe', TRUE,  1),
  ('クリーニング(PMTC)', 'Cleaning',              45, '予防',        ARRAY['hygienist'],          3500,  '#d1fae5', TRUE,  2),
  ('虫歯治療',          'Cavity Treatment',       60, '治療',        ARRAY['doctor'],             5000,  '#fef3c7', TRUE,  3),
  ('抜歯',              'Extraction',             60, '治療',        ARRAY['doctor'],             8000,  '#fee2e2', TRUE,  4),
  ('クラウン・補綴',    'Crown',                  90, '補綴',        ARRAY['doctor'],             15000, '#ede9fe', TRUE,  5),
  ('ホワイトニング',    'Whitening',              60, '審美',        ARRAY['doctor','hygienist'], 20000, '#fce7f3', TRUE,  6),
  ('インプラント相談',  'Implant Consultation',   30, 'インプラント', ARRAY['doctor'],             0,     '#f0fdf4', TRUE,  7),
  ('歯周病治療',        'Periodontal Treatment',  60, '治療',        ARRAY['doctor','hygienist'], 5000,  '#fff7ed', FALSE, 8);

-- ============================================================
-- 6. 患者
-- ============================================================
CREATE TABLE patients (
  id               SERIAL PRIMARY KEY,
  patient_code     VARCHAR(20) UNIQUE NOT NULL,   -- 予約システム内の患者番号（永久固定）P-00001
  rececon_id       VARCHAR(50) UNIQUE,            -- レセコン側の患者番号（連携後に設定）
  data_source      VARCHAR(20) DEFAULT 'local',   -- 'local' / 'rececon'
  mapped_at        TIMESTAMP,                     -- レセコン名寄せ完了日時
  name             VARCHAR(100) NOT NULL,
  name_kana        VARCHAR(100),
  birth_date       DATE,
  gender           VARCHAR(10),
  phone            VARCHAR(20),
  email            VARCHAR(255),
  address          TEXT,
  insurance_number VARCHAR(50),
  allergies        TEXT[],
  notes            TEXT,
  -- LINE連携
  line_user_id     VARCHAR(100) UNIQUE,           -- LINE UserID
  line_linked_at   TIMESTAMP,                     -- LINE連携日時
  -- 来院情報
  first_visit      DATE,
  last_visit       DATE,
  total_visits     INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- 患者番号の自動採番
CREATE SEQUENCE patient_code_seq START 1;
CREATE OR REPLACE FUNCTION generate_patient_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
    NEW.patient_code := 'P-' || LPAD(nextval('patient_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_patient_code
  BEFORE INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION generate_patient_code();

-- サンプル患者データ
INSERT INTO patients (patient_code, name, name_kana, birth_date, gender, phone, first_visit, total_visits) VALUES
  ('P-00001', '山田 花子', 'ヤマダ ハナコ', '1985-06-15', 'female', '090-1234-5678', '2024-01-10', 5),
  ('P-00002', '佐々木 健', 'ササキ ケン',   '1972-03-22', 'male',   '090-2345-6789', '2023-08-05', 12),
  ('P-00003', '中村 美咲', 'ナカムラ ミサキ','1990-11-30', 'female', '090-3456-7890', '2025-02-14', 3);

-- シーケンスを既存データの最大値に合わせる
SELECT setval('patient_code_seq', 3);

-- ============================================================
-- 7. 予約
-- ============================================================
CREATE TABLE appointments (
  id               SERIAL PRIMARY KEY,
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  staff_id         INTEGER NOT NULL REFERENCES staff(id),
  chair_id         INTEGER NOT NULL REFERENCES chairs(id),
  treatment_id     INTEGER NOT NULL REFERENCES treatments(id),
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           VARCHAR(20) DEFAULT 'confirmed',
  source           VARCHAR(20) DEFAULT 'staff',   -- line / staff / phone / walk_in
  patient_name     VARCHAR(100),
  patient_phone    VARCHAR(20),
  notes            TEXT,
  reminder_sent    BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP,
  cancelled_at     TIMESTAMP,
  cancelled_by     VARCHAR(20),
  cancel_reason    TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_date    ON appointments(appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_staff   ON appointments(staff_id);
CREATE INDEX idx_appointments_status  ON appointments(status);

-- ============================================================
-- 8. 予約ブロック
-- ============================================================
CREATE TABLE blocked_slots (
  id           SERIAL PRIMARY KEY,
  block_date   DATE NOT NULL,
  start_time   TIME,
  end_time     TIME,
  affects_all  BOOLEAN DEFAULT TRUE,
  reason       TEXT NOT NULL,
  created_by   INTEGER REFERENCES staff(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE blocked_slot_chairs (
  blocked_slot_id INTEGER NOT NULL REFERENCES blocked_slots(id) ON DELETE CASCADE,
  chair_id        INTEGER NOT NULL REFERENCES chairs(id) ON DELETE CASCADE,
  PRIMARY KEY (blocked_slot_id, chair_id)
);

INSERT INTO blocked_slots (block_date, start_time, end_time, affects_all, reason) VALUES
  ('2026-03-20', NULL,    NULL,    TRUE,  '院内研修のため終日休診'),
  ('2026-03-25', '14:00', '18:00', FALSE, '学会参加（田中院長）');

-- ============================================================
-- 9. 予約操作ログ
-- ============================================================
CREATE TABLE appointment_logs (
  id             SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  action         VARCHAR(50) NOT NULL,
  changed_by     VARCHAR(20),
  changed_by_id  INTEGER,
  note           TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 10. 管理者ユーザー
-- ============================================================
CREATE TABLE admin_users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) DEFAULT 'staff',
  staff_id      INTEGER REFERENCES staff(id),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ビュー
-- ============================================================
CREATE OR REPLACE VIEW v_appointments AS
SELECT
  a.id,
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.status,
  a.source,
  a.notes,
  a.reminder_sent,
  a.created_at,
  p.id            AS patient_id,
  p.patient_code,
  p.rececon_id,
  p.data_source   AS patient_data_source,
  COALESCE(a.patient_name,  p.name)  AS patient_name,
  COALESCE(a.patient_phone, p.phone) AS patient_phone,
  p.line_user_id,
  s.id            AS staff_id,
  s.name          AS staff_name,
  s.role          AS staff_role,
  s.color         AS staff_color,
  c.id            AS chair_id,
  c.name          AS chair_name,
  t.id            AS treatment_id,
  t.name          AS treatment_name,
  t.duration      AS treatment_duration,
  t.color         AS treatment_color,
  t.price         AS treatment_price
FROM appointments a
LEFT JOIN patients   p ON a.patient_id   = p.id
LEFT JOIN staff      s ON a.staff_id     = s.id
LEFT JOIN chairs     c ON a.chair_id     = c.id
LEFT JOIN treatments t ON a.treatment_id = t.id;

CREATE OR REPLACE VIEW v_today_appointments AS
SELECT * FROM v_appointments
WHERE appointment_date = CURRENT_DATE
  AND status = 'confirmed'
ORDER BY start_time;

-- ============================================================
-- 完了メッセージ
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ データベーススキーマの作成が完了しました';
  RAISE NOTICE '  - テーブル数: 12';
  RAISE NOTICE '  - ビュー数: 2';
  RAISE NOTICE '  - 初期データ: スタッフ5名、チェア5台、治療8種、患者3名';
  RAISE NOTICE '  - レセコン連携対応: rececon_id / data_source / mapped_at 追加';
END $$;