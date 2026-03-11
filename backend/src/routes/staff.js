// ============================================================
// routes/staff.js
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, 
        sh.work_days, sh.start_time AS shift_start, sh.end_time AS shift_end,
        sh.break_start, sh.break_end,
        ARRAY(SELECT chair_id FROM staff_chair_assignments WHERE staff_id = s.id) AS chair_ids
      FROM staff s
      LEFT JOIN staff_shifts sh ON s.id = sh.staff_id
      ORDER BY s.id
    `);
    res.json({ staff: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, name_kana, role, title, color, email, phone } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO staff (name,name_kana,role,title,color,email,phone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, name_kana, role, title, color, email, phone]
    );
    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, name_kana, role, title, color, email, phone, is_active } = req.body;
  try {
    const result = await db.query(`
      UPDATE staff SET name=$1,name_kana=$2,role=$3,title=$4,color=$5,
        email=$6,phone=$7,is_active=$8,updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [name, name_kana, role, title, color, email, phone, is_active, req.params.id]);
    res.json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// シフト更新
router.put('/:id/shift', async (req, res) => {
  const { work_days, start_time, end_time, break_start, break_end, chair_ids } = req.body;
  try {
    await db.query(`
      INSERT INTO staff_shifts (staff_id,work_days,start_time,end_time,break_start,break_end)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (staff_id) DO UPDATE SET
        work_days=$2, start_time=$3, end_time=$4,
        break_start=$5, break_end=$6, updated_at=NOW()
    `, [req.params.id, work_days, start_time, end_time, break_start, break_end]);

    if (chair_ids) {
      await db.query('DELETE FROM staff_chair_assignments WHERE staff_id = $1', [req.params.id]);
      for (const cid of chair_ids) {
        await db.query(
          'INSERT INTO staff_chair_assignments (staff_id, chair_id) VALUES ($1,$2)',
          [req.params.id, cid]
        );
      }
    }
    res.json({ message: 'シフトを更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
