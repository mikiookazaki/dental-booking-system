// backend/src/routes/followupMessages.js
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.use(requireAuth);
router.use(requireAdmin);

// GET /api/followup-messages
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clinic_settings')
      .select('key, value')
      .or('key.like.followup_msg_%,key.eq.followup_timing');

    if (error) throw error;

    const messages = {};
    let timing = { same_day_time: '18:00', follow_days: 3, follow_time: '09:00' };

    (data || []).forEach(row => {
      if (row.key === 'followup_timing') {
        try { timing = JSON.parse(row.value) } catch {}
      } else {
        const match = row.key.match(/^followup_msg_(\d+)$/);
        if (match) {
          try { messages[parseInt(match[1])] = JSON.parse(row.value) } catch {}
        }
      }
    });

    res.json({ messages, timing });
  } catch (err) {
    console.error('followup-messages GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/followup-messages
router.post('/', async (req, res) => {
  const { messages, timing } = req.body;

  try {
    // メッセージ保存
    if (messages && typeof messages === 'object') {
      for (const [treatmentId, msg] of Object.entries(messages)) {
        const key   = `followup_msg_${treatmentId}`;
        const value = JSON.stringify(msg);
        await supabase
          .from('clinic_settings')
          .upsert(
            { key, value, description: `治療後フォローメッセージ (治療ID: ${treatmentId})` },
            { onConflict: 'key' }
          );
      }
    }

    // タイミング設定保存
    if (timing && typeof timing === 'object') {
      await supabase
        .from('clinic_settings')
        .upsert(
          { key: 'followup_timing', value: JSON.stringify(timing), description: '治療後フォロー送信タイミング設定' },
          { onConflict: 'key' }
        );
    }

    res.json({ success: true, message: '保存しました' });
  } catch (err) {
    console.error('followup-messages POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
