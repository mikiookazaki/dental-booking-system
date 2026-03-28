// ============================================================
// routes/staff.js  （Supabase移行版）
// ============================================================
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 全スタッフ取得
router.get('/', async (req, res) => {
  try {
    const { data: staffList, error } = await supabase
      .from('staff')
      .select('*, staff_shifts(*), staff_chair_assignments(chair_id)')
      .order('id');

    if (error) throw error;

    // フロントエンドが期待する形式に変換
    const staff = staffList.map(s => ({
      ...s,
      work_days:   s.staff_shifts?.[0]?.work_days   || [],
      shift_start: s.staff_shifts?.[0]?.start_time  || '09:00',
      shift_end:   s.staff_shifts?.[0]?.end_time    || '18:00',
      break_start: s.staff_shifts?.[0]?.break_start || '13:00',
      break_end:   s.staff_shifts?.[0]?.break_end   || '14:00',
      chair_ids:   s.staff_chair_assignments?.map(a => a.chair_id) || [],
      staff_shifts: undefined,
      staff_chair_assignments: undefined,
    }));

    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// スタッフ1件取得
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Not found' });
    res.json({ staff: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// スタッフ新規作成
router.post('/', async (req, res) => {
  const { name, name_kana, role, title, color, email, phone } = req.body;
  try {
    const { data, error } = await supabase
      .from('staff')
      .insert({ name, name_kana, role, title, color, email, phone })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ staff: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// スタッフ更新
router.put('/:id', async (req, res) => {
  const { name, name_kana, role, title, color, email, phone, is_active } = req.body;
  try {
    const { data, error } = await supabase
      .from('staff')
      .update({ name, name_kana, role, title, color, email, phone, is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ staff: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// シフト更新
router.put('/:id/shift', async (req, res) => {
  const { work_days, start_time, end_time, break_start, break_end, chair_ids } = req.body;
  const staffId = parseInt(req.params.id);
  try {
    // staff_shifts をupsert
    const { error: shiftError } = await supabase
      .from('staff_shifts')
      .upsert({
        staff_id:    staffId,
        work_days,
        start_time,
        end_time,
        break_start,
        break_end,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'staff_id' });

    if (shiftError) throw shiftError;

    // チェア割り当て更新
    if (chair_ids) {
      const { error: delError } = await supabase
        .from('staff_chair_assignments')
        .delete()
        .eq('staff_id', staffId);

      if (delError) throw delError;

      if (chair_ids.length > 0) {
        const assignments = chair_ids.map(cid => ({ staff_id: staffId, chair_id: cid }));
        const { error: insError } = await supabase
          .from('staff_chair_assignments')
          .insert(assignments);
        if (insError) throw insError;
      }
    }

    res.json({ message: 'シフトを更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
