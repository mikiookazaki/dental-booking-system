// backend/src/routes/admin.js （Supabase移行版）
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================
// GET /api/admin/export/csv
// ============================================================
router.get('/export/csv', async (req, res) => {
  const { month, type = 'appointments', token } = req.query;
  if (!month) return res.status(400).json({ error: 'month パラメータが必要です' });

  const authToken = token || (req.headers.authorization?.replace('Bearer ', ''));
  if (!authToken) return res.status(401).json({ error: '認証が必要です' });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: '管理者権限が必要です' });
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }

  try {
    let rows, headers, filename;
    const monthStart = `${month}-01`;
    const monthEnd   = `${month}-31`;

    if (type === 'appointments') {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, start_time, end_time, status, source,
          cancel_reason, cancelled_by, cancelled_at, created_at,
          patients(patient_code, name, phone),
          staff(name, role),
          chairs(name),
          treatments(name, duration, price)
        `)
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd)
        .order('appointment_date')
        .order('start_time');

      if (error) throw error;

      headers = ['ID','日付','開始','終了','ステータス','予約元','患者番号','患者名','電話','担当者','役職','チェア','治療名','所要時間(分)','料金','キャンセル理由','キャンセル者','キャンセル日時','作成日時'];
      rows = data.map(a => ({
        id:              a.id,
        appointment_date: a.appointment_date,
        start_time:      a.start_time,
        end_time:        a.end_time,
        status:          a.status,
        source:          a.source,
        patient_code:    a.patients?.patient_code,
        patient_name:    a.patients?.name,
        patient_phone:   a.patients?.phone,
        staff_name:      a.staff?.name,
        staff_role:      a.staff?.role,
        chair_name:      a.chairs?.name,
        treatment_name:  a.treatments?.name,
        duration:        a.treatments?.duration,
        price:           a.treatments?.price,
        cancel_reason:   a.cancel_reason,
        cancelled_by:    a.cancelled_by,
        cancelled_at:    a.cancelled_at,
        created_at:      a.created_at,
      }));
      filename = `appointments_${month}.csv`;

    } else if (type === 'patients') {
      const { data, error } = await supabase
        .from('patients')
        .select('patient_code, name, name_kana, birth_date, gender, phone, email, first_visit, last_visit, total_visits, line_user_id, data_source, created_at')
        .eq('is_active', true)
        .order('patient_code');

      if (error) throw error;

      headers = ['患者番号','氏名','カナ','生年月日','性別','電話','メール','初診日','最終来院','来院回数','LINE連携','データソース','登録日'];
      rows = data.map(p => ({ ...p, line_user_id: p.line_user_id ? 'あり' : 'なし' }));
      filename = `patients_${month}.csv`;
    }

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

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(BOM + csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireAuth);
router.use(requireAdmin);

// ============================================================
// GET /api/admin/settings
// ============================================================
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clinic_settings')
      .select('key, value, description')
      .order('id');

    if (error) throw error;

    const settings = {};
    data.forEach(r => { settings[r.key] = { value: r.value, description: r.description }; });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUT /api/admin/settings
// ============================================================
router.put('/settings', async (req, res) => {
  const { updates } = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates オブジェクトが必要です' });
  }
  try {
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await supabase
        .from('clinic_settings')
        .update({ value: String(value), updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    }
    res.json({ message: '設定を更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/blocked-slots
// ============================================================
router.get('/blocked-slots', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*, blocked_slot_chairs(chair_id)')
      .gte('block_date', today)
      .order('block_date')
      .order('start_time');

    if (error) throw error;

    const result = data.map(bs => ({
      ...bs,
      chair_ids: bs.blocked_slot_chairs?.map(c => c.chair_id) || [],
      blocked_slot_chairs: undefined,
    }));

    res.json({ blocked_slots: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/blocked-slots
// ============================================================
router.post('/blocked-slots', async (req, res) => {
  const { block_date, start_time, end_time, affects_all, reason, chair_ids } = req.body;
  if (!block_date || !reason) {
    return res.status(400).json({ error: 'block_date と reason は必須です' });
  }
  try {
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({
        block_date,
        start_time: start_time || null,
        end_time:   end_time   || null,
        affects_all: affects_all ?? true,
        reason,
        created_by: req.admin?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (!affects_all && chair_ids?.length) {
      const assignments = chair_ids.map(cid => ({ blocked_slot_id: data.id, chair_id: cid }));
      const { error: chairError } = await supabase
        .from('blocked_slot_chairs')
        .insert(assignments);
      if (chairError) throw chairError;
    }

    res.status(201).json({ message: 'ブロックを追加しました', id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE /api/admin/blocked-slots/:id
// ============================================================
router.delete('/blocked-slots/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'ブロックを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/dashboard
// ============================================================
router.get('/dashboard', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month パラメータが必要です' });

  try {
    const monthStart = `${month}-01`;
    const monthEnd   = `${month}-31`;

    const { data: appts, error } = await supabase
      .from('appointments')
      .select(`
        id, status, appointment_date,
        treatments(name, color, duration, price),
        staff(name, role, color),
        chairs(name, display_order)
      `)
      .gte('appointment_date', monthStart)
      .lte('appointment_date', monthEnd);

    if (error) throw error;

    // サマリー
    const summary = {
      confirmed: appts.filter(a => a.status === 'confirmed').length,
      completed: appts.filter(a => a.status === 'completed').length,
      cancelled: appts.filter(a => a.status === 'cancelled').length,
      no_show:   appts.filter(a => a.status === 'no_show').length,
      total:     appts.length,
    };

    // 治療別集計
    const treatMap = {};
    appts.filter(a => ['confirmed','completed'].includes(a.status)).forEach(a => {
      const name  = a.treatments?.name  || '不明';
      const color = a.treatments?.color || '#dbeafe';
      if (!treatMap[name]) treatMap[name] = { name, color, count: 0, total_minutes: 0 };
      treatMap[name].count++;
      treatMap[name].total_minutes += a.treatments?.duration || 0;
    });
    const byTreatment = Object.values(treatMap).sort((a, b) => b.count - a.count);

    // スタッフ別集計
    const staffMap = {};
    appts.forEach(a => {
      const name = a.staff?.name || '不明';
      if (!staffMap[name]) staffMap[name] = { name, role: a.staff?.role, color: a.staff?.color, count: 0, cancelled: 0, total_minutes: 0 };
      if (['confirmed','completed'].includes(a.status)) {
        staffMap[name].count++;
        staffMap[name].total_minutes += a.treatments?.duration || 0;
      }
      if (a.status === 'cancelled') staffMap[name].cancelled++;
    });
    const byStaff = Object.values(staffMap).sort((a, b) => b.count - a.count);

    // チェア別集計
    const chairMap = {};
    appts.filter(a => ['confirmed','completed'].includes(a.status)).forEach(a => {
      const name = a.chairs?.name || '不明';
      if (!chairMap[name]) chairMap[name] = { name, count: 0, total_minutes: 0 };
      chairMap[name].count++;
      chairMap[name].total_minutes += a.treatments?.duration || 0;
    });
    const byChair = Object.values(chairMap);

    // 日別集計
    const dayMap = {};
    appts.forEach(a => {
      const date = a.appointment_date;
      if (!dayMap[date]) dayMap[date] = { date, count: 0, cancelled: 0 };
      if (['confirmed','completed'].includes(a.status)) dayMap[date].count++;
      if (a.status === 'cancelled') dayMap[date].cancelled++;
    });
    const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ month, summary, byTreatment, byStaff, byChair, byDay });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
