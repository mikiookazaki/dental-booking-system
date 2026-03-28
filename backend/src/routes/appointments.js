// routes/appointments.js （Supabase移行版）
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// chairs と treatments はまだRender側を使用
const pool = require('../config/database');

// =============================================
// ヘルパー関数
// =============================================
async function getClinicSettings() {
  const { data, error } = await supabase
    .from('clinic_settings')
    .select('key, value')
    .in('key', [
      'open_days', 'open_time', 'close_time',
      'lunch_start', 'lunch_end', 'slot_minutes',
      'can_patient_book',
      'calendar_display_start', 'calendar_display_end',
      'custom_hours_0','custom_hours_1','custom_hours_2','custom_hours_3',
      'custom_hours_4','custom_hours_5','custom_hours_6'
    ]);

  if (error) throw error;

  const settings = {};
  data.forEach(r => { settings[r.key] = r.value; });

  return {
    openDays:     JSON.parse(settings.open_days || '[1,2,3,4,5,6]'),
    openTime:     settings.open_time   || '09:00',
    closeTime:    settings.close_time  || '18:30',
    lunchStart:   settings.lunch_start || '13:00',
    lunchEnd:     settings.lunch_end   || '14:00',
    slotDuration: parseInt(settings.slot_minutes || '30'),
    patientBookingEnabled: settings.can_patient_book !== 'false',
    displayStart: settings.calendar_display_start || null,
    displayEnd:   settings.calendar_display_end   || null,
    customHours: {
      0: settings.custom_hours_0 || null,
      1: settings.custom_hours_1 || null,
      2: settings.custom_hours_2 || null,
      3: settings.custom_hours_3 || null,
      4: settings.custom_hours_4 || null,
      5: settings.custom_hours_5 || null,
      6: settings.custom_hours_6 || null,
    },
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
    if (!(cur >= ls && cur < le)) slots.push(toTimeStr(cur));
    cur += slotDuration;
  }
  return slots;
}

async function getChairs() {
  const result = await pool.query(
    'SELECT id, name FROM chairs WHERE is_active = TRUE ORDER BY display_order'
  );
  return result.rows;
}

async function getBookedSlots(dateStr) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, patient_id, staff_id, chair_id, treatment_id,
      appointment_date, start_time, end_time, status, notes,
      patients(name, name_kana),
      staff(name)
    `)
    .eq('appointment_date', dateStr)
    .neq('status', 'cancelled')
    .order('start_time');

  if (error) throw error;

  // chairs と treatments はRender側から取得
  const chairs = await pool.query('SELECT id, name FROM chairs');
  const treatments = await pool.query('SELECT id, name, color FROM treatments');
  const chairMap = Object.fromEntries(chairs.rows.map(c => [c.id, c.name]));
  const treatMap = Object.fromEntries(treatments.rows.map(t => [t.id, { name: t.name, color: t.color }]));

  return data.map(a => ({
    ...a,
    patient_name:     a.patients?.name,
    name_kana:        a.patients?.name_kana,
    doctor_name:      a.staff?.name,
    chair_name:       chairMap[a.chair_id] || '',
    treatment_type:   treatMap[a.treatment_id]?.name || '',
    treatment_color:  treatMap[a.treatment_id]?.color || '#dbeafe',
    patients:         undefined,
    staff:            undefined,
  }));
}

async function getBlockedSlots(dateStr) {
  const result = await pool.query(
    'SELECT id, block_date, start_time, end_time, affects_all, reason FROM blocked_slots WHERE block_date = $1',
    [dateStr]
  );
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
        maxChairs:    chairs.length,
        displayStart: settings.displayStart || settings.openTime,
        displayEnd:   settings.displayEnd   || settings.closeTime,
        customHours:  settings.customHours,
        openDays:     settings.openDays,
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

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patients(name, name_kana, phone)
      `)
      .order('appointment_date')
      .order('start_time');

    if (date)       query = query.eq('appointment_date', date);
    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status)     query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    // chairs と treatments はRender側から取得
    const chairs = await pool.query('SELECT id, name FROM chairs');
    const treatments = await pool.query('SELECT id, name, color FROM treatments');
    const chairMap = Object.fromEntries(chairs.rows.map(c => [c.id, c.name]));
    const treatMap = Object.fromEntries(treatments.rows.map(t => [t.id, { name: t.name, color: t.color }]));
    const staffRes = await pool.query('SELECT id, name FROM staff');
    const staffMap = Object.fromEntries(staffRes.rows.map(s => [s.id, s.name]));

    const result = data.map(a => ({
      ...a,
      patient_name:    a.patients?.name,
      name_kana:       a.patients?.name_kana,
      phone:           a.patients?.phone,
      chair_name:      chairMap[a.chair_id] || '',
      doctor_name:     staffMap[a.staff_id] || '',
      treatment_type:  treatMap[a.treatment_id]?.name || '',
      treatment_color: treatMap[a.treatment_id]?.color || '#dbeafe',
      patients:        undefined,
    }));

    res.json(result);
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

    // 重複チェック
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('appointment_date', appointment_date)
      .eq('chair_id', chair_id)
      .neq('status', 'cancelled')
      .lt('start_time', end_time)
      .gt('end_time', start_time);

    if (conflict && conflict.length > 0) {
      return res.status(409).json({ error: '指定の時間・チェアはすでに予約済みです' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id, appointment_date, start_time, end_time,
        treatment_id, chair_id, staff_id, notes,
        source: source || 'staff', status: 'confirmed'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
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

    // 重複チェック
    if (appointment_date && start_time && end_time && chair_id) {
      const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', appointment_date)
        .eq('chair_id', chair_id)
        .neq('id', id)
        .neq('status', 'cancelled')
        .lt('start_time', end_time)
        .gt('end_time', start_time);

      if (conflict && conflict.length > 0) {
        return res.status(409).json({ error: '移動先はすでに予約済みです' });
      }
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (appointment_date !== undefined) updateData.appointment_date = appointment_date;
    if (start_time !== undefined)       updateData.start_time       = start_time;
    if (end_time !== undefined)         updateData.end_time         = end_time;
    if (treatment_id !== undefined)     updateData.treatment_id     = treatment_id;
    if (chair_id !== undefined)         updateData.chair_id         = chair_id;
    if (staff_id !== undefined)         updateData.staff_id         = staff_id;
    if (notes !== undefined)            updateData.notes            = notes;
    if (status !== undefined)           updateData.status           = status;

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(404).json({ error: '予約が見つかりません' });
    res.json(data);
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
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'キャンセルしました' });
  } catch (err) {
    console.error('DELETE appointment error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
