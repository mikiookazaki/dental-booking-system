// ============================================================
// routes/chairs.js
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM chairs WHERE is_active=TRUE ORDER BY display_order');
    res.json({ chairs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, line_bookable, note } = req.body;
  try {
    const result = await db.query(
      'UPDATE chairs SET name=$1,line_bookable=$2,note=$3 WHERE id=$4 RETURNING *',
      [name, line_bookable, note, req.params.id]
    );
    res.json({ chair: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
