// backend/src/routes/admin.js
const express              = require('express');
const router               = express.Router();
const db                   = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ============================================================
// GET /api/admin/export/csv?month=2026-03&type=appointments&token=xxx
// CSVエクスポート（window.openで開くためクエリtokenも受け付ける）
// ※ requireAuthの前に定義してクエリtokenを処理
// ============================================================
router.get('/export/csv', async (req, res) => {
  const { month, type = 'appointments', token } = req.query;
  if (!month) return res.status(400).json({ error: 'month パラメータが必要です' });

  // クエリtokenで直接JWT検証（window.openはAuthorizationヘッダーを送れないため）
  const authToken = token || (req.headers.authorization?.replace('Bearer ', ''));
  if (!authToken) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }

  try {
    let rows, headers, filename;

    if (type === 'appointments') {
      const result = await db.query(`
        SELECT
          a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.source,
          p.patient_code, p.name AS patient_name, p.phone AS patient_phone,
          s.name AS staff_name, s.role AS staff_role,
          c.name AS chair_name,
          t.name AS treatment_name, t.duration, t.price,
          a.cancel_reason, a.cancelled_by, a.cancelled_at,
          a.created_at
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN staff s ON a.staff_id = s.id
        JOIN chairs c ON a.chair_id = c.id
        JOIN treatments t ON a.treatment_id = t.id
        WHERE TO_CHAR(a.appointment_date, 'YYYY-MM') = $1
        ORDER BY a.appointment_date, a.start_time
      `, [month]);
      headers = ['ID','日付','開始','終了','ステータス','予約元','患者番号','患者名','電話','担当者','役職','チェア','治療名','所要時間(分)','料金','キャンセル理由','キャンセル者','キャンセル日時','作成日時'];
      rows = result.rows;
      filename = `appointments_${month}.csv`;
    } else if (type === 'patients') {
      const result = await db.query(`
        SELECT patient_code, name, name_kana, birth_date, gender, phone, email,
          first_visit, last_visit, total_visits,
          CASE WHEN line_user_id IS NOT NULL THEN 'あり' ELSE 'なし' END AS line_linked,
          data_source, created_at
        FROM patients WHERE is_active = TRUE ORDER BY patient_code
      `);
      headers = ['患者番号','氏名','カナ','生年月日','性別','電話','メール','初診日','最終来院','来院回数','LINE連携','データソース','登録日'];
      rows = result.rows;
      filename = `patients_${month}.csv`;
    }

    // CSV生成（BOM付きUTF-8でExcel対応）
    const BOM = '\uFEFF';
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const values = Object.values(row).map(v => {
        if (v === null || v === undefined) return '';
        const str = String(v).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      });
      csvRows.push(values.join(','));
    });
    const csv = BOM + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 全ルートに認証を適用
router.use(requireAuth);
router.use(requireAdmin);

// ============================================================
// GET /api/admin/settings
// 全クリニック設定を取得
// ============================================================
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value, description FROM clinic_settings ORDER BY id');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = { value: r.value, description: r.description } });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUT /api/admin/settings
// 設定を一括更新
// body: { updates: { key: value, ... } }
// ============================================================
router.put('/settings', async (req, res) => {
  const { updates } = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates オブジェクトが必要です' });
  }
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        'UPDATE clinic_settings SET value=$1, updated_at=NOW() WHERE key=$2',
        [String(value), key]
      );
    }
    res.json({ message: '設定を更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/blocked-slots
// 予約ブロック一覧
// ============================================================
router.get('/blocked-slots', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT bs.*, 
        array_agg(bsc.chair_id) FILTER (WHERE bsc.chair_id IS NOT NULL) AS chair_ids
      FROM blocked_slots bs
      LEFT JOIN blocked_slot_chairs bsc ON bs.id = bsc.blocked_slot_id
      WHERE bs.block_date >= CURRENT_DATE
      GROUP BY bs.id
      ORDER BY bs.block_date, bs.start_time
    `);
    res.json({ blocked_slots: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/blocked-slots
// 予約ブロックを追加
// ============================================================
router.post('/blocked-slots', async (req, res) => {
  const { block_date, start_time, end_time, affects_all, reason, chair_ids } = req.body;
  if (!block_date || !reason) {
    return res.status(400).json({ error: 'block_date と reason は必須です' });
  }
  try {
    const result = await db.query(`
      INSERT INTO blocked_slots (block_date, start_time, end_time, affects_all, reason, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [block_date, start_time || null, end_time || null, affects_all ?? true, reason, req.admin.id]);

    const id = result.rows[0].id;

    // チェア指定がある場合
    if (!affects_all && chair_ids?.length) {
      for (const cid of chair_ids) {
        await db.query(
          'INSERT INTO blocked_slot_chairs (blocked_slot_id, chair_id) VALUES ($1, $2)',
          [id, cid]
        );
      }
    }

    res.status(201).json({ message: 'ブロックを追加しました', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE /api/admin/blocked-slots/:id
// 予約ブロックを削除
// ============================================================
router.delete('/blocked-slots/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM blocked_slots WHERE id=$1', [req.params.id]);
    res.json({ message: 'ブロックを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/dashboard?month=2026-03
// 月次経営ダッシュボードデータ
// ============================================================
router.get('/dashboard', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month パラメータが必要です（例: 2026-03）' });

  try {
    // 総予約数・完了数・キャンセル数
    const summary = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed')  AS confirmed,
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
        COUNT(*) FILTER (WHERE status = 'no_show')    AS no_show,
        COUNT(*)                                       AS total
      FROM appointments
      WHERE TO_CHAR(appointment_date, 'YYYY-MM') = $1
    `, [month]);

    // 治療別集計
    const byTreatment = await db.query(`
      SELECT t.name, t.color,
        COUNT(*) FILTER (WHERE a.status IN ('confirmed','completed')) AS count,
        SUM(t.duration) FILTER (WHERE a.status IN ('confirmed','completed')) AS total_minutes
      FROM appointments a
      JOIN treatments t ON a.treatment_id = t.id
      WHERE TO_CHAR(a.appointment_date, 'YYYY-MM') = $1
      GROUP BY t.id, t.name, t.color
      ORDER BY count DESC
    `, [month]);

    // ドクター別集計
    const byStaff = await db.query(`
      SELECT s.name, s.role, s.color,
        COUNT(*) FILTER (WHERE a.status IN ('confirmed','completed')) AS count,
        COUNT(*) FILTER (WHERE a.status = 'cancelled')               AS cancelled,
        SUM(t.duration) FILTER (WHERE a.status IN ('confirmed','completed')) AS total_minutes
      FROM appointments a
      JOIN staff s ON a.staff_id = s.id
      JOIN treatments t ON a.treatment_id = t.id
      WHERE TO_CHAR(a.appointment_date, 'YYYY-MM') = $1
      GROUP BY s.id, s.name, s.role, s.color
      ORDER BY count DESC
    `, [month]);

    // チェア稼働率
    const byChair = await db.query(`
      SELECT c.name,
        COUNT(*) FILTER (WHERE a.status IN ('confirmed','completed')) AS count,
        SUM(t.duration) FILTER (WHERE a.status IN ('confirmed','completed')) AS total_minutes
      FROM appointments a
      JOIN chairs c ON a.chair_id = c.id
      JOIN treatments t ON a.treatment_id = t.id
      WHERE TO_CHAR(a.appointment_date, 'YYYY-MM') = $1
      GROUP BY c.id, c.name, c.display_order
      ORDER BY c.display_order
    `, [month]);

    // 日別予約数（カレンダーヒートマップ用）
    const byDay = await db.query(`
      SELECT
        TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE status IN ('confirmed','completed')) AS count,
        COUNT(*) FILTER (WHERE status = 'cancelled')               AS cancelled
      FROM appointments
      WHERE TO_CHAR(appointment_date, 'YYYY-MM') = $1
      GROUP BY appointment_date
      ORDER BY appointment_date
    `, [month]);

    res.json({
      month,
      summary:      summary.rows[0],
      byTreatment:  byTreatment.rows,
      byStaff:      byStaff.rows,
      byChair:      byChair.rows,
      byDay:        byDay.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
