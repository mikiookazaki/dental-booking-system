-- =============================================
-- サンプルデータ更新: 郵便番号・来院きっかけ追加
-- 医院所在地: 東京都渋谷区付近を想定
-- 近隣の郵便番号から多く来院するパターン
-- =============================================

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00001';

UPDATE patients SET
  postal_code     = '150-0002',
  referral_source = 'ご紹介'
WHERE patient_code = 'P-00002';

UPDATE patients SET
  postal_code     = '151-0051',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00003';

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'SNS・Instagram'
WHERE patient_code = 'P-00004';

UPDATE patients SET
  postal_code     = '150-0012',
  referral_source = 'ご紹介'
WHERE patient_code = 'P-00005';

UPDATE patients SET
  postal_code     = '151-0053',
  referral_source = '看板・チラシ'
WHERE patient_code = 'P-00006';

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00007';

UPDATE patients SET
  postal_code     = '150-0011',
  referral_source = 'ご紹介'
WHERE patient_code = 'P-00008';

UPDATE patients SET
  postal_code     = '151-0051',
  referral_source = 'SNS・Instagram'
WHERE patient_code = 'P-00009';

UPDATE patients SET
  postal_code     = '150-0002',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00010';

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'ご紹介'
WHERE patient_code = 'P-00011';

UPDATE patients SET
  postal_code     = '150-0013',
  referral_source = '看板・チラシ'
WHERE patient_code = 'P-00012';

UPDATE patients SET
  postal_code     = '151-0053',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00013';

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'SNS・Instagram'
WHERE patient_code = 'P-00014';

UPDATE patients SET
  postal_code     = '150-0044',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00015';

UPDATE patients SET
  postal_code     = '151-0051',
  referral_source = 'ご紹介'
WHERE patient_code = 'P-00016';

UPDATE patients SET
  postal_code     = '150-0002',
  referral_source = 'SNS・Instagram'
WHERE patient_code = 'P-00017';

UPDATE patients SET
  postal_code     = '150-0001',
  referral_source = 'インターネット検索'
WHERE patient_code = 'P-00018';
