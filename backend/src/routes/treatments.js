// ============================================================
// routes/treatments.js （Supabase移行版）
// ============================================================
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .order('display_order')
      .order('id');

    if (error) throw error;
    res.json({ treatments: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, name_en, duration, category, assignable_roles, price, color, line_visible } = req.body;
  try {
    const { data, error } = await supabase
      .from('treatments')
      .insert({ name, name_en, duration, category, assignable_roles, price, color, line_visible })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ treatment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, name_en, duration, category, assignable_roles, price, color, is_active, line_visible } = req.body;
  try {
    const { data, error } = await supabase
      .from('treatments')
      .update({ name, name_en, duration, category, assignable_roles, price, color, is_active, line_visible })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ treatment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
