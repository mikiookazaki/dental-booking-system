// ============================================================
// routes/settings.js
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

// 全設定を取得
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM clinic_settings ORDER BY key');
    // キーバリュー形式に変換
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 設定を一括更新
router.put('/', async (req, res) => {
  const { settings } = req.body; // { key: value, ... }
  try {
    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        INSERT INTO clinic_settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
      `, [key, String(value)]);
    }
    res.json({ message: '設定を保存しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// ============================================================
// routes/blockedSlots.js  ← 別ファイルに書くが今回はまとめる
// ============================================================
// このファイルを blockedSlots.js としても使えるようエクスポート
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
