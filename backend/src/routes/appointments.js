const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

// ============================================================
// GET /api/appointments
// 予約一覧取得（日付・スタッフ・チェアで絞り込み可）
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { date, month, staff_id, chair_id, status, patient_id } = req.query;

    let query = 'SELECT * FROM v_appointments WHERE 1=1';
    const params = [];
    let i = 1;

    if (date) {
      query += ` AND appointment_date = $${i++}`;
      params.push(date);
    }
    if (month) {
      // month = "2026-03" の形式
      query += ` AND TO_CHAR(appointment_date, 'YYYY-MM') = $${i++}`;
      params.push(month);
    }
    if (staff_id) {
      query += ` AND staff_id = $${i++}`;
      params.push(staff_id);
    }
    if (chair_id) {
      query += ` AND chair_id = $${i++}`;
      params.push(chair_id);
    }
    if (status) {
      query += ` AND status = $${i++}`;
      params.push(status);
    }
    if (patient_id) {
      query += ` AND patient_id = $${i++}`;
      params.push(patient_id);
    }

    query += ' ORDER BY appointment_date, start_time';

    const result = await db.query(query, params);
    res.json({ appointments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ============================================================
// GET /api/appointments/:id
// 予約詳細取得
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM v_appointments WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '予約が見つかりません' });
    }
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// ============================================================
// POST /api/appointments
// 予約を新規作成
// ============================================================
router.post('/', async (req, res) => {
  const {
    patient_id, staff_id, chair_id, treatment_id,
    appointment_date, start_time,
    notes, source = 'staff',
    patient_name, patient_phone,
  } = req.body;

  // 必須項目チェック
  if (!patient_id || !staff_id || !chair_id || !treatment_id || !appointment_date || !start_time) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  try {
    // 治療の所要時間を取得して end_time を計算
    const treatResult = await db.query(
      'SELECT duration FROM treatments WHERE id = $1',
      [treatment_id]
    );
    if (treatResult.rows.length === 0) {
      return res.status(400).json({ error: '治療メニューが見つかりません' });
    }
    const duration = treatResult.rows[0].duration;

    // end_time = start_time + duration 分
    const endTime = addMinutesToTime(start_time, duration);

    // 空き枠チェック（同じチェア・同じ日時に重複がないか）
    const conflictCheck = await db.query(`
      SELECT id FROM appointments
      WHERE chair_id = $1
        AND appointment_date = $2
        AND status = 'confirmed'
        AND (
          (start_time <= $3 AND end_time > $3) OR
          (start_time < $4 AND end_time >= $4) OR
          (start_time >= $3 AND end_time <= $4)
        )
    `, [chair_id, appointment_date, start_time, endTime]);

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'この時間帯はすでに予約が入っています' });
    }

    // 予約を作成
    const result = await db.query(`
      INSERT INTO appointments
        (patient_id, staff_id, chair_id, treatment_id,
         appointment_date, start_time, end_time,
         status, source, notes, patient_name, patient_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$10,$11)
      RETURNING id
    `, [
      patient_id, staff_id, chair_id, treatment_id,
      appointment_date, start_time, endTime,
      source, notes, patient_name, patient_phone,
    ]);

    const newId = result.rows[0].id;

    // ログ記録
    await db.query(`
      INSERT INTO appointment_logs (appointment_id, action, changed_by, note)
      VALUES ($1, 'created', $2, $3)
    `, [newId, source, `${appointment_date} ${start_time} 予約作成`]);

    // 作成した予約の詳細を返す
    const appt = await db.query('SELECT * FROM v_appointments WHERE id = $1', [newId]);
    res.status(201).json({ appointment: appt.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// ============================================================
// PUT /api/appointments/:id
// 予約を更新（日時変更など）
// ============================================================
router.put('/:id', async (req, res) => {
  const {
    staff_id, chair_id, treatment_id,
    appointment_date, start_time, notes,
  } = req.body;

  try {
    // まず既存の予約を取得
    const existing = await db.query(
      'SELECT * FROM appointments WHERE id = $1', [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '予約が見つかりません' });
    }

    const appt = existing.rows[0];

    // 治療の所要時間を取得
    const tId = treatment_id || appt.treatment_id;
    const treatResult = await db.query('SELECT duration FROM treatments WHERE id = $1', [tId]);
    const duration = treatResult.rows[0].duration;
    const newStart = start_time || appt.start_time;
    const endTime  = addMinutesToTime(newStart, duration);

    await db.query(`
      UPDATE appointments SET
        staff_id         = COALESCE($1, staff_id),
        chair_id         = COALESCE($2, chair_id),
        treatment_id     = COALESCE($3, treatment_id),
        appointment_date = COALESCE($4, appointment_date),
        start_time       = COALESCE($5, start_time),
        end_time         = $6,
        notes            = COALESCE($7, notes),
        updated_at       = NOW()
      WHERE id = $8
    `, [staff_id, chair_id, treatment_id, appointment_date, start_time, endTime, notes, req.params.id]);

    // ログ記録
    await db.query(`
      INSERT INTO appointment_logs (appointment_id, action, changed_by, note)
      VALUES ($1, 'updated', 'staff', '予約内容を変更')
    `, [req.params.id]);

    const updated = await db.query('SELECT * FROM v_appointments WHERE id = $1', [req.params.id]);
    res.json({ appointment: updated.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// ============================================================
// DELETE /api/appointments/:id  → キャンセル
// ============================================================
router.delete('/:id', async (req, res) => {
  const { cancelled_by = 'staff', cancel_reason } = req.body;

  try {
    await db.query(`
      UPDATE appointments SET
        status       = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = $1,
        cancel_reason= $2,
        updated_at   = NOW()
      WHERE id = $3
    `, [cancelled_by, cancel_reason, req.params.id]);

    await db.query(`
      INSERT INTO appointment_logs (appointment_id, action, changed_by, note)
      VALUES ($1, 'cancelled', $2, $3)
    `, [req.params.id, cancelled_by, cancel_reason || 'キャンセル']);

    res.json({ message: '予約をキャンセルしました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// ============================================================
// GET /api/appointments/available-slots
// 空き枠を取得（LINE予約で使用）
// ============================================================
router.get('/available/slots', async (req, res) => {
  const { date, treatment_id, staff_id } = req.query;

  if (!date || !treatment_id) {
    return res.status(400).json({ error: 'date と treatment_id は必須です' });
  }

  try {
    // 治療の所要時間を取得
    const treatResult = await db.query(
      'SELECT duration FROM treatments WHERE id = $1', [treatment_id]
    );
    if (treatResult.rows.length === 0) {
      return res.status(400).json({ error: '治療が見つかりません' });
    }
    const duration = treatResult.rows[0].duration;

    // その日の診療時間を取得（簡易版: 09:00〜18:00、昼休み13:00〜14:00）
    const clinicStart = '09:00';
    const clinicEnd   = '18:00';
    const lunchStart  = '13:00';
    const lunchEnd    = '14:00';

    // その日の確定済み予約を取得
    const existingQuery = staff_id
      ? 'SELECT start_time, end_time, chair_id FROM appointments WHERE appointment_date = $1 AND status = $2 AND staff_id = $3'
      : 'SELECT start_time, end_time, chair_id FROM appointments WHERE appointment_date = $1 AND status = $2';

    const params = staff_id
      ? [date, 'confirmed', staff_id]
      : [date, 'confirmed'];

    const existing = await db.query(existingQuery, params);

    // 利用可能なスロットを計算
    const slots = [];
    let current = timeToMinutes(clinicStart);
    const end = timeToMinutes(clinicEnd);
    const lStart = timeToMinutes(lunchStart);
    const lEnd   = timeToMinutes(lunchEnd);

    while (current + duration <= end) {
      const slotEnd = current + duration;

      // 昼休みとの重複チェック
      if (!(current < lEnd && slotEnd > lStart)) {
        const slotTimeStr = minutesToTime(current);
        const slotEndStr  = minutesToTime(slotEnd);

        // 既存予約との重複チェック
        const conflict = existing.rows.some(appt => {
          const aStart = timeToMinutes(appt.start_time.substring(0, 5));
          const aEnd   = timeToMinutes(appt.end_time.substring(0, 5));
          return !(slotEnd <= aStart || current >= aEnd);
        });

        if (!conflict) {
          slots.push({ time: slotTimeStr, endTime: slotEndStr });
        }
      }

      current += 30; // 30分刻み
    }

    res.json({ date, duration, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get available slots' });
  }
});

// ── ユーティリティ関数 ────────────────────────────────────
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function addMinutesToTime(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

module.exports = router;
