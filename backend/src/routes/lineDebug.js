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

// ============================================================
// POST /api/line-debug/send-reminder
// 特定患者にリマインダーをシミュレーション送信（チャットに表示）
// ============================================================
router.post('/send-reminder', async (req, res) => {
  const { type, patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: '患者IDが必要です' });

  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, name, line_user_id, birth_date')
      .eq('id', patientId)
      .single();

    if (!patient) return res.status(404).json({ error: '患者が見つかりません' });

    const messages = [];

    if (type === 'appointment' || type === 'same_day') {
      const isToday = type === 'same_day';
      messages.push({
        type: 'flex',
        altText: `${patient.name}様への${isToday ? '当日' : '前日'}リマインダー`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box', layout: 'vertical',
            backgroundColor: '#2563eb', paddingAll: '14px',
            contents: [{ type: 'text', text: `${isToday ? '本日' : '明日'}のご予約リマインダー`, color: '#fff', size: 'sm', weight: 'bold' }],
          },
          body: {
            type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
            contents: [
              { type: 'text', text: `${patient.name} 様`, size: 'sm', weight: 'bold', color: '#1f2937' },
              { type: 'separator', margin: 'sm' },
              { type: 'text', text: `${isToday ? '本日' : '明日'} 10:00〜\nクリーニング(PMTC)\nスマイル歯科`, size: 'sm', color: '#374151', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '10px',
            contents: [{ type: 'text', text: 'スマイル歯科', size: 'xs', color: '#9ca3af', align: 'center' }],
          },
        },
      });
    } else if (type === 'recall') {
      messages.push({ type: 'text', text: `${patient.name} 様\n\n前回の来院から6ヶ月が経過しました。\n定期検診はお済みでしょうか？\n\nお口の健康を守るために、定期的な検診をおすすめします。` });
    } else if (type === 'birthday') {
      messages.push({
        type: 'flex',
        altText: `${patient.name}様、お誕生日おめでとうございます！`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box', layout: 'vertical',
            backgroundColor: '#e11d48', paddingAll: '14px',
            contents: [{ type: 'text', text: '🎂 Happy Birthday!', color: '#fff', size: 'md', weight: 'bold', align: 'center' }],
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
            contents: [
              { type: 'text', text: `${patient.name} 様`, size: 'sm', weight: 'bold', color: '#1f2937', align: 'center' },
              { type: 'text', text: 'お誕生日おめでとうございます！\nスマイル歯科スタッフ一同より、心よりお祝い申し上げます。\n\n素敵な一日をお過ごしください 🎂', size: 'sm', color: '#374151', wrap: true, align: 'center' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '8px',
            contents: [{ type: 'text', text: 'スマイル歯科', size: 'xs', color: '#e11d48', align: 'center' }],
          },
        },
      });
    } else if (type === 'followup_same_day' || type === 'followup_day3') {
      const isDay3 = type === 'followup_day3';
      messages.push({
        type: 'flex',
        altText: `${patient.name}様、治療後フォロー`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box', layout: 'vertical',
            backgroundColor: isDay3 ? '#2563eb' : '#059669', paddingAll: '14px',
            contents: [{ type: 'text', text: isDay3 ? '治療から3日が経ちました' : '本日はご来院ありがとうございました', color: '#fff', size: 'sm', weight: 'bold', wrap: true }],
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
            contents: [
              { type: 'text', text: `${patient.name} 様`, size: 'sm', weight: 'bold', color: '#1f2937' },
              { type: 'separator', margin: 'sm' },
              { type: 'text', text: isDay3 ? 'その後、お口の状態はいかがでしょうか？\n気になる症状があればお気軽にご連絡ください。' : '治療後、痛みや違和感がある場合はお早めにご連絡ください。', size: 'sm', color: '#374151', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', paddingAll: '10px', spacing: 'sm',
            contents: [
              { type: 'button', action: { type: 'uri', label: '次回予約はこちら', uri: 'https://line.me/R/ti/p/@210vmmzk' }, style: 'primary', color: isDay3 ? '#2563eb' : '#059669', height: 'sm' },
              { type: 'text', text: 'スマイル歯科', size: 'xs', color: '#9ca3af', align: 'center' },
            ],
          },
        },
      });
    } else if (type === 'churn') {
      messages.push({ type: 'text', text: `${patient.name} 様\n\nしばらくご来院がないことが気になり、ご連絡いたしました。\nお口の健康のために、ぜひ一度ご来院ください。\n\nご予約はLINEから簡単にできます。お待ちしております。` });
    }

    res.json({ success: true, responses: messages, logs: [{ type: 'push', time: new Date(), messages }] });
  } catch (err) {
    console.error('send-reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/line-debug/push-test
// 実際のLINEにテストメッセージを送信（本番送信）
// ============================================================
router.post('/push-test', async (req, res) => {
  const { patientId, message } = req.body;
  if (!patientId || !message) return res.status(400).json({ error: '患者IDとメッセージが必要です' });

  const { pushMessage } = require('./line');

  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('id, name, line_user_id')
      .eq('id', patientId)
      .single();

    if (!patient?.line_user_id) return res.status(400).json({ error: 'LINE未連携の患者です' });

    await pushMessage(patient.line_user_id, [{ type: 'text', text: `[テスト送信]\n\n${message}` }]);
    res.json({ success: true, message: `${patient.name}様のLINEに送信しました` });
  } catch (err) {
    console.error('push-test error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
