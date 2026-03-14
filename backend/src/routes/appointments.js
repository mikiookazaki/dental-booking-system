// routes/appointments.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// =============================================
// DB設定値から動的に空き枠を計算するヘルパー
// ※ 既存スキーマ: clinic_settings テーブル使用
// =============================================
async function getClinicSettings() {
  const result = await pool.query(`
    SELECT key, value FROM clinic_settings
    WHERE key IN (
      'open_days', 'open_time', 'close_time',
      'lunch_start', 'lunch_end', 'slot_minutes',
      'can_patient_book'
    )
  `);
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });

  return {
    openDays:     JSON.parse(settings.open_days || '[1,2,3,4,5,6]'),
    openTime:     settings.open_time   || '09:00',
    closeTime:    settings.close_time  || '18:30',
    lunchStart:   settings.lunch_start || '13:00',
    lunchEnd:     settings.lunch_end   || '14:00',
    slotDuration: parseInt(settings.slot_minutes || '30'),
    patientBookingEnabled: settings.can_patient_book !== 'false'
  };
}

function isOpenDay(dateStr, openDays) {
  const dow = new Date(dateStr).getDay();
  return openDays.includes(dow);
}

function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.toString().substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function generateSlots(settings) {
  const { openTime, closeTime, lunchStart, lunchEnd, slotDuration } = settings;
  const slots = [];
  let cur = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const ls  = toMinutes(lunchStart);
  const le  = toMinutes(lunchEnd);

  while (cur + slotDuration <= end) {
    if (!(cur >= ls && cur < le)) {
      slots.push(toTimeStr(cur));
    }
    cur += slotDuration;
  }
  return slots;
}

async function getChairs() {
  const result = await pool.query(
    `SELECT id, name FROM chairs WHERE is_active = TRUE ORDER BY display_order`
  );
  return result.rows;
}

async function getBookedSlots(dateStr) {
  const result = await pool.query(`
    SELECT
      a.id,
      a.patient_id,
      a.staff_id,
      a.chair_id,
      a.treatment_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      a.status,
      a.notes,
      p.name        AS patient_name,
      p.name_kana,
      c.name        AS chair_name,
      s.name        AS doctor_name,
      t.name        AS treatment_type,
      COALESCE(t.color, '#dbeafe') AS treatment_color
    FROM appointments a
    LEFT JOIN patients   p ON a.patient_id   = p.id
    LEFT JOIN chairs     c ON a.chair_id     = c.id
    LEFT JOIN staff      s ON a.staff_id     = s.id
    LEFT JOIN treatments t ON a.treatment_id = t.id
    WHERE a.appointment_date = $1
      AND a.status != 'cancelled'
    ORDER BY a.start_time, a.chair_id
  `, [dateStr]);
  return result.rows;
}

async function getBlockedSlots(dateStr) {
  const result = await pool.query(`
    SELECT id, block_date, start_time, end_time, affects_all, reason
    FROM blocked_slots
    WHERE block_date = $1
  `, [dateStr]);
  return result.rows;
}

// =============================================
// GET /api/appointments/available-slots/:date
// =============================================
router.get('/available-slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const settings  = await getClinicSettings();
    const chairs    = await getChairs();
    const maxChairs = chairs.length;

    if (!isOpenDay(date, settings.openDays)) {
      return res.json({ available: false, reason: 'closed', slots: [] });
    }

    const blocks       = await getBlockedSlots(date);
    const fullDayBlock = blocks.find(b => b.affects_all && !b.start_time);
    if (fullDayBlock) {
      return res.json({ available: false, reason: 'blocked', reason_text: fullDayBlock.reason, slots: [] });
    }

    const allSlots = generateSlots(settings);
    const booked   = await getBookedSlots(date);

    const slotDetails = allSlots.map(slot => {
      const slotMin    = toMinutes(slot);
      const slotEndMin = slotMin + settings.slotDuration;

      const isBlocked = blocks.some(b => {
        if (!b.start_time) return false;
        const bs = toMinutes(b.start_time);
        const be = toMinutes(b.end_time);
        return slotMin < be && slotEndMin > bs;
      });

      const bookedCount = booked.filter(b => {
        const bStart = toMinutes(b.start_time);
        const bEnd   = toMinutes(b.end_time);
        return bStart < slotEndMin && bEnd > slotMin;
      }).length;

      return {
        time:            slot,
        available:       !isBlocked && (maxChairs - bookedCount) > 0,
        availableChairs: isBlocked ? 0 : Math.max(0, maxChairs - bookedCount),
        bookedCount,
        isBlocked
      };
    });

    res.json({ date, available: true, slotDuration: settings.slotDuration, maxChairs, slots: slotDetails });
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
    const settings  = await getClinicSettings();
    const chairs    = await getChairs();
    const maxChairs = chairs.length;

    const daysInMonth    = new Date(year, month, 0).getDate();
    const availableDates = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const today   = new Date().toISOString().split('T')[0];
      if (dateStr < today) continue;
      if (!isOpenDay(dateStr, settings.openDays)) continue;

      const blocks = await getBlockedSlots(dateStr);
      if (blocks.find(b => b.affects_all && !b.start_time)) continue;

      const booked   = await getBookedSlots(dateStr);
      const allSlots = generateSlots(settings);

      const hasAvailable = allSlots.some(slot => {
        const slotMin    = toMinutes(slot);
        const slotEndMin = slotMin + settings.slotDuration;
        const bookedCount = booked.filter(b => {
          const bStart = toMinutes(b.start_time);
          const bEnd   = toMinutes(b.end_time);
          return bStart < slotEndMin && bEnd > slotMin;
        }).length;
        return bookedCount < maxChairs;
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
    const { date }   = req.params;
    const settings   = await getClinicSettings();
    const chairs     = await getChairs();
    const booked     = await getBookedSlots(date);
    const blocks     = await getBlockedSlots(date);
    const allSlots   = generateSlots(settings);

    res.json({
      date,
      settings: {
        openTime:     settings.openTime,
        closeTime:    settings.closeTime,
        lunchStart:   settings.lunchStart,
        lunchEnd:     settings.lunchEnd,
        slotDuration: settings.slotDuration,
        maxChairs:    chairs.length
      },
      chairs,
      slots:        allSlots,
      appointments: booked,
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
      SELECT a.*, p.name AS patient_name, p.name_kana, p.phone,
             c.name AS chair_name, s.name AS doctor_name,
             t.name AS treatment_type, t.color AS treatment_color
      FROM appointments a
      LEFT JOIN patients   p ON a.patient_id   = p.id
      LEFT JOIN chairs     c ON a.chair_id     = c.id
      LEFT JOIN staff      s ON a.staff_id     = s.id
      LEFT JOIN treatments t ON a.treatment_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (date)       { params.push(date);       query += ` AND a.appointment_date = $${params.length}`; }
    if (patient_id) { params.push(patient_id); query += ` AND a.patient_id = $${params.length}`; }
    if (status)     { params.push(status);     query += ` AND a.status = $${params.length}`; }
    query += ' ORDER BY a.appointment_date, a.start_time';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET appointments error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// POST /api/appointments
// =============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { patient_id, appointment_date, start_time, end_time,
            treatment_id, chair_id, staff_id, notes, source } = req.body;

    const conflict = await pool.query(`
      SELECT id FROM appointments
      WHERE appointment_date = $1 AND chair_id = $2
        AND status != 'cancelled'
        AND start_time < $3 AND end_time > $4
    `, [appointment_date, chair_id, end_time, start_time]);

    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: '指定の時間・チェアはすでに予約済みです' });
    }

    const result = await pool.query(`
      INSERT INTO appointments
        (patient_id, appointment_date, start_time, end_time,
         treatment_id, chair_id, staff_id, notes, source, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed')
      RETURNING *
    `, [patient_id, appointment_date, start_time, end_time,
        treatment_id, chair_id, staff_id, notes, source || 'staff']);

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
    const { appointment_date, start_time, end_time,
            treatment_id, chair_id, staff_id, notes, status } = req.body;

    if (appointment_date && start_time && end_time && chair_id) {
      const conflict = await pool.query(`
        SELECT id FROM appointments
        WHERE appointment_date = $1 AND chair_id = $2 AND id != $3
          AND status != 'cancelled'
          AND start_time < $4 AND end_time > $5
      `, [appointment_date, chair_id, id, end_time, start_time]);

      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: '移動先はすでに予約済みです' });
      }
    }

    const result = await pool.query(`
      UPDATE appointments SET
        appointment_date = COALESCE($1, appointment_date),
        start_time       = COALESCE($2, start_time),
        end_time         = COALESCE($3, end_time),
        treatment_id     = COALESCE($4, treatment_id),
        chair_id         = COALESCE($5, chair_id),
        staff_id         = COALESCE($6, staff_id),
        notes            = COALESCE($7, notes),
        status           = COALESCE($8, status),
        updated_at       = NOW()
      WHERE id = $9
      RETURNING *
    `, [appointment_date, start_time, end_time,
        treatment_id, chair_id, staff_id, notes, status, id]);

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
      `UPDATE appointments SET status='cancelled', cancelled_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [id]
    );
    res.json({ message: 'キャンセルしました' });
  } catch (err) {
    console.error('DELETE appointment error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
