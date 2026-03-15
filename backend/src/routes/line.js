const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../config/database');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function verifyLineSignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error('LINE reply error:', await res.text());
}

async function pushMessage(lineUserId, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages }),
  });
  if (!res.ok) console.error('LINE push error:', await res.text());
}

// GET /api/line/link?code=P-00001
router.get('/link', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('patient_code が必要です');
  const patient = await db.query(
    'SELECT id, name, patient_code FROM patients WHERE patient_code = $1 AND is_active = TRUE',
    [code]
  );
  if (!patient.rows.length) return res.status(404).send('患者が見つかりません');
  const botId   = process.env.LINE_BOT_ID;
  const text    = `link:${code}`;
  const lineUrl = `https://line.me/R/oaMessage/${encodeURIComponent(botId)}/?text=${encodeURIComponent(text)}`;
  res.redirect(lineUrl);
});

// POST /api/line/webhook
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(req.body, signature)) return res.status(401).send('Invalid signature');
  const body   = JSON.parse(req.body);
  const events = body.events || [];
  for (const event of events) {
    try { await handleEvent(event); } catch (err) { console.error('Webhook event error:', err); }
  }
  res.sendStatus(200);
});

async function handleEvent(event) {
  const { type, source, replyToken } = event;
  const lineUserId = source?.userId;

  switch (type) {
    case 'follow': {
      await replyMessage(replyToken, [{
        type: 'text',
        text: `🦷 スマイル歯科クリニックへようこそ！\n\nご予約・変更・キャンセルはメニューからどうぞ。\n\n初めての方は受付で発行したQRコードを読み取って患者登録してください。`,
      }]);
      break;
    }
    case 'message': {
      if (event.message.type !== 'text') break;
      const raw       = event.message.text.trim();
      const cleanText = raw.replace(/^text=/, '');
      if (cleanText.startsWith('link:')) {
        const code = cleanText.replace('link:', '').trim();
        await handleLineLink(replyToken, lineUserId, code);
        break;
      }
      const patient = await getPatientByLineId(lineUserId);
      if      (cleanText === '予約' || cleanText === '予約する')             await startBookingFlow(replyToken, patient);
      else if (cleanText === 'キャンセル' || cleanText === '予約キャンセル') await startCancelFlow(replyToken, patient);
      else if (cleanText === '予約確認')                                     await showUpcomingAppointments(replyToken, patient);
      else { await replyMessage(replyToken, [{ type: 'text', text: '下のメニューから操作してください 👇' }]); }
      break;
    }
    case 'postback': {
      const data    = new URLSearchParams(event.postback.data);
      const action  = data.get('action');
      const patient = await getPatientByLineId(lineUserId);

      // ② タイムスタンプチェック：30分以上前のpostbackは無効
      const ts = data.get('ts');
      const timeoutActions = ['select_date','select_time','confirm_booking','cancel_appointment'];
      if (ts && timeoutActions.includes(action)) {
        const elapsed = Date.now() - parseInt(ts);
        if (elapsed > 30 * 60 * 1000) {
          await replyMessage(replyToken, [{
            type: 'text',
            text: '⏰ このボタンの有効期限が切れました。
もう一度メニューから操作してください。',
          }]);
          break;
        }
      }

      switch (action) {
        case 'select_treatment':   await handleTreatmentSelect(replyToken, data.get('treatment_id'), patient); break;
        case 'select_date':        await handleDateSelect(replyToken, data.get('treatment_id'), data.get('date'), patient); break;
        case 'select_time':        await handleTimeSelect(replyToken, data, patient); break;
        case 'confirm_booking':    await handleConfirmBooking(replyToken, data, patient); break;
        case 'cancel_appointment': await handleCancelAppointment(replyToken, data.get('appointment_id'), patient); break;
        case 'set_age_group':      await handleSetAgeGroup(replyToken, lineUserId, data.get('range')); break;
        case 'set_age_detail':     await handleSetAgeDetail(replyToken, lineUserId, data.get('age_group')); break;
      }
      break;
    }
  }
}

// QRコードによる患者連携
async function handleLineLink(replyToken, lineUserId, patientCode) {
  const result = await db.query(
    'SELECT * FROM patients WHERE patient_code = $1 AND is_active = TRUE', [patientCode]
  );
  if (!result.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '❌ 患者番号が見つかりません。\n受付にお問い合わせください。' }]);
    return;
  }
  const patient = result.rows[0];
  if (patient.line_user_id && patient.line_user_id !== lineUserId) {
    await replyMessage(replyToken, [{ type: 'text', text: '⚠️ このQRコードはすでに別のアカウントで連携されています。\n受付にお問い合わせください。' }]);
    return;
  }
  if (patient.line_user_id === lineUserId) {
    await replyMessage(replyToken, [{ type: 'text', text: `✅ ${patient.name} 様はすでに連携済みです。\nメニューからご予約いただけます🦷` }]);
    return;
  }
  await db.query(
    'UPDATE patients SET line_user_id=$1, line_linked_at=NOW(), updated_at=NOW() WHERE id=$2',
    [lineUserId, patient.id]
  );

  // 【3】年代未登録の場合は質問する
  if (!patient.age_group && !patient.birth_date) {
    await replyMessage(replyToken, [
      { type: 'text', text: `✅ ${patient.name} 様（${patient.patient_code}）、LINE連携が完了しました！` },
      {
        type: 'template', altText: 'あなたの年代を教えてください',
        template: {
          type: 'buttons',
          text: 'あなたの年代を教えてください（データ分析にのみ使用します）',
          actions: [
            { type: 'postback', label: '10〜30代', data: 'action=set_age_group&range=young' },
            { type: 'postback', label: '40〜50代', data: 'action=set_age_group&range=middle' },
            { type: 'postback', label: '60〜70代', data: 'action=set_age_group&range=senior' },
            { type: 'postback', label: '80代以上', data: 'action=set_age_group&range=elder' },
          ],
        },
      },
    ]);
  } else {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `✅ ${patient.name} 様（${patient.patient_code}）、LINE連携が完了しました！\n\n「予約する」から診察の予約ができます🦷\nご来院をお待ちしております。`,
    }]);
  }
}

// 【3】年代設定フロー
async function handleSetAgeGroup(replyToken, lineUserId, range) {
  const rangeMap = {
    young:  [['10代'],['20代'],['30代']],
    middle: [['40代'],['50代']],
    senior: [['60代'],['70代']],
    elder:  [['80代'],['90代以上']],
  };
  const ages = rangeMap[range] || rangeMap.young;
  await replyMessage(replyToken, [{
    type: 'template', altText: '年代を選択してください',
    template: {
      type: 'buttons', text: '年代を選択してください',
      actions: ages.map(([ag]) => ({
        type: 'postback', label: ag, data: `action=set_age_detail&age_group=${ag}`
      })),
    },
  }]);
}

async function handleSetAgeDetail(replyToken, lineUserId, ageGroup) {
  const patient = await getPatientByLineId(lineUserId);
  if (!patient) return;
  await db.query('UPDATE patients SET age_group=$1, updated_at=NOW() WHERE id=$2', [ageGroup, patient.id]);
  await replyMessage(replyToken, [{
    type: 'text',
    text: `ありがとうございます！\n\n「予約する」から診察の予約ができます🦷\nご来院をお待ちしております。`,
  }]);
}

// 予約フロー
async function startBookingFlow(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '受付で発行したQRコードを読み取って患者登録を先に行ってください。' }]);
    return;
  }
  const treatments = await db.query('SELECT * FROM treatments WHERE is_active=TRUE AND line_visible=TRUE ORDER BY display_order');
  if (!treatments.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '現在予約できる治療メニューがありません。' }]);
    return;
  }
  const columns = treatments.rows.slice(0, 10).map(t => ({
    title: t.name.substring(0, 40), text: `所要時間: ${t.duration}分`,
    actions: [{ type: 'postback', label: '選択する', data: `action=select_treatment&treatment_id=${t.id}` }],
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: '治療メニューを選択してください', template: { type: 'carousel', columns } }]);
}

async function handleTreatmentSelect(replyToken, treatmentId, patient) {
  // ① DB の clinic_settings から open_days を取得して休診日を除外
  const settingsResult = await db.query(
    "SELECT value FROM clinic_settings WHERE key = 'open_days'"
  );
  const openDays = settingsResult.rows.length
    ? JSON.parse(settingsResult.rows[0].value)
    : [1,2,3,4,5,6];

  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (openDays.includes(dow)) dates.push(d.toISOString().split('T')[0]);
    if (dates.length >= 4) break;
  }

  if (!dates.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '現在予約可能な日程がありません。お電話でお問い合わせください。' }]);
    return;
  }

  const actions = dates.map(date => ({
    type: 'postback', label: formatDateJP(date),
    data: `action=select_date&treatment_id=${treatmentId}&date=${date}&ts=${Date.now()}`,
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: '日程を選択してください', template: { type: 'buttons', text: '診察日を選択してください', actions } }]);
}

async function handleDateSelect(replyToken, treatmentId, date, patient) {
  const res   = await fetch(`${BACKEND_URL}/api/appointments/available-slots/${date}`);
  const data  = await res.json();
  const slots = (data.slots || []).filter(s => s.available);
  if (!slots.length) {
    await replyMessage(replyToken, [{ type: 'text', text: `${formatDateJP(date)}は空き枠がありません。別の日程を選択してください。` }]);
    return;
  }
  const actions = slots.slice(0, 4).map(slot => ({
    type: 'postback', label: `${slot.time}〜`,
    data: `action=select_time&treatment_id=${treatmentId}&date=${date}&time=${slot.time}&ts=${Date.now()}`,
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: '時間を選択してください', template: { type: 'buttons', text: `${formatDateJP(date)}の空き時間`, actions } }]);
}

async function handleTimeSelect(replyToken, data, patient) {
  const treatmentId = data.get('treatment_id');
  const date        = data.get('date');
  const time        = data.get('time');
  const t           = (await db.query('SELECT * FROM treatments WHERE id=$1', [treatmentId])).rows[0];
  await replyMessage(replyToken, [{
    type: 'template', altText: '予約内容の確認',
    template: {
      type: 'confirm',
      text: `以下で予約しますか？\n\n📅 ${formatDateJP(date)}\n⏰ ${time}〜\n🦷 ${t.name}（${t.duration}分）`,
      actions: [
        { type: 'postback', label: '✅ 予約する', data: `action=confirm_booking&treatment_id=${treatmentId}&date=${date}&time=${time}&ts=${Date.now()}` },
        { type: 'postback', label: '❌ やり直す', data: 'action=restart' },
      ],
    },
  }]);
}

async function handleConfirmBooking(replyToken, data, patient) {
  if (!patient) return;
  const treatmentId = data.get('treatment_id');
  const date        = data.get('date');
  const time        = data.get('time');
  const chair = (await db.query('SELECT id FROM chairs WHERE is_active=TRUE AND line_bookable=TRUE ORDER BY display_order LIMIT 1')).rows[0];
  const staff = (await db.query("SELECT id FROM staff WHERE role='doctor' AND is_active=TRUE LIMIT 1")).rows[0];
  if (!chair || !staff) {
    await replyMessage(replyToken, [{ type: 'text', text: '空き枠の確保に失敗しました。お電話でご予約ください。' }]);
    return;
  }
  const t = (await db.query('SELECT * FROM treatments WHERE id=$1', [treatmentId])).rows[0];
  const endTime = addMinutes(time, t.duration);
  const res = await fetch(`${BACKEND_URL}/api/appointments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patient.id, staff_id: staff.id, chair_id: chair.id, treatment_id: treatmentId, appointment_date: date, start_time: time, end_time: endTime, source: 'line' }),
  });
  if (res.ok) {
    await replyMessage(replyToken, [{ type: 'text', text: `✅ 予約が完了しました！\n\n📅 ${formatDateJP(date)}\n⏰ ${time}〜\n🦷 ${t.name}\n\n前日にリマインドをお送りします。ご来院をお待ちしております🦷` }]);
  } else {
    await replyMessage(replyToken, [{ type: 'text', text: '予約の確定に失敗しました。お電話でご予約ください。' }]);
  }
}

async function startCancelFlow(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。受付で発行したQRコードを読み取ってください。' }]);
    return;
  }
  const result = await db.query(`
    SELECT a.id, a.appointment_date, a.start_time, t.name AS treatment_name
    FROM appointments a JOIN treatments t ON a.treatment_id = t.id
    WHERE a.patient_id=$1 AND a.status='confirmed' AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date LIMIT 3
  `, [patient.id]);
  if (!result.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: 'キャンセルできる予約がありません。' }]);
    return;
  }
  const actions = result.rows.map(appt => ({
    type: 'postback',
    label: `${formatDateJP(appt.appointment_date.toISOString().split('T')[0])} ${appt.start_time.substring(0,5)}`,
    data: `action=cancel_appointment&appointment_id=${appt.id}`,
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: 'キャンセルする予約を選択', template: { type: 'buttons', text: 'キャンセルする予約を選択してください', actions } }]);
}

async function handleCancelAppointment(replyToken, appointmentId, patient) {
  await fetch(`${BACKEND_URL}/api/appointments/${appointmentId}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancelled_by: 'patient', cancel_reason: 'LINEからキャンセル' }),
  });
  await replyMessage(replyToken, [{ type: 'text', text: '✅ 予約をキャンセルしました。またのご来院をお待ちしております。' }]);
}

async function showUpcomingAppointments(replyToken, patient) {
  if (!patient) { await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。' }]); return; }
  const result = await db.query(`
    SELECT a.appointment_date, a.start_time, t.name AS treatment_name, s.name AS staff_name
    FROM appointments a JOIN treatments t ON a.treatment_id=t.id JOIN staff s ON a.staff_id=s.id
    WHERE a.patient_id=$1 AND a.status='confirmed' AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date LIMIT 3
  `, [patient.id]);
  if (!result.rows.length) { await replyMessage(replyToken, [{ type: 'text', text: '現在ご予約はありません。' }]); return; }
  const text = result.rows.map(a =>
    `📅 ${formatDateJP(a.appointment_date.toISOString().split('T')[0])}\n⏰ ${a.start_time.substring(0,5)}\n🦷 ${a.treatment_name}\n👨‍⚕️ ${a.staff_name}`
  ).join('\n\n');
  await replyMessage(replyToken, [{ type: 'text', text: `ご予約一覧\n\n${text}` }]);
}

async function getPatientByLineId(lineUserId) {
  if (!lineUserId) return null;
  const result = await db.query('SELECT * FROM patients WHERE line_user_id=$1', [lineUserId]);
  return result.rows[0] || null;
}

function formatDateJP(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth()+1}月${d.getDate()}日(${dow})`;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

module.exports             = router;
module.exports.pushMessage = pushMessage;
