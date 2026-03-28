// ============================================================
// backend/src/routes/licenses.js
// ライセンス管理API
// ============================================================

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

// ── ライセンス取得 ────────────────────────────────────────
// GET /api/licenses/:clinicId
router.get('/:clinicId', async (req, res) => {
  const { clinicId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         clinic_id,
         plan,
         started_at,
         expires_at,
         is_active,
         CASE
           WHEN expires_at IS NULL THEN true
           WHEN expires_at > NOW() THEN true
           ELSE false
         END AS is_valid
       FROM clinic_licenses
       WHERE clinic_id = $1 AND is_active = true`,
      [clinicId]
    );

    if (result.rows.length === 0) {
      // レコードがない場合はBasicを返す
      return res.json({ plan: 'basic', is_valid: true, expires_at: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ライセンス取得エラー:', err.message);
    res.status(500).json({ error: 'ライセンス情報の取得に失敗しました' });
  }
});

// ── ライセンス更新（管理者のみ）─────────────────────────
// PUT /api/licenses/:clinicId
router.put('/:clinicId', async (req, res) => {
  const { clinicId } = req.params;
  const { plan, expires_at } = req.body;

  const validPlans = ['basic', 'standard', 'pro'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: '無効なプランです' });
  }

  try {
    // 変更前のプランを取得（履歴用）
    const current = await pool.query(
      'SELECT plan FROM clinic_licenses WHERE clinic_id = $1',
      [clinicId]
    );
    const fromPlan = current.rows[0]?.plan || null;

    // ライセンス更新
    const result = await pool.query(
      `UPDATE clinic_licenses
       SET plan = $1, expires_at = $2, updated_at = NOW()
       WHERE clinic_id = $3
       RETURNING *`,
      [plan, expires_at || null, clinicId]
    );

    if (result.rows.length === 0) {
      // レコードがなければ新規作成
      await pool.query(
        `INSERT INTO clinic_licenses (clinic_id, plan, expires_at, is_active)
         VALUES ($1, $2, $3, true)`,
        [clinicId, plan, expires_at || null]
      );
    }

    // 変更履歴を記録
    await pool.query(
      `INSERT INTO license_history (clinic_id, from_plan, to_plan, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [clinicId, fromPlan, plan, 'admin', '管理画面から変更']
    );

    res.json({ success: true, plan });
  } catch (err) {
    console.error('ライセンス更新エラー:', err.message);
    res.status(500).json({ error: 'ライセンスの更新に失敗しました' });
  }
});

module.exports = router;
