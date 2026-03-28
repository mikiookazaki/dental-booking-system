// ============================================================
// routes/chairs.js （Supabase移行版）
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
      .from('chairs')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    res.json({ chairs: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, line_bookable, note } = req.body;
  try {
    const { data, error } = await supabase
      .from('chairs')
      .update({ name, line_bookable, note })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ chair: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
