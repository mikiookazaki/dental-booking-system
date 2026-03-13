const express  = require('express');
const router   = express.Router();
const db       = require('../config/database');

// ============================================================
// 患者一覧（検索対応）
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let query    = 'SELECT * FROM patients WHERE is_active = TRUE';
    const params = [];
    if (q) {
      query += ' AND (name ILIKE $1 OR name_kana ILIKE $1 OR patient_code ILIKE $1 OR rececon_id ILIKE $1 OR phone LIKE $1)';
      params.push(`%${q}%`);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ patients: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 患者詳細
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: '患者が見つかりません' });
    res.json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 患者登録
// 初診：名前・性別・電話番号など最小情報で登録
// patient_code は DB トリガーで自動採番（P-00001 形式）
// ============================================================
router.post('/', async (req, res) => {
  const { name, name_kana, phone, birth_date, gender, email, address, insurance_number, allergies, notes } = req.body;
  if (!name) return res.status(400).json({ error: '氏名は必須です' });
  try {
    const result = await db.query(`
      INSERT INTO patients
        (name, name_kana, phone, birth_date, gender, email, address,
         insurance_number, allergies, notes, first_visit)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE)
      RETURNING *
    `, [name, name_kana, phone, birth_date, gender, email, address,
        insurance_number, allergies, notes]);
    res.status(201).json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 患者情報更新
// ============================================================
router.put('/:id', async (req, res) => {
  const { name, name_kana, birth_date, gender, phone, email, address, allergies, notes } = req.body;
  try {
    const result = await db.query(`
      UPDATE patients SET
        name=$1, name_kana=$2, birth_date=$3, gender=$4,
        phone=$5, email=$6, address=$7, allergies=$8, notes=$9,
        updated_at=NOW()
      WHERE id=$10 RETURNING *
    `, [name, name_kana, birth_date, gender, phone, email, address, allergies, notes, req.params.id]);
    res.json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/patients/:id/qr
// QRコード用URLを返す（patient_code 固定・有効期限なし）
// QRに埋め込む内容: /api/line/link?code=P-00001
// ============================================================
router.get('/:id/qr', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, patient_code, line_user_id FROM patients WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '患者が見つかりません' });

    const patient = result.rows[0];
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const linkUrl    = `${backendUrl}/api/line/link?code=${patient.patient_code}`;

    res.json({
      patient_code:  patient.patient_code,
      name:          patient.name,
      line_linked:   !!patient.line_user_id,
      qr_url:        linkUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/patients/link-line（旧トークン方式との互換用・将来削除可）
// ============================================================
router.post('/link-line', async (req, res) => {
  const { patient_code, line_user_id } = req.body;
  if (!patient_code || !line_user_id) {
    return res.status(400).json({ error: 'patient_code と line_user_id は必須です' });
  }
  try {
    const result = await db.query(
      'SELECT * FROM patients WHERE patient_code = $1 AND is_active = TRUE',
      [patient_code]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: '患者が見つかりません' });
    }
    const patient = result.rows[0];

    await db.query(`
      UPDATE patients SET
        line_user_id   = $1,
        line_linked_at = NOW(),
        updated_at     = NOW()
      WHERE id = $2
    `, [line_user_id, patient.id]);

    res.json({ message: 'LINE連携が完了しました', patient_code: patient.patient_code, name: patient.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUT /api/patients/:id/rececon
// レセコン連携：rececon_id を設定して名寄せ完了
// ============================================================
router.put('/:id/rececon', async (req, res) => {
  const { rececon_id } = req.body;
  if (!rececon_id) return res.status(400).json({ error: 'rececon_id は必須です' });
  try {
    const result = await db.query(`
      UPDATE patients SET
        rececon_id  = $1,
        data_source = 'rececon',
        mapped_at   = NOW(),
        updated_at  = NOW()
      WHERE id = $2 RETURNING *
    `, [rececon_id, req.params.id]);
    res.json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
