// ============================================================
// routes/treatments.js
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM treatments ORDER BY display_order, id'
    );
    res.json({ treatments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, name_en, duration, category, assignable_roles, price, color, line_visible } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO treatments (name,name_en,duration,category,assignable_roles,price,color,line_visible)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [name, name_en, duration, category, assignable_roles, price, color, line_visible]);
    res.status(201).json({ treatment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, name_en, duration, category, assignable_roles, price, color, is_active, line_visible } = req.body;
  try {
    const result = await db.query(`
      UPDATE treatments SET name=$1,name_en=$2,duration=$3,category=$4,
        assignable_roles=$5,price=$6,color=$7,is_active=$8,line_visible=$9
      WHERE id=$10 RETURNING *
    `, [name, name_en, duration, category, assignable_roles, price, color, is_active, line_visible, req.params.id]);
    res.json({ treatment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
