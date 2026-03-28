// backend/src/routes/lineDebug.js
// LINEデバッグ用API（superadmin専用）
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
// ============================================================
router.get('/patients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, name_kana, patient_code, line_user_id, age_group, phone')
      .eq('is_active', true)
      .order('id')
      .limit(30);

    if (error) throw error;
    res.json({ patients: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/line-debug/simulate
// productionMode: true の場合は実際にDBに保存する
// ============================================================
router.post('/simulate', async (req, res) => {
  const { type = 'message', text, patientId, productionMode = false } = req.body;

  let lineUserId = `debug_user_${Date.now()}`;
  let debugPatient = null;

  if (patientId) {
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patient) {
      debugPatient = patient;
      lineUserId = patient.line_user_id || `debug_${patient.id}`;
    }
  }

  const responses = [];
  const logs = [];

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
        message: { type: 'text', text },
        source: { userId: lineUserId },
        replyToken: 'debug_token',
        _debugPatient: debugPatient,
        _productionMode: productionMode, // 本番モードフラグ
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

  let lineUserId = `debug_user_${Date.now()}`;
  let debugPatient = null;

  if (patientId) {
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patient) {
      debugPatient = patient;
      lineUserId = patient.line_user_id || `debug_${patient.id}`;
    }
  }

  const responses = [];
  const logs = [];

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
        type: 'postback',
        postback: { data: postbackData },
        source: { userId: lineUserId },
        replyToken: 'debug_token',
        _debugPatient: debugPatient,
        _productionMode: productionMode,
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
