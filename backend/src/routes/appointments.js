// routes/appointments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// =============================================
// 【1】DB設定値から動的に空き枠を計算するヘルパー
// =============================================
async function getClinicSettings() {
  const result = await pool.query(`
    SELECT key, value FROM system_settings
    WHERE key IN (
      'open_days', 'open_time', 'close_time',
      'lunch_start', 'lunch_end', 'slot_duration',
      'max_chairs', 'patient_booking_enabled'
    )
  `);
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });

  return {
    openDays: JSON.parse(settings.open_days || '[1,2,3,4,5]'),
    openTime: settings.open_time || '09:00',
    closeTime: settings.close_time || '18:00',
    lunchStart: settings.lunch_start || '13:00',
    lunchEnd: settings.lunch_end || '14:00',
    slotDuration: parseInt(settings.slot_duration || '30'),
    maxChairs: parseInt(settings.max_chairs || '3'),
    patientBookingEnabled: settings.patient_booking_enabled !== 'false'
  };
}

// 指定日が診療日かチェック
function isOpenDay(dateStr, openDays) {
  const dow = new Date(dateStr).getDay();
  return openDays.includes(dow);
}

// HH:MM → 分
function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分 → HH:MM
function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// 指定日の全スロット（昼休み除外）を生成
function generateSlots(dateStr, settings) {
  const { openTime, closeTime, lunchStart, lunchEnd, slotDuration } = settings;
  const slots = [];
  let cur = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const ls = toMinutes(lunchStart);
  const le = toMinutes(lunchEnd);

  while (cur + slotDuration <= end) {
    if (!(cur >= ls && cur < le)) {
      slots.push(toTimeStr(cur));
    }
    cur += slotDuration;
  }
  return slots;
}

// 指定日の予約済み枠をDB取得
async function getBookedSlots(dateStr) {
  const result = await pool.query(`
    SELECT time_slot, chair_number, duration_minutes
    FROM appointments
    WHERE appointment_date = $1
      AND status NOT IN ('cancelled')
  `, [dateStr]);
  return result.rows;
}

// 指定日のブロック枠をDB取得
async function getBlockedSlots(dateStr) {
  const result = await pool.query(`
    SELECT start_time, end_time, block_type, reason
    FROM booking_blocks
    WHERE block_date = $1
      AND (block_type = 'full_day' OR start_time IS NOT NULL)
  `, [dateStr]);
  return result.rows;
}

// =============================================
// GET /api/appointments/available-slots/:date
// =============================================
router.get('/available-slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const settings = await getClinicSettings();

    if (!isOpenDay(date, settings.openDays)) {
      return res.json({ available: false, reason: 'closed', slots: [] });
    }

    const blocks = await getBlockedSlots(date);
    const fullDayBlock = blocks.find(b => b.block_type === 'full_day');
    if (fullDayBlock) {
      return res.json({ available: false, reason: 'blocked', slots: [] });
    }

    const allSlots = generateSlots(date, settings);
    const booked = await getBookedSlots(date);
    const timeBlocks = blocks.filter(b => b.block_type !== 'full_day');

    const slotDetails = allSlots.map(slot => {
      const slotMin = toMinutes(slot);
      const slotEndMin = slotMin + settings.slotDuration;

      const isBlocked = timeBlocks.some(b => {
        const bs = toMinutes(b.start_time);
        const be = toMinutes(b.end_time);
        return slotMin < be && slotEndMin > bs;
      });

      const bookedCount = booked.filter(b => b.time_slot === slot).length;
      const availableChairs = settings.maxChairs - bookedCount;

      return {
        time: slot,
        available: !isBlocked && availableChairs > 0,
        availableChairs: isBlocked ? 0 : availableChairs,
        bookedCount,
        isBlocked
      };
    });

    res.json({
      date,
      available: true,
      slotDuration: settings.slotDuration,
      maxChairs: settings.maxChairs,
      slots: slotDetails
    });
  } catch (err) {
    console.error('available-slots error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// GET /api/appointments/available-dates/:yearMonth
// =============================================
router.get('/available-dates/:yearMonth', async (req, res) => {
  try {
    const { yearMonth } = req.params;
    const [year, month] = yearMonth.split('-').map(Number);
    const settings = await getClinicSettings();

    const daysInMonth = new Date(year, month, 0).getDate();
    const availableDates = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const today = new Date().toISOString().split('T')[0];
      if (dateStr < today) continue;

      if (!isOpenDay(dateStr, settings.openDays)) continue;

      const blocks = await getBlockedSlots(dateStr);
      if (blocks.find(b => b.block_type === 'full_day')) continue;

      const booked = await getBookedSlots(dateStr);
      const allSlots = generateSlots(dateStr, settings);

      const hasAvailable = allSlots.some(slot => {
        const bookedCount = booked.filter(b => b.time_slot === slot).length;
        return bookedCount < settings.maxChairs;
      });

      if (hasAvailable) availableDates.push(dateStr);
    }

    res.json({ yearMonth, availableDates });
  } catch (err) {
    console.error('available-dates error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// GET /api/appointments/calendar/:date
// =============================================
router.get('/calendar/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const settings = await getClinicSettings();

    const result = await pool.query(`
      SELECT
        a.id,
        a.patient_id,
        p.name AS patient_name,
        p.name_kana,
        a.appointment_date,
        a.time_slot,
        a.duration_minutes,
        a.treatment_type,
        a.treatment_color,
        a.chair_number,
        a.doctor_name,
        a.status,
        a.notes,
        a.created_at
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.appointment_date = $1
        AND a.status != 'cancelled'
      ORDER BY a.time_slot, a.chair_number
    `, [date]);

    const blocks = await getBlockedSlots(date);
    const allSlots = generateSlots(date, settings);

    res.json({
      date,
      settings: {
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        lunchStart: settings.lunchStart,
        lunchEnd: settings.lunchEnd,
        slotDuration: settings.slotDuration,
        maxChairs: settings.maxChairs
      },
      slots: allSlots,
      appointments: result.rows,
      blocks
    });
  } catch (err) {
    console.error('calendar error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// GET /api/appointments
// =============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { date, patient_id, status } = req.query;
    let query = `
      SELECT a.*, p.name AS patient_name, p.name_kana, p.phone
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (date)       { params.push(date);       query += ` AND a.appointment_date = $${params.length}`; }
    if (patient_id) { params.push(patient_id); query += ` AND a.patient_id = $${params.length}`; }
    if (status)     { params.push(status);     query += ` AND a.status = $${params.length}`; }

    query += ' ORDER BY a.appointment_date, a.time_slot';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// POST /api/appointments
// =============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      patient_id, appointment_date, time_slot, duration_minutes,
      treatment_type, treatment_color, chair_number, doctor_name, notes
    } = req.body;

    const conflict = await pool.query(`
      SELECT id FROM appointments
      WHERE appointment_date = $1
        AND time_slot = $2
        AND chair_number = $3
        AND status != 'cancelled'
    `, [appointment_date, time_slot, chair_number]);

    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: '指定の時間・チェアはすでに予約済みです' });
    }

    const result = await pool.query(`
      INSERT INTO appointments
        (patient_id, appointment_date, time_slot, duration_minutes,
         treatment_type, treatment_color, chair_number, doctor_name, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed')
      RETURNING *
    `, [patient_id, appointment_date, time_slot,
        duration_minutes || 30, treatment_type, treatment_color,
        chair_number || 1, doctor_name, notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST appointment error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// PUT /api/appointments/:id
// =============================================
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      appointment_date, time_slot, duration_minutes,
      treatment_type, treatment_color, chair_number,
      doctor_name, notes, status
    } = req.body;

    if (appointment_date && time_slot && chair_number) {
      const conflict = await pool.query(`
        SELECT id FROM appointments
        WHERE appointment_date = $1
          AND time_slot = $2
          AND chair_number = $3
          AND id != $4
          AND status != 'cancelled'
      `, [appointment_date, time_slot, chair_number, id]);

      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: '移動先はすでに予約済みです' });
      }
    }

    const result = await pool.query(`
      UPDATE appointments SET
        appointment_date = COALESCE($1, appointment_date),
        time_slot        = COALESCE($2, time_slot),
        duration_minutes = COALESCE($3, duration_minutes),
        treatment_type   = COALESCE($4, treatment_type),
        treatment_color  = COALESCE($5, treatment_color),
        chair_number     = COALESCE($6, chair_number),
        doctor_name      = COALESCE($7, doctor_name),
        notes            = COALESCE($8, notes),
        status           = COALESCE($9, status),
        updated_at       = NOW()
      WHERE id = $10
      RETURNING *
    `, [appointment_date, time_slot, duration_minutes, treatment_type,
        treatment_color, chair_number, doctor_name, notes, status, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: '予約が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT appointment error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// DELETE /api/appointments/:id
// =============================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE appointments SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [id]
    );
    res.json({ message: 'キャンセルしました' });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
