-- ============================================================
-- サンプルデータ（評価用）
-- 2026年3月〜4月の予約データ
-- ============================================================

-- 既存サンプル患者を追加
INSERT INTO patients (patient_code, name, name_kana, birth_date, gender, phone, email, first_visit, total_visits, notes) VALUES
  ('P-00004', '鈴木 一郎',   'スズキ イチロウ',   '1980-04-15', 'male',   '090-1111-0001', 'suzuki1@example.com',  '2025-01-10', 8,  'アレルギー: ペニシリン'),
  ('P-00005', '田中 花子',   'タナカ ハナコ',     '1992-07-22', 'female', '090-1111-0002', 'tanaka2@example.com',  '2025-03-05', 3,  NULL),
  ('P-00006', '伊藤 健太',   'イトウ ケンタ',     '1975-11-30', 'male',   '090-1111-0003', 'ito3@example.com',     '2024-08-20', 15, '高血圧治療中'),
  ('P-00007', '渡辺 美咲',   'ワタナベ ミサキ',   '1988-02-14', 'female', '090-1111-0004', 'watanabe@example.com', '2025-06-01', 6,  NULL),
  ('P-00008', '山本 太郎',   'ヤマモト タロウ',   '1965-09-08', 'male',   '090-1111-0005', 'yamamoto@example.com', '2023-11-15', 22, '義歯使用'),
  ('P-00009', '中島 さくら', 'ナカジマ サクラ',   '1998-05-25', 'female', '090-1111-0006', 'nakajima@example.com', '2026-01-08', 2,  NULL),
  ('P-00010', '小林 隆',     'コバヤシ タカシ',   '1970-12-03', 'male',   '090-1111-0007', 'kobayashi@example.com','2024-05-30', 10, NULL),
  ('P-00011', '加藤 恵子',   'カトウ ケイコ',     '1955-03-18', 'female', '090-1111-0008', 'kato@example.com',     '2023-04-12', 30, '骨粗鬆症'),
  ('P-00012', '松本 浩二',   'マツモト コウジ',   '1983-08-07', 'male',   '090-1111-0009', 'matsumoto@example.com','2025-09-20', 4,  NULL),
  ('P-00013', '井上 明子',   'イノウエ アキコ',   '1977-06-19', 'female', '090-1111-0010', 'inoue@example.com',    '2024-12-01', 7,  NULL),
  ('P-00014', '木村 大輔',   'キムラ ダイスケ',   '1990-01-28', 'male',   '090-1111-0011', 'kimura@example.com',   '2026-02-14', 1,  NULL),
  ('P-00015', '清水 優子',   'シミズ ユウコ',     '1968-10-11', 'female', '090-1111-0012', 'shimizu@example.com',  '2024-07-03', 12, NULL),
  ('P-00016', '斎藤 博',     'サイトウ ヒロシ',   '1958-07-24', 'male',   '090-1111-0013', 'saito@example.com',    '2023-02-28', 35, '糖尿病'),
  ('P-00017', '林 真由美',   'ハヤシ マユミ',     '1995-09-06', 'female', '090-1111-0014', 'hayashi@example.com',  '2025-11-18', 3,  NULL),
  ('P-00018', '岡田 雄太',   'オカダ ユウタ',     '1987-04-30', 'male',   '090-1111-0015', 'okada@example.com',    '2025-08-22', 5,  NULL)
ON CONFLICT (patient_code) DO NOTHING;

-- ============================================================
-- 3月の予約データ（2026年3月）
-- ============================================================
INSERT INTO appointments (patient_id, staff_id, chair_id, treatment_id, appointment_date, start_time, end_time, status, source, notes) VALUES

-- 3/2 (月)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 1, '2026-03-02', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 3, '2026-03-02', '09:30', '10:30', 'confirmed', 'staff', '初診：右上7番'),
((SELECT id FROM patients WHERE patient_code='P-00006'), 1, 1, 4, '2026-03-02', '10:00', '11:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 3, 3, 2, '2026-03-02', '10:30', '11:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 2, 2, 5, '2026-03-02', '14:00', '15:30', 'confirmed', 'staff', 'クラウン印象'),

-- 3/3 (火)
((SELECT id FROM patients WHERE patient_code='P-00002'), 1, 1, 1, '2026-03-03', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 2, 3, '2026-03-03', '09:00', '10:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 3, 3, 2, '2026-03-03', '10:00', '10:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 1, 1, 1, '2026-03-03', '11:00', '11:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00011'), 2, 2, 8, '2026-03-03', '14:00', '15:00', 'confirmed', 'staff', '歯周ポケット検査'),
((SELECT id FROM patients WHERE patient_code='P-00013'), 1, 1, 3, '2026-03-03', '15:00', '16:00', 'confirmed', 'phone', NULL),

-- 3/4 (水)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 1, '2026-03-04', '09:30', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 2, 2, 6, '2026-03-04', '10:00', '11:00', 'confirmed', 'staff', 'ホワイトニング2回目'),
((SELECT id FROM patients WHERE patient_code='P-00015'), 3, 3, 2, '2026-03-04', '10:30', '11:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 1, 1, 3, '2026-03-04', '14:00', '15:00', 'confirmed', 'phone', '糖尿病考慮'),
((SELECT id FROM patients WHERE patient_code='P-00017'), 2, 2, 1, '2026-03-04', '15:00', '15:30', 'confirmed', 'line',  NULL),

-- 3/5 (木)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 3, '2026-03-05', '09:00', '10:00', 'confirmed', 'line',  '先週の続き'),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 1, '2026-03-05', '09:30', '10:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00014'), 1, 1, 7, '2026-03-05', '11:00', '11:30', 'confirmed', 'staff', 'インプラント相談初回'),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 3, '2026-03-05', '14:00', '15:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 3, 3, 5, '2026-03-05', '15:00', '16:30', 'confirmed', 'staff', '上部構造セット'),

-- 3/6 (金)
((SELECT id FROM patients WHERE patient_code='P-00002'), 2, 1, 2, '2026-03-06', '09:00', '09:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00006'), 1, 2, 1, '2026-03-06', '09:30', '10:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 2, 1, 5, '2026-03-06', '10:30', '12:00', 'confirmed', 'staff', 'クラウンセット'),
((SELECT id FROM patients WHERE patient_code='P-00013'), 1, 2, 3, '2026-03-06', '14:00', '15:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 3, 3, 2, '2026-03-06', '15:00', '15:45', 'confirmed', 'line',  NULL),

-- 3/7 (土)
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 1, 1, '2026-03-07', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 1, 2, 3, '2026-03-07', '10:00', '11:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 2, '2026-03-07', '11:00', '11:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 2, 1, 1, '2026-03-07', '14:00', '14:30', 'confirmed', 'line',  NULL),

-- 3/9 (月)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 4, '2026-03-09', '09:00', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 2, 2, 3, '2026-03-09', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 1, 1, 6, '2026-03-09', '10:30', '11:30', 'confirmed', 'staff', 'ホワイトニング3回目'),
((SELECT id FROM patients WHERE patient_code='P-00016'), 3, 3, 8, '2026-03-09', '14:00', '15:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 1, '2026-03-09', '15:00', '15:30', 'confirmed', 'line',  NULL),

-- 3/10 (火)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 1, '2026-03-10', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 3, '2026-03-10', '09:00', '10:00', 'confirmed', 'staff', '根管2回目'),
((SELECT id FROM patients WHERE patient_code='P-00006'), 3, 3, 1, '2026-03-10', '10:00', '10:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 1, 1, 2, '2026-03-10', '11:00', '11:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00014'), 2, 2, 3, '2026-03-10', '14:00', '15:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 1, 1, 5, '2026-03-10', '15:30', '17:00', 'confirmed', 'staff', 'メタルクラウン'),

-- 3/11 (水)
((SELECT id FROM patients WHERE patient_code='P-00002'), 2, 2, 1, '2026-03-11', '09:30', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 1, 1, 3, '2026-03-11', '10:00', '11:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 3, 3, 2, '2026-03-11', '10:30', '11:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00013'), 2, 2, 8, '2026-03-11', '14:00', '15:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 1, 1, 1, '2026-03-11', '15:30', '16:00', 'confirmed', 'line',  NULL),

-- 3/12 (木)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 3, '2026-03-12', '09:00', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 2, 2, 5, '2026-03-12', '09:30', '11:00', 'confirmed', 'staff', 'セラミック印象'),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 2, '2026-03-12', '11:00', '11:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 1, 1, 1, '2026-03-12', '14:00', '14:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 3, '2026-03-12', '15:00', '16:00', 'confirmed', 'staff', NULL),

-- 3/13 (金)
((SELECT id FROM patients WHERE patient_code='P-00004'), 1, 1, 4, '2026-03-13', '09:00', '10:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 2, 2, 2, '2026-03-13', '09:30', '10:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 1, 1, 6, '2026-03-13', '10:30', '11:30', 'confirmed', 'staff', 'ホワイトニング最終回'),
((SELECT id FROM patients WHERE patient_code='P-00014'), 3, 3, 1, '2026-03-13', '14:00', '14:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 2, 2, 3, '2026-03-13', '15:00', '16:00', 'confirmed', 'phone', NULL),

-- 3/14 (土)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 1, '2026-03-14', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00006'), 2, 2, 3, '2026-03-14', '10:00', '11:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 3, 3, 2, '2026-03-14', '10:30', '11:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00013'), 1, 1, 4, '2026-03-14', '14:00', '15:00', 'confirmed', 'phone', NULL),

-- 3/16 (月)
((SELECT id FROM patients WHERE patient_code='P-00002'), 1, 1, 1, '2026-03-16', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 2, 3, '2026-03-16', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 3, 3, 5, '2026-03-16', '10:00', '11:30', 'confirmed', 'staff', 'ブリッジ印象'),
((SELECT id FROM patients WHERE patient_code='P-00010'), 1, 1, 5, '2026-03-16', '14:00', '15:00', 'confirmed', 'staff', 'セラミックセット'),
((SELECT id FROM patients WHERE patient_code='P-00016'), 2, 2, 8, '2026-03-16', '15:00', '16:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 1, 1, 1, '2026-03-16', '16:00', '16:30', 'confirmed', 'line',  NULL),

-- 3/17 (火)
((SELECT id FROM patients WHERE patient_code='P-00003'), 2, 2, 2, '2026-03-17', '09:00', '09:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 1, 1, 3, '2026-03-17', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 2, '2026-03-17', '10:30', '11:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00014'), 2, 2, 7, '2026-03-17', '14:00', '14:30', 'confirmed', 'staff', 'インプラント2回目'),
((SELECT id FROM patients WHERE patient_code='P-00018'), 1, 1, 1, '2026-03-17', '15:00', '15:30', 'confirmed', 'line',  NULL),

-- 3/18 (水)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 3, '2026-03-18', '09:00', '10:00', 'confirmed', 'line',  '根管最終'),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 1, '2026-03-18', '09:30', '10:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00006'), 3, 3, 1, '2026-03-18', '10:00', '10:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 1, 1, 3, '2026-03-18', '11:00', '12:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00013'), 2, 2, 2, '2026-03-18', '14:00', '14:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 1, 1, 6, '2026-03-18', '15:00', '16:00', 'confirmed', 'staff', NULL),

-- 3/19 (木)
((SELECT id FROM patients WHERE patient_code='P-00002'), 2, 1, 4, '2026-03-19', '09:00', '10:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 1, 2, 3, '2026-03-19', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 3, 3, 1, '2026-03-19', '10:00', '10:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 2, 1, 3, '2026-03-19', '14:00', '15:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 1, 2, 2, '2026-03-19', '15:30', '16:15', 'confirmed', 'line',  NULL),

-- 3/20 (金) ← 今日
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 1, '2026-03-20', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 2, 2, 3, '2026-03-20', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 1, 1, 2, '2026-03-20', '10:00', '10:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 8, '2026-03-20', '11:00', '12:00', 'confirmed', 'phone', '歯石除去'),
((SELECT id FROM patients WHERE patient_code='P-00014'), 2, 2, 1, '2026-03-20', '14:00', '14:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00018'), 1, 1, 5, '2026-03-20', '15:00', '16:30', 'confirmed', 'staff', 'ジルコニア'),

-- 3/21 (土)
((SELECT id FROM patients WHERE patient_code='P-00001'), 2, 1, 1, '2026-03-21', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00004'), 1, 2, 4, '2026-03-21', '10:00', '11:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 3, 3, 2, '2026-03-21', '11:00', '11:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00013'), 2, 1, 3, '2026-03-21', '14:00', '15:00', 'confirmed', 'phone', NULL),

-- 3/23 (月)
((SELECT id FROM patients WHERE patient_code='P-00006'), 1, 1, 5, '2026-03-23', '09:00', '10:30', 'confirmed', 'staff', 'ブリッジセット'),
((SELECT id FROM patients WHERE patient_code='P-00009'), 2, 2, 1, '2026-03-23', '09:30', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 1, 1, 3, '2026-03-23', '10:30', '11:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 3, 3, 2, '2026-03-23', '14:00', '14:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00002'), 2, 2, 3, '2026-03-23', '15:00', '16:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 1, 1, 1, '2026-03-23', '16:00', '16:30', 'confirmed', 'phone', NULL),

-- 3/24 (火)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 2, '2026-03-24', '09:00', '09:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 2, 3, '2026-03-24', '09:30', '10:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 3, 3, 1, '2026-03-24', '10:00', '10:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 1, 1, 6, '2026-03-24', '14:00', '15:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 4, '2026-03-24', '15:30', '16:30', 'confirmed', 'phone', NULL),

-- 3/25 (水)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 1, '2026-03-25', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 3, '2026-03-25', '10:00', '11:00', 'confirmed', 'staff', '根管3回目'),
((SELECT id FROM patients WHERE patient_code='P-00007'), 1, 1, 5, '2026-03-25', '10:30', '12:00', 'confirmed', 'staff', 'セラミック最終'),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 8, '2026-03-25', '14:00', '15:00', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00014'), 2, 2, 7, '2026-03-25', '15:00', '15:30', 'confirmed', 'staff', 'インプラント3回目'),
((SELECT id FROM patients WHERE patient_code='P-00016'), 1, 1, 1, '2026-03-25', '16:00', '16:30', 'confirmed', 'line',  NULL),

-- 3/26 (木)
((SELECT id FROM patients WHERE patient_code='P-00002'), 2, 1, 1, '2026-03-26', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00006'), 1, 2, 3, '2026-03-26', '09:30', '10:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 3, 3, 2, '2026-03-26', '10:00', '10:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00013'), 2, 1, 3, '2026-03-26', '14:00', '15:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00015'), 1, 2, 1, '2026-03-26', '15:30', '16:00', 'confirmed', 'line',  NULL),

-- 3/27 (金)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 4, '2026-03-27', '09:00', '10:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 2, 2, '2026-03-27', '09:30', '10:15', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 1, 1, 3, '2026-03-27', '10:30', '11:30', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00017'), 3, 3, 1, '2026-03-27', '14:00', '14:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 5, '2026-03-27', '15:00', '16:30', 'confirmed', 'staff', 'ジルコニア仮付'),

-- 3/28 (土)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 3, '2026-03-28', '09:00', '10:00', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00008'), 2, 2, 1, '2026-03-28', '10:00', '10:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00012'), 3, 3, 6, '2026-03-28', '11:00', '12:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 1, 1, 8, '2026-03-28', '14:00', '15:00', 'confirmed', 'phone', NULL),

-- ============================================================
-- 4月の予約データ（先行予約）
-- ============================================================
-- 4/1 (水)
((SELECT id FROM patients WHERE patient_code='P-00002'), 1, 1, 1, '2026-04-01', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00004'), 2, 2, 3, '2026-04-01', '10:00', '11:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00007'), 1, 1, 5, '2026-04-01', '14:00', '15:30', 'confirmed', 'staff', 'ジルコニアセット'),
((SELECT id FROM patients WHERE patient_code='P-00011'), 3, 3, 2, '2026-04-01', '15:00', '15:45', 'confirmed', 'line',  NULL),

-- 4/6 (月)
((SELECT id FROM patients WHERE patient_code='P-00003'), 1, 1, 1, '2026-04-06', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00006'), 2, 2, 3, '2026-04-06', '09:30', '10:30', 'confirmed', 'phone', NULL),
((SELECT id FROM patients WHERE patient_code='P-00009'), 1, 1, 4, '2026-04-06', '11:00', '12:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00014'), 3, 3, 7, '2026-04-06', '14:00', '14:30', 'confirmed', 'staff', 'インプラント手術'),
((SELECT id FROM patients WHERE patient_code='P-00018'), 2, 2, 1, '2026-04-06', '15:00', '15:30', 'confirmed', 'line',  NULL),

-- 4/13 (月)
((SELECT id FROM patients WHERE patient_code='P-00001'), 1, 1, 1, '2026-04-13', '09:00', '09:30', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00005'), 2, 2, 2, '2026-04-13', '10:00', '10:45', 'confirmed', 'line',  NULL),
((SELECT id FROM patients WHERE patient_code='P-00010'), 1, 1, 3, '2026-04-13', '14:00', '15:00', 'confirmed', 'staff', NULL),
((SELECT id FROM patients WHERE patient_code='P-00016'), 3, 3, 8, '2026-04-13', '15:00', '16:00', 'confirmed', 'phone', NULL)

ON CONFLICT DO NOTHING;

-- 来院回数・最終来院日を更新
UPDATE patients SET
  total_visits = (SELECT COUNT(*) FROM appointments WHERE patient_id = patients.id AND status = 'confirmed'),
  last_visit   = (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = patients.id AND status = 'confirmed' AND appointment_date <= CURRENT_DATE)
WHERE id IN (SELECT DISTINCT patient_id FROM appointments);
