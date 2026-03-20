-- 郵便番号・来院きっかけのサンプルデータ追加（渋谷区周辺）
-- 既存患者の更新
UPDATE patients SET postal_code='150-0001', referral_source='インターネット検索' WHERE patient_code='P-00001';
UPDATE patients SET postal_code='150-0002', referral_source='ご紹介' WHERE patient_code='P-00002';
UPDATE patients SET postal_code='151-0051', referral_source='インターネット検索' WHERE patient_code='P-00003';
UPDATE patients SET postal_code='150-0001', referral_source='SNS・Instagram' WHERE patient_code='P-00004';
UPDATE patients SET postal_code='150-0012', referral_source='ご紹介' WHERE patient_code='P-00005';
UPDATE patients SET postal_code='151-0053', referral_source='看板・チラシ' WHERE patient_code='P-00006';
UPDATE patients SET postal_code='150-0001', referral_source='インターネット検索' WHERE patient_code='P-00007';
UPDATE patients SET postal_code='150-0011', referral_source='ご紹介' WHERE patient_code='P-00008';
UPDATE patients SET postal_code='151-0051', referral_source='SNS・Instagram' WHERE patient_code='P-00009';
UPDATE patients SET postal_code='150-0002', referral_source='インターネット検索' WHERE patient_code='P-00010';
UPDATE patients SET postal_code='150-0001', referral_source='ご紹介' WHERE patient_code='P-00011';
UPDATE patients SET postal_code='150-0013', referral_source='看板・チラシ' WHERE patient_code='P-00012';
UPDATE patients SET postal_code='151-0053', referral_source='インターネット検索' WHERE patient_code='P-00013';
UPDATE patients SET postal_code='150-0001', referral_source='SNS・Instagram' WHERE patient_code='P-00014';
UPDATE patients SET postal_code='150-0044', referral_source='インターネット検索' WHERE patient_code='P-00015';
UPDATE patients SET postal_code='151-0051', referral_source='ご紹介' WHERE patient_code='P-00016';
UPDATE patients SET postal_code='150-0002', referral_source='SNS・Instagram' WHERE patient_code='P-00017';
UPDATE patients SET postal_code='150-0001', referral_source='インターネット検索' WHERE patient_code='P-00018';

-- 追加サンプル患者（地図データ充実用）
INSERT INTO patients (name, name_kana, phone, age_group, postal_code, referral_source, gender) VALUES
('青木 健一',   'アオキ ケンイチ',   '090-2001-0001', '30代', '150-0001', 'インターネット検索', 'male'),
('池田 さくら', 'イケダ サクラ',     '090-2001-0002', '20代', '150-0002', 'SNS・Instagram',    'female'),
('上田 浩二',   'ウエダ コウジ',     '090-2001-0003', '50代', '151-0051', 'ご紹介',            'male'),
('江口 美穂',   'エグチ ミホ',       '090-2001-0004', '40代', '151-0053', 'インターネット検索', 'female'),
('大田 隆',     'オオタ タカシ',     '090-2001-0005', '60代', '150-0001', 'ご紹介',            'male'),
('川上 奈々',   'カワカミ ナナ',     '090-2001-0006', '20代', '150-0011', 'SNS・Instagram',    'female'),
('木村 聡',     'キムラ サトシ',     '090-2001-0007', '40代', '150-0012', 'インターネット検索', 'male'),
('倉田 恵',     'クラタ メグミ',     '090-2001-0008', '50代', '150-0001', 'ご紹介',            'female'),
('小池 大輔',   'コイケ ダイスケ',   '090-2001-0009', '30代', '151-0051', 'インターネット検索', 'male'),
('近藤 彩',     'コンドウ アヤ',     '090-2001-0010', '20代', '150-0002', 'SNS・Instagram',    'female'),
('坂本 英夫',   'サカモト ヒデオ',   '090-2001-0011', '70代', '150-0013', 'ご紹介',            'male'),
('清野 みゆき', 'セイノ ミユキ',     '090-2001-0012', '40代', '150-0001', '看板・チラシ',      'female'),
('高橋 正樹',   'タカハシ マサキ',   '090-2001-0013', '50代', '151-0053', 'インターネット検索', 'male'),
('田村 由佳',   'タムラ ユカ',       '090-2001-0014', '30代', '150-0044', 'SNS・Instagram',    'female'),
('中田 誠',     'ナカタ マコト',     '090-2001-0015', '40代', '150-0001', 'ご紹介',            'male'),
('西村 玲子',   'ニシムラ レイコ',   '090-2001-0016', '60代', '150-0011', 'インターネット検索', 'female'),
('野田 泰造',   'ノダ タイゾウ',     '090-2001-0017', '50代', '151-0051', 'ご紹介',            'male'),
('橋本 友香',   'ハシモト ユカ',     '090-2001-0018', '20代', '150-0001', 'SNS・Instagram',    'female'),
('浜田 康介',   'ハマダ コウスケ',   '090-2001-0019', '30代', '150-0002', 'インターネット検索', 'male'),
('平野 綾子',   'ヒラノ アヤコ',     '090-2001-0020', '50代', '150-0012', 'ご紹介',            'female'),
('福田 俊彦',   'フクダ トシヒコ',   '090-2001-0021', '40代', '150-0001', '看板・チラシ',      'male'),
('本田 千恵',   'ホンダ チエ',       '090-2001-0022', '30代', '151-0053', 'インターネット検索', 'female'),
('前田 勇',     'マエダ イサム',     '090-2001-0023', '60代', '150-0044', 'ご紹介',            'male'),
('松井 里奈',   'マツイ リナ',       '090-2001-0024', '20代', '150-0001', 'SNS・Instagram',    'female'),
('三浦 健太',   'ミウラ ケンタ',     '090-2001-0025', '30代', '150-0013', 'インターネット検索', 'male'),
('村田 美智子', 'ムラタ ミチコ',     '090-2001-0026', '70代', '151-0051', 'ご紹介',            'female'),
('森田 哲也',   'モリタ テツヤ',     '090-2001-0027', '40代', '150-0001', 'インターネット検索', 'male'),
('山口 瑠美',   'ヤマグチ ルミ',     '090-2001-0028', '20代', '150-0002', 'SNS・Instagram',    'female'),
('横田 博',     'ヨコタ ヒロシ',     '090-2001-0029', '50代', '150-0011', 'ご紹介',            'male'),
('吉田 沙織',   'ヨシダ サオリ',     '090-2001-0030', '30代', '150-0001', 'インターネット検索', 'female')
ON CONFLICT DO NOTHING;
