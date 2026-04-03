// backend/src/routes/reminders.js
const express   = require('express');
const router    = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { pushMessage }  = require('./line');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─────────────────────────────────────────────────────────
// ① 予約リマインダー（前日 / 当日）
// ─────────────────────────────────────────────────────────
async function runAppointmentReminders(isTest = false) {
  const now        = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today      = now.toISOString().slice(0, 10);
  const tomorrowDt = new Date(now);
  tomorrowDt.setDate(tomorrowDt.getDate() + 1);
  const tomorrow   = tomorrowDt.toISOString().slice(0, 10);

  const targets = [
    { date: today,    type: 'appointment_same_day',  label: '本日' },
    { date: tomorrow, type: 'appointment_day_before', label: '明日' },
  ];

  let plan = 'standard';
  if (!isTest) {
    const { data: lic } = await supabase
      .from('clinic_licenses')
      .select('plan')
      .eq('clinic_id', 'default')
      .eq('is_active', true)
      .single();
    plan = lic?.plan || 'basic';
  }

  const results = [];

  for (const { date, type, label } of targets) {
    if (type === 'appointment_same_day' && plan === 'basic') continue;

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time,
        patients ( id, name, line_user_id ),
        treatments ( name )
      `)
      .eq('appointment_date', date)
      .eq('is_test', isTest)
      .in('status', ['confirmed', 'pending']);

    for (const appt of appointments ?? []) {
      const patient = appt.patients;

      if (!patient?.line_user_id) {
        await supabase.from('reminder_logs').insert({
          appointment_id: appt.id,
          patient_id:     patient?.id,
          reminder_type:  type,
          status:         'no_line',
          error_message:  'LINE未連携',
        });
        results.push({ type, patient: patient?.name, status: 'no_line' });
        continue;
      }

      const { data: dup } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('reminder_type', type)
        .eq('status', 'sent')
        .maybeSingle();
      if (dup) continue;

      try {
        await pushMessage(patient.line_user_id, [
          buildAppointmentMessage(label, appt.start_time?.slice(0, 5) || '', appt.treatments?.name, patient.name)
        ]);
        await supabase.from('reminder_logs').insert({
          appointment_id: appt.id,
          patient_id:     patient.id,
          reminder_type:  type,
          status:         'sent',
        });
        results.push({ type, patient: patient.name, status: 'sent' });
      } catch (err) {
        await supabase.from('reminder_logs').insert({
          appointment_id: appt.id,
          patient_id:     patient.id,
          reminder_type:  type,
          status:         'failed',
          error_message:  err.message,
        });
        results.push({ type, patient: patient.name, status: 'failed', error: err.message });
      }
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// ② 定期検診リマインド（3 / 6 ヶ月後）
// ─────────────────────────────────────────────────────────
async function runRecallReminders(isTest = false) {
  if (!isTest) {
    const { data: lic } = await supabase
      .from('clinic_licenses')
      .select('plan')
      .eq('clinic_id', 'default')
      .eq('is_active', true)
      .single();
    const plan = lic?.plan || 'basic';
    if (plan === 'basic') return [];
  }

  const results = [];

  for (const months of [3, 6]) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - months);
    const targetStr = targetDate.toISOString().slice(0, 10);

    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, line_user_id, recall_months')
      .eq('last_visit_date', targetStr)
      .eq('recall_months', months)
      .eq('is_active', true)
      .eq('is_test', isTest)
      .not('line_user_id', 'is', null);

    for (const patient of patients ?? []) {
      const reminderType = `recall_${months}month`;
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('reminder_type', reminderType)
        .gte('sent_at', since)
        .maybeSingle();
      if (recent) continue;

      try {
        await pushMessage(patient.line_user_id, [buildRecallMessage(months, patient.name)]);
        await supabase.from('reminder_logs').insert({
          patient_id:    patient.id,
          reminder_type: reminderType,
          status:        'sent',
        });
        results.push({ type: reminderType, patient: patient.name, status: 'sent' });
      } catch (err) {
        await supabase.from('reminder_logs').insert({
          patient_id:    patient.id,
          reminder_type: reminderType,
          status:        'failed',
          error_message: err.message,
        });
      }
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// ③ 誕生日メッセージ
// ─────────────────────────────────────────────────────────
async function runBirthdayReminders(isTest = false) {
  // ライセンスチェック（standard以上）
  if (!isTest) {
    const { data: lic } = await supabase
      .from('clinic_licenses')
      .select('plan')
      .eq('clinic_id', 'default')
      .eq('is_active', true)
      .single();
    const plan = lic?.plan || 'basic';
    if (plan === 'basic') return [];
  }

  // 誕生日機能が有効か確認
  const { data: setting } = await supabase
    .from('clinic_settings')
    .select('value')
    .eq('key', 'birthday_message_enabled')
    .maybeSingle();
  if (setting?.value === 'false') return [];

  // 今日の月日を取得（JST）
  const now   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const today = now.toISOString().slice(0, 10);

  // 今日が誕生日の患者を取得（月・日が一致）
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, birth_date, line_user_id')
    .eq('is_active', true)
    .eq('is_test', isTest)
    .not('line_user_id', 'is', null)
    .not('birth_date', 'is', null);

  const birthdayPatients = (patients || []).filter(p => {
    if (!p.birth_date) return false;
    const bd = new Date(p.birth_date);
    return (
      String(bd.getMonth() + 1).padStart(2, '0') === month &&
      String(bd.getDate()).padStart(2, '0') === day
    );
  });

  const results = [];

  for (const patient of birthdayPatients) {
    // 今年すでに送信済みならスキップ
    const yearStart = `${now.getFullYear()}-01-01`;
    const { data: dup } = await supabase
      .from('reminder_logs')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('reminder_type', 'birthday')
      .eq('status', 'sent')
      .gte('created_at', yearStart)
      .maybeSingle();
    if (dup) continue;

    // メッセージ文言を設定から取得
    const { data: msgSetting } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'birthday_message_text')
      .maybeSingle();
    const messageText = msgSetting?.value ||
      'お誕生日おめでとうございます！\nスマイル歯科スタッフ一同より、心よりお祝い申し上げます。\n\n素敵な一日をお過ごしください 🎂';

    try {
      await pushMessage(patient.line_user_id, [
        buildBirthdayMessage(patient.name, messageText)
      ]);
      await supabase.from('reminder_logs').insert({
        patient_id:    patient.id,
        reminder_type: 'birthday',
        status:        'sent',
        error_message: `誕生日メッセージ ${today}`,
      });
      results.push({ type: 'birthday', patient: patient.name, status: 'sent' });
    } catch (err) {
      await supabase.from('reminder_logs').insert({
        patient_id:    patient.id,
        reminder_type: 'birthday',
        status:        'failed',
        error_message: err.message,
      });
      results.push({ type: 'birthday', patient: patient.name, status: 'failed', error: err.message });
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// LINE メッセージテンプレート
// ─────────────────────────────────────────────────────────
function buildAppointmentMessage(label, time, treatmentName, patientName) {
  return {
    type: 'flex',
    altText: `${label}のご予約リマインダー`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#27ACB2',
        contents: [{
          type: 'text', text: `${label}のご予約`,
          color: '#ffffff', size: 'lg', weight: 'bold',
        }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: `${patientName} 様`, size: 'md', weight: 'bold', color: '#1f2937' },
          { type: 'separator', margin: 'sm' },
          { type: 'text', text: `時間: ${time || '—'}`,             size: 'sm', color: '#555555' },
          { type: 'text', text: `内容: ${treatmentName || '診療'}`, size: 'sm', color: '#555555' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'ご不明な点はお気軽にご連絡ください。', size: 'xs', color: '#aaaaaa', wrap: true },
        ],
      },
    },
  };
}

function buildRecallMessage(months, patientName) {
  return {
    type: 'flex',
    altText: '定期検診のご案内',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#FF8C00',
        contents: [{
          type: 'text', text: '定期検診のご案内',
          color: '#ffffff', size: 'lg', weight: 'bold',
        }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: `${patientName} 様`, size: 'md', weight: 'bold', color: '#1f2937' },
          { type: 'separator', margin: 'sm' },
          {
            type: 'text',
            text: `前回の来院から${months}ヶ月が経過しました。\n定期検診はお済みでしょうか？`,
            size: 'sm', color: '#555555', wrap: true,
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'お口の健康を守るために、定期的な検診をおすすめします。',
            size: 'xs', color: '#aaaaaa', wrap: true,
          },
        ],
      },
    },
  };
}

function buildBirthdayMessage(patientName, messageText) {
  return {
    type: 'flex',
    altText: `${patientName}様、お誕生日おめでとうございます！`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#e11d48',
        paddingAll: '20px',
        contents: [
          {
            type: 'text', text: '🎂 Happy Birthday!',
            color: '#ffffff', size: 'xl', weight: 'bold', align: 'center',
          },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: `${patientName} 様`,
            size: 'lg', weight: 'bold', color: '#1f2937', align: 'center',
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: messageText,
            size: 'sm', color: '#374151', wrap: true, align: 'center',
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#fff1f2',
        paddingAll: '12px',
        contents: [{
          type: 'text',
          text: 'スマイル歯科',
          size: 'xs', color: '#e11d48', align: 'center', weight: 'bold',
        }],
      },
      styles: {
        header: { separator: false },
        footer: { separator: true },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────
// エンドポイント
// ─────────────────────────────────────────────────────────

// 本番用（Cron・手動）
router.post('/run', async (req, res, next) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [appt, recall, birthday] = await Promise.all([
      runAppointmentReminders(false),
      runRecallReminders(false),
      runBirthdayReminders(false),
    ]);
    res.json({
      success: true,
      appointment: appt,
      recall,
      birthday,
      summary: {
        appt_sent:     appt.filter(r => r.status === 'sent').length,
        appt_failed:   appt.filter(r => r.status === 'failed').length,
        appt_no_line:  appt.filter(r => r.status === 'no_line').length,
        recall_sent:   recall.filter(r => r.status === 'sent').length,
        birthday_sent: birthday.filter(r => r.status === 'sent').length,
      },
    });
  } catch (err) { next(err); }
});

// テストモード用
router.post('/run-test', async (req, res, next) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [appt, recall, birthday] = await Promise.all([
      runAppointmentReminders(true),
      runRecallReminders(true),
      runBirthdayReminders(true),
    ]);
    res.json({
      success: true,
      mode: 'test',
      appointment: appt,
      recall,
      birthday,
      summary: {
        appt_sent:     appt.filter(r => r.status === 'sent').length,
        appt_failed:   appt.filter(r => r.status === 'failed').length,
        appt_no_line:  appt.filter(r => r.status === 'no_line').length,
        recall_sent:   recall.filter(r => r.status === 'sent').length,
        birthday_sent: birthday.filter(r => r.status === 'sent').length,
      },
    });
  } catch (err) { next(err); }
});

// 送信履歴取得
router.get('/logs', async (req, res, next) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const isTest = req.isTestMode;

    const { data: testPatientIds } = await supabase
      .from('patients')
      .select('id')
      .eq('is_test', isTest)
      .eq('is_active', true);

    const ids = (testPatientIds || []).map(p => p.id);

    let query = supabase
      .from('reminder_logs')
      .select('*, patients(name, is_test)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ids.length > 0) {
      query = query.in('patient_id', ids);
    } else {
      return res.json([]);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.runAppointmentReminders = runAppointmentReminders;
module.exports.runRecallReminders      = runRecallReminders;
module.exports.runBirthdayReminders    = runBirthdayReminders;
