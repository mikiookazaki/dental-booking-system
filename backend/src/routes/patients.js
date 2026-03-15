// routes/patients.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function isValidKana(str) {
  return /^[ァ-ヶー　\s]+$/.test(str);
}

// =============================================
// GET /api/patients
// 【3】検索パラメータを q と search 両方対応
// =============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const search = req.query.q || req.query.search || '';
    let query = `
      SELECT id, patient_code, name, name_kana, phone, email,
             birth_date, gender, address, notes,
             line_user_id, total_visits, created_at
      FROM patients
      WHERE is_active = TRUE
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        name ILIKE $1 OR name_kana ILIKE $1
        OR phone LIKE $1 OR patient_code ILIKE $1
      )`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    // patients配列として返す（既存フロントと互換）
    res.json({ patients: result.rows });
  } catch (err) {
    console.error('GET patients error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// GET /api/patients/:id
// =============================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '患者が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// GET /api/patients/:id/qr
// =============================================
router.get('/:id/qr', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, patient_code, name, name_kana, line_user_id FROM patients WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '患者が見つかりません' });
    const p = result.rows[0];
    const lineId = process.env.LINE_BOT_BASIC_ID || '@210vmmzk';
    const qr_url = `https://line.me/R/ti/p/${lineId}?patientCode=${p.patient_code}`;
    res.json({
      id: p.id,
      patient_code: p.patient_code,
      name: p.name,
      name_kana: p.name_kana,
      line_linked: !!p.line_user_id,
      qr_url,
    });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// POST /api/patients 新患登録【8】カタカナ必須
// =============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, birth_date, gender, address, notes } = req.body;

    if (!name || !name?.trim()) {
      return res.status(400).json({ error: '氏名は必須です' });
    }
    if (!name_kana || !name_kana?.trim()) {
      return res.status(400).json({ error: 'フリガナ（カタカナ）は必須です' });
    }
    if (!isValidKana(name_kana.trim())) {
      return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });
    }

    const result = await pool.query(`
      INSERT INTO patients (name, name_kana, phone, email, birth_date, gender, address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [name.trim(), name_kana.trim(), phone, email, birth_date, gender, address, notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST patient error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// PUT /api/patients/:id
// =============================================
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, birth_date, gender, address, notes } = req.body;

    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ error: '氏名は必須です' });
    }
    if (name_kana !== undefined) {
      if (!name_kana?.trim()) return res.status(400).json({ error: 'フリガナは必須です' });
      if (!isValidKana(name_kana.trim())) return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });
    }

    const result = await pool.query(`
      UPDATE patients SET
        name       = COALESCE($1, name),
        name_kana  = COALESCE($2, name_kana),
        phone      = COALESCE($3, phone),
        email      = COALESCE($4, email),
        birth_date = COALESCE($5, birth_date),
        gender     = COALESCE($6, gender),
        address    = COALESCE($7, address),
        notes      = COALESCE($8, notes),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [name?.trim(), name_kana?.trim(), phone, email, birth_date, gender, address, notes, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: '患者が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
