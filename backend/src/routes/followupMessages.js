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
// 治療別フォローアップメッセージ設定を取得
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clinic_settings')
      .select('key, value')
      .like('key', 'followup_msg_%');

    if (error) throw error;

    const messages = {};
    (data || []).forEach(row => {
      // key形式: followup_msg_{treatmentId}
      const match = row.key.match(/^followup_msg_(\d+)$/);
      if (match) {
        try {
          messages[parseInt(match[1])] = JSON.parse(row.value);
        } catch {}
      }
    });

    res.json({ messages });
  } catch (err) {
    console.error('followup-messages GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/followup-messages
// 治療別フォローアップメッセージ設定を保存
router.post('/', async (req, res) => {
  const { messages } = req.body;
  if (!messages || typeof messages !== 'object') {
    return res.status(400).json({ error: 'messages オブジェクトが必要です' });
  }

  try {
    for (const [treatmentId, msg] of Object.entries(messages)) {
      const key   = `followup_msg_${treatmentId}`;
      const value = JSON.stringify(msg);

      const { error } = await supabase
        .from('clinic_settings')
        .upsert(
          { key, value, description: `治療後フォローメッセージ (治療ID: ${treatmentId})` },
          { onConflict: 'key' }
        );

      if (error) throw error;
    }

    res.json({ success: true, message: '保存しました' });
  } catch (err) {
    console.error('followup-messages POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
