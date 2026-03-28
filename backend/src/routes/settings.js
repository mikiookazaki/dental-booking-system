// ============================================================
// routes/settings.js  （Supabase移行版）
// ============================================================
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 全設定を取得
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clinic_settings')
      .select('key, value')
      .order('key');

    if (error) throw error;

    // AdminSettings.jsx が期待する { settings: { key: { value } } } 形式に変換
    const settings = {};
    data.forEach(row => { settings[row.key] = { value: row.value }; });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 設定を一括更新
router.put('/', async (req, res) => {
  const { updates, settings } = req.body;
  const data = updates || settings || {};
  try {
    for (const [key, value] of Object.entries(data)) {
      const { error } = await supabase
        .from('clinic_settings')
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    }
    res.json({ message: '設定を保存しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// ============================================================
// blockedSlots 部分（Supabase移行版）
// ============================================================
const db = require('../config/database'); // blockedSlotsはまだRender側を使用

const blockedRouter = express.Router();

blockedRouter.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    let query = 'SELECT bs.*, ARRAY(SELECT chair_id FROM blocked_slot_chairs WHERE blocked_slot_id=bs.id) AS chair_ids FROM blocked_slots bs WHERE 1=1';
    const params = [];
    if (month) {
      query += ` AND TO_CHAR(block_date, 'YYYY-MM') = $1`;
      params.push(month);
    }
    query += ' ORDER BY block_date';
    const result = await db.query(query, params);
    res.json({ blocked_slots: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

blockedRouter.post('/', async (req, res) => {
  const { block_date, start_time, end_time, affects_all, reason, chair_ids } = req.body;
  if (!block_date || !reason) return res.status(400).json({ error: '日付と理由は必須です' });
  try {
    const result = await db.query(`
      INSERT INTO blocked_slots (block_date, start_time, end_time, affects_all, reason)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [block_date, start_time||null, end_time||null, affects_all, reason]);

    const id = result.rows[0].id;
    if (!affects_all && chair_ids?.length) {
      for (const cid of chair_ids) {
        await db.query(
          'INSERT INTO blocked_slot_chairs (blocked_slot_id, chair_id) VALUES ($1,$2)',
          [id, cid]
        );
      }
    }
    res.status(201).json({ message: 'ブロックを追加しました', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

blockedRouter.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM blocked_slots WHERE id = $1', [req.params.id]);
    res.json({ message: 'ブロックを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.blockedRouter = blockedRouter;
module.exports = router;
