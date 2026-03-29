// backend/src/routes/lineDebug.js
const express = require('express');
const router  = express.Router();
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.use(requireAuth);
router.use(requireSuperAdmin);

// ============================================================
// GET /api/line-debug/patients
// テストモードON → テスト患者、OFF → 本番患者
// ============================================================
router.get('/patients', async (req, res) => {
  try {
    const isTest = req.isTestMode;
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, name_kana, patient_code, line_user_id, age_group, phone, is_test')
      .eq('is_active', true)
      .eq('is_test', isTest)
      .order('id')
      .limit(50);

    if (error) throw error;
    res.json({ patients: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/line-debug/simulate
// ============================================================
router.post('/simulate', async (req, res) => {
  const { type = 'message', text, patientId, productionMode = false } = req.body;

  let lineUserId   = `debug_user_${Date.now()}`;
  let debugPatient = null;

  if (patientId) {
    const { data: patient } = await supabase
      .from('patients').select('*').eq('id', patientId).single();
    if (patient) {
      debugPatient = patient;
      lineUserId   = patient.line_user_id || `debug_${patient.id}`;
    }
  }

  const responses = [];
  const logs      = [];

  async function mockReply(replyToken, messages) {
    logs.push({ type: 'reply', time: new Date().toISOString(), messages });
    responses.push(...messages);
  }
  async function mockPush(userId, messages) {
    logs.push({ type: 'push', time: new Date().toISOString(), userId, messages });
    responses.push(...messages);
  }

  try {
    const lineModule = require('./line');
    if (typeof lineModule.handleEventDebug !== 'function') {
      return res.status(500).json({ error: 'handleEventDebugが未定義です。' });
    }
    await lineModule.handleEventDebug(
      {
        type,
        message:         { type: 'text', text },
        source:          { userId: lineUserId },
        replyToken:      'debug_token',
        _debugPatient:   debugPatient,
        _productionMode: productionMode,
        _isTestMode:     req.isTestMode,
      },
      mockReply,
      mockPush
    );
    res.json({ responses, logs, lineUserId, productionMode });
  } catch (err) {
    console.error('simulate error:', err);
    res.status(500).json({ error: err.message, logs });
  }
});

// ============================================================
// POST /api/line-debug/postback
// ============================================================
router.post('/postback', async (req, res) => {
  const { data: postbackData, patientId, productionMode = false } = req.body;

  let lineUserId   = `debug_user_${Date.now()}`;
  let debugPatient = null;

  if (patientId) {
    const { data: patient } = await supabase
      .from('patients').select('*').eq('id', patientId).single();
    if (patient) {
      debugPatient = patient;
      lineUserId   = patient.line_user_id || `debug_${patient.id}`;
    }
  }

  const responses = [];
  const logs      = [];

  async function mockReply(replyToken, messages) {
    logs.push({ type: 'reply', time: new Date().toISOString(), messages });
    responses.push(...messages);
  }
  async function mockPush(userId, messages) {
    logs.push({ type: 'push', time: new Date().toISOString(), userId, messages });
    responses.push(...messages);
  }

  // restart は lineDebug 側で直接処理（治療メニュー選択に戻る）
  const params = new URLSearchParams(postbackData || '');
  if (params.get('action') === 'restart') {
    try {
      const { data: treatments } = await supabase
        .from('treatments')
        .select('*')
        .eq('is_active', true)
        .eq('line_visible', true)
        .order('display_order');

      if (!treatments?.length) {
        responses.push({ type: 'text', text: '現在予約できる治療メニューがありません。' });
      } else {
        responses.push({
          type: 'template',
          altText: '治療メニューを選択してください',
          template: {
            type: 'carousel',
            columns: treatments.slice(0, 10).map(t => ({
              title: t.name.substring(0, 40),
              text:  `所要時間: ${t.duration}分`,
              actions: [{
                type:  'postback',
                label: '選択する',
                data:  `action=select_treatment&treatment_id=${t.id}&ts=${Date.now()}`,
              }],
            })),
          },
        });
      }
      logs.push({ type: 'reply', time: new Date().toISOString(), messages: responses });
      return res.json({ responses, logs, lineUserId, productionMode });
    } catch (err) {
      return res.status(500).json({ error: err.message, logs });
    }
  }

  try {
    const lineModule = require('./line');
    if (typeof lineModule.handleEventDebug !== 'function') {
      return res.status(500).json({ error: 'handleEventDebugが未定義です。' });
    }
    await lineModule.handleEventDebug(
      {
        type:            'postback',
        postback:        { data: postbackData },
        source:          { userId: lineUserId },
        replyToken:      'debug_token',
        _debugPatient:   debugPatient,
        _productionMode: productionMode,
        _isTestMode:     req.isTestMode,
      },
      mockReply,
      mockPush
    );
    res.json({ responses, logs, lineUserId, productionMode });
  } catch (err) {
    res.status(500).json({ error: err.message, logs });
  }
});

// ============================================================
// DELETE /api/line-debug/test-appointments
// デバッグで作成したテスト予約を削除
// ============================================================
router.delete('/test-appointments', async (req, res) => {
  try {
    const { patientId } = req.query;
    let query = supabase
      .from('appointments')
      .delete()
      .eq('source', 'line_debug');

    if (patientId) query = query.eq('patient_id', patientId);

    const { data, error } = await query.select();
    if (error) throw error;
    res.json({ message: `${data.length}件のテスト予約を削除しました` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;