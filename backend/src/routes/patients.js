const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// 患者一覧（検索対応）
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let query    = 'SELECT * FROM patients WHERE is_active = TRUE';
    const params = [];
    if (q) {
      query += ' AND (name ILIKE $1 OR name_kana ILIKE $1 OR patient_code ILIKE $1 OR phone LIKE $1)';
      params.push(`%${q}%`);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ patients: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 患者詳細
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: '患者が見つかりません' });
    res.json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 患者登録（新患）
router.post('/', async (req, res) => {
  const { name, name_kana, birth_date, gender, phone, email, address, insurance_number, allergies, notes } = req.body;
  if (!name) return res.status(400).json({ error: '氏名は必須です' });
  try {
    const token        = uuidv4().replace(/-/g, '');
    const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日有効

    const result = await db.query(`
      INSERT INTO patients
        (name, name_kana, birth_date, gender, phone, email, address,
         insurance_number, allergies, notes, patient_token, token_expires, first_visit)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_DATE)
      RETURNING *
    `, [name, name_kana, birth_date, gender, phone, email, address,
        insurance_number, allergies, notes, token, tokenExpires]);

    res.status(201).json({ patient: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 患者情報更新
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
// QRコード表示用URL発行（トークンが期限切れなら再発行）
// ============================================================
router.get('/:id/qr', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, patient_code, patient_token, token_expires FROM patients WHERE id=$1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '患者が見つかりません' });

    const patient = result.rows[0];

    // トークンが未設定または期限切れなら再発行
    if (!patient.patient_token || !patient.token_expires || new Date(patient.token_expires) < new Date()) {
      const token   = uuidv4().replace(/-/g, '');
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日
      await db.query(
        'UPDATE patients SET patient_token=$1, token_expires=$2 WHERE id=$3',
        [token, expires, req.params.id]
      );
      patient.patient_token = token;
      patient.token_expires = expires;
    }

    // LINEでBotにメッセージを送るURL
    const botId = process.env.LINE_BOT_ID;
    const text  = `token=${patient.patient_token}`;
    const url   = `https://line.me/R/oaMessage/${encodeURIComponent(botId)}/?text=${encodeURIComponent(text)}`;

    res.json({
      patient_code: patient.patient_code,
      name:         patient.name,
      token:        patient.patient_token,
      expires:      patient.token_expires,
      qr_url:       url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/patients/link-line
// LINE UserID と患者を紐づける（QR連携）
// ============================================================
router.post('/link-line', async (req, res) => {
  const { patient_token, line_user_id, birth_date } = req.body;
  if (!patient_token || !line_user_id) {
    return res.status(400).json({ error: 'token と line_user_id は必須です' });
  }
  try {
    const result = await db.query(
      'SELECT * FROM patients WHERE patient_token = $1 AND token_expires > NOW()',
      [patient_token]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'QRコードが無効または期限切れです。受付にお問い合わせください。' });
    }

    const patient = result.rows[0];

    // 生年月日で本人確認
    if (birth_date && patient.birth_date) {
      const dbDate = patient.birth_date.toISOString().split('T')[0];
      if (dbDate !== birth_date) {
        return res.status(401).json({ error: '生年月日が一致しません' });
      }
    }

    // LINE UserIDを保存してトークンを無効化
    await db.query(`
      UPDATE patients SET
        line_user_id   = $1,
        line_linked_at = NOW(),
        patient_token  = NULL,
        token_expires  = NULL,
        updated_at     = NOW()
      WHERE id = $2
    `, [line_user_id, patient.id]);

    res.json({
      message:      'LINE連携が完了しました',
      patient_code: patient.patient_code,
      name:         patient.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
