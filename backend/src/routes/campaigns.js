// backend/src/routes/campaigns.js
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { pushMessage } = require('./line');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.use(requireAuth);
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────
// GET /api/campaigns/preview
// 絞り込み条件に合う患者数・一覧を返す（LINE連携済みのみ）
// ─────────────────────────────────────────────────────────
router.get('/preview', async (req, res) => {
  try {
    const { age_groups, gender, last_visit_before, last_visit_after, min_visits, max_visits, is_test } = req.query;
    const isTest = is_test === 'true';

    let query = supabase
      .from('patients')
      .select('id, name, age_group, gender, last_visit_date, total_visits, line_user_id')
      .eq('is_active', true)
      .eq('is_test', isTest)
      .not('line_user_id', 'is', null);

    if (age_groups) {
      const groups = age_groups.split(',').filter(Boolean);
      if (groups.length > 0) query = query.in('age_group', groups);
    }
    if (gender && gender !== 'all') {
      query = query.eq('gender', gender);
    }
    if (last_visit_before) {
      query = query.lte('last_visit_date', last_visit_before);
    }
    if (last_visit_after) {
      query = query.gte('last_visit_date', last_visit_after);
    }
    if (min_visits) {
      query = query.gte('total_visits', parseInt(min_visits));
    }
    if (max_visits) {
      query = query.lte('total_visits', parseInt(max_visits));
    }

    const { data, error } = await query.order('name').limit(200);
    if (error) throw error;

    res.json({ count: data.length, patients: data });
  } catch (err) {
    console.error('campaign preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/campaigns/send
// キャンペーンメッセージを一斉送信
// ─────────────────────────────────────────────────────────
router.post('/send', async (req, res) => {
  const { patient_ids, message_text, image_url, campaign_name, is_test } = req.body;

  if (!patient_ids?.length) {
    return res.status(400).json({ error: '送信対象の患者が指定されていません' });
  }
  if (!message_text?.trim()) {
    return res.status(400).json({ error: 'メッセージ本文は必須です' });
  }

  const isTest = is_test === true;
  const results = { sent: 0, failed: 0, errors: [] };

  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, line_user_id')
      .in('id', patient_ids)
      .eq('is_test', isTest)
      .not('line_user_id', 'is', null);

    if (error) throw error;

    for (const patient of patients) {
      try {
        const messages = buildCampaignMessage(message_text, image_url, patient.name);
        await pushMessage(patient.line_user_id, messages);

        await supabase.from('reminder_logs').insert({
          patient_id:    patient.id,
          reminder_type: 'campaign',
          status:        'sent',
          error_message: campaign_name || 'キャンペーン配信',
        });
        results.sent++;
      } catch (err) {
        await supabase.from('reminder_logs').insert({
          patient_id:    patient.id,
          reminder_type: 'campaign',
          status:        'failed',
          error_message: err.message,
        });
        results.failed++;
        results.errors.push({ patient: patient.name, error: err.message });
      }

      // LINE APIレート制限対策（1秒に最大25件）
      await new Promise(r => setTimeout(r, 50));
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('campaign send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/campaigns/logs
// キャンペーン送信履歴
// ─────────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const isTest = req.isTestMode;

    const { data: patientIds } = await supabase
      .from('patients')
      .select('id')
      .eq('is_test', isTest)
      .eq('is_active', true);

    const ids = (patientIds || []).map(p => p.id);
    if (!ids.length) return res.json([]);

    const { data, error } = await supabase
      .from('reminder_logs')
      .select('*, patients(name)')
      .eq('reminder_type', 'campaign')
      .in('patient_id', ids)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('campaign logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// LINEメッセージ構築
// ─────────────────────────────────────────────────────────
function buildCampaignMessage(text, imageUrl, patientName) {
  const messages = [];

  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl:    imageUrl,
    });
  }

  messages.push({
    type: 'flex',
    altText: text.slice(0, 60),
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#2563eb',
        contents: [{
          type: 'text', text: 'スマイル歯科からのお知らせ',
          color: '#ffffff', size: 'sm', weight: 'bold',
        }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `${patientName} 様`,
            size: 'sm', weight: 'bold', color: '#1f2937',
          },
          { type: 'separator', margin: 'sm' },
          {
            type: 'text',
            text: text,
            size: 'sm', color: '#374151', wrap: true,
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'text',
          text: 'スマイル歯科',
          size: 'xs', color: '#9ca3af', align: 'center',
        }],
      },
    },
  });

  return messages;
}

module.exports = router;
