// routes/patients.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateToken = require('../middleware/auth');

// カタカナバリデーション【8】
function isValidKana(str) {
  return /^[ァ-ヶー　\s]+$/.test(str);
}

// =============================================
// GET /api/patients
// 患者一覧
// =============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT id, patient_code, name, name_kana, phone, email,
             date_of_birth, gender, address, notes, created_at
      FROM patients
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE name ILIKE $1 OR name_kana ILIKE $1
                   OR phone LIKE $1 OR patient_code ILIKE $1`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
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
// POST /api/patients
// 新患登録【8】カタカナ必須
// =============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, date_of_birth, gender, address, notes } = req.body;

    // バリデーション
    if (!name || !name?.trim()) {
      return res.status(400).json({ error: '氏名は必須です' });
    }
    if (!name_kana || !name_kana?.trim()) {
      return res.status(400).json({ error: 'フリガナ（カタカナ）は必須です' });
    }
    if (!isValidKana(name_kana.trim())) {
      return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });
    }

    // 患者コード生成（P + 年 + 連番6桁）
    const year = new Date().getFullYear().toString().slice(-2);
    const countResult = await pool.query('SELECT COUNT(*) FROM patients');
    const seq = String(parseInt(countResult.rows[0].count) + 1).padStart(6, '0');
    const patient_code = `P${year}${seq}`;

    const result = await pool.query(`
      INSERT INTO patients (patient_code, name, name_kana, phone, email, date_of_birth, gender, address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [patient_code, name.trim(), name_kana.trim(), phone, email, date_of_birth, gender, address, notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST patient error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// PUT /api/patients/:id
// 患者更新【8】カタカナ必須
// =============================================
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, date_of_birth, gender, address, notes } = req.body;

    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ error: '氏名は必須です' });
    }
    if (name_kana !== undefined) {
      if (!name_kana?.trim()) {
        return res.status(400).json({ error: 'フリガナ（カタカナ）は必須です' });
      }
      if (!isValidKana(name_kana.trim())) {
        return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });
      }
    }

    const result = await pool.query(`
      UPDATE patients SET
        name          = COALESCE($1, name),
        name_kana     = COALESCE($2, name_kana),
        phone         = COALESCE($3, phone),
        email         = COALESCE($4, email),
        date_of_birth = COALESCE($5, date_of_birth),
        gender        = COALESCE($6, gender),
        address       = COALESCE($7, address),
        notes         = COALESCE($8, notes),
        updated_at    = NOW()
      WHERE id = $9
      RETURNING *
    `, [name?.trim(), name_kana?.trim(), phone, email, date_of_birth, gender, address, notes, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: '患者が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
