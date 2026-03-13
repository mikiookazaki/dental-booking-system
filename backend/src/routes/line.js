const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../config/database');

// ── 内部API呼び出し用のベースURL ─────────────────────────
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// LINE Webhookの署名検証
function verifyLineSignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINE Messaging API で返信を送る
async function replyMessage(replyToken, messages) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error('LINE reply error:', err);
  }
}

// LINE Messaging API でプッシュメッセージを送る
async function pushMessage(lineUserId, messages) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error('LINE push error:', err);
  }
}

// ============================================================
// POST /api/line/webhook
// ============================================================
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }

  const body   = JSON.parse(req.body);
  const events = body.events || [];

  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('Webhook event error:', err);
    }
  }

  res.sendStatus(200);
});

// ============================================================
// イベントハンドラー
// ============================================================
async function handleEvent(event) {
  const { type, source, replyToken } = event;
  const lineUserId = source?.userId;

  switch (type) {
    case 'follow': {
      await replyMessage(replyToken, [{
        type: 'text',
        text: `🦷 スマイル歯科クリニックへようこそ！\n\nご予約・変更・キャンセルはメニューからどうぞ。\n\n初めての方は診察券のQRコードを読み取って患者登録してください。`,
      }]);
      break;
    }

    case 'message': {
      if (event.message.type !== 'text') break;
      const text    = event.message.text.trim();
      const patient = await getPatientByLineId(lineUserId);

      // QR連携トークンの処理
      if (text.startsWith('token=')) {
        await handleLineLink(replyToken, lineUserId, text.replace('token=', '').trim());
        break;
      }

      if (text === '予約' || text === '予約する') {
        await startBookingFlow(replyToken, patient);
      } else if (text === 'キャンセル' || text === '予約キャンセル') {
        await startCancelFlow(replyToken, patient, lineUserId);
      } else if (text === '予約確認') {
        await showUpcomingAppointments(replyToken, patient);
      } else {
        await replyMessage(replyToken, [{
          type: 'text',
          text: '下のメニューから操作してください 👇',
        }]);
      }
      break;
    }

    case 'postback': {
      const data    = new URLSearchParams(event.postback.data);
      const action  = data.get('action');
      const patient = await getPatientByLineId(lineUserId);

      switch (action) {
        case 'select_treatment':
          await handleTreatmentSelect(replyToken, data.get('treatment_id'), patient);
          break;
        case 'select_date':
          await handleDateSelect(replyToken, data.get('treatment_id'), data.get('date'), patient);
          break;
        case 'select_time':
          await handleTimeSelect(replyToken, data, patient);
          break;
        case 'confirm_booking':
          await handleConfirmBooking(replyToken, data, patient);
          break;
        case 'cancel_appointment':
          await handleCancelAppointment(replyToken, data.get('appointment_id'), patient);
          break;
      }
      break;
    }
  }
}

// ============================================================
// QRコード連携
// ============================================================
async function handleLineLink(replyToken, lineUserId, token) {
  const result = await db.query(`
    SELECT * FROM patients
    WHERE patient_token = $1
      AND token_expires > NOW()
  `, [token]);

  if (!result.rows.length) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: '❌ QRコードが無効または期限切れです。\n受付で再発行をお申し付けください。',
    }]);
    return;
  }

  const patient = result.rows[0];

  // すでに別のLINEと連携済みの場合
  if (patient.line_user_id && patient.line_user_id !== lineUserId) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: '⚠️ このQRコードはすでに使用済みです。\n受付にお問い合わせください。',
    }]);
    return;
  }

  // LINE UserIDを保存してトークンを無効化
  await db.query(`
    UPDATE patients SET
      line_user_id   = $1,
      line_linked_at = NOW(),
      patient_token  = NULL,
      token_expires  = NULL,
      updated_at     = NOW()
    WHERE id = $2
  `, [lineUserId, patient.id]);

  await replyMessage(replyToken, [{
    type: 'text',
    text: `✅ ${patient.name} 様、LINE連携が完了しました！\n\n「予約する」から診察の予約ができます🦷\nご来院をお待ちしております。`,
  }]);
}

// ============================================================
// 予約フロー
// ============================================================
async function startBookingFlow(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: '診察券のQRコードを読み取って患者登録を先に行ってください。',
    }]);
    return;
  }

  const treatments = await db.query(
    `SELECT * FROM treatments WHERE is_active = TRUE ORDER BY display_order`
  );

  if (!treatments.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '現在予約できる治療メニューがありません。' }]);
    return;
  }

  const columns = treatments.rows.slice(0, 10).map(t => ({
    title:   t.name.substring(0, 40),
    text:    `所要時間: ${t.duration}分`,
    actions: [{
      type:  'postback',
      label: '選択する',
      data:  `action=select_treatment&treatment_id=${t.id}`,
    }],
  }));

  await replyMessage(replyToken, [{
    type:     'template',
    altText:  '治療メニューを選択してください',
    template: { type: 'carousel', columns },
  }]);
}

async function handleTreatmentSelect(replyToken, treatmentId, patient) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0) dates.push(d.toISOString().split('T')[0]);
    if (dates.length >= 4) break;
  }

  const actions = dates.map(date => ({
    type:  'postback',
    label: formatDateJP(date),
    data:  `action=select_date&treatment_id=${treatmentId}&date=${date}`,
  }));

  await replyMessage(replyToken, [{
    type:     'template',
    altText:  '日程を選択してください',
    template: { type: 'buttons', text: '診察日を選択してください', actions },
  }]);
}

async function handleDateSelect(replyToken, treatmentId, date, patient) {
  const res   = await fetch(
    `${BACKEND_URL}/api/appointments/available/slots?date=${date}&treatment_id=${treatmentId}`
  );
  const data  = await res.json();
  const slots = data.slots || [];

  if (!slots.length) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `${formatDateJP(date)}は空き枠がありません。別の日程を選択してください。`,
    }]);
    return;
  }

  const actions = slots.slice(0, 4).map(slot => ({
    type:  'postback',
    label: `${slot.time}〜${slot.endTime}`,
    data:  `action=select_time&treatment_id=${treatmentId}&date=${date}&time=${slot.time}`,
  }));

  await replyMessage(replyToken, [{
    type:     'template',
    altText:  '時間を選択してください',
    template: { type: 'buttons', text: `${formatDateJP(date)}の空き時間`, actions },
  }]);
}

async function handleTimeSelect(replyToken, data, patient) {
  const treatmentId = data.get('treatment_id');
  const date        = data.get('date');
  const time        = data.get('time');

  const treatment = await db.query('SELECT * FROM treatments WHERE id=$1', [treatmentId]);
  const t = treatment.rows[0];

  await replyMessage(replyToken, [{
    type:     'template',
    altText:  '予約内容の確認',
    template: {
      type: 'confirm',
      text: `以下で予約しますか？\n\n📅 ${formatDateJP(date)}\n⏰ ${time}〜\n🦷 ${t.name}（${t.duration}分）`,
      actions: [
        {
          type:  'postback',
          label: '✅ 予約する',
          data:  `action=confirm_booking&treatment_id=${treatmentId}&date=${date}&time=${time}`,
        },
        {
          type:  'postback',
          label: '❌ やり直す',
          data:  'action=restart',
        },
      ],
    },
  }]);
}

async function handleConfirmBooking(replyToken, data, patient) {
  if (!patient) return;

  const treatmentId = data.get('treatment_id');
  const date        = data.get('date');
  const time        = data.get('time');

  const chairResult = await db.query(
    'SELECT id FROM chairs WHERE is_active=TRUE ORDER BY display_order LIMIT 1'
  );
  const staffResult = await db.query(
    "SELECT id FROM staff WHERE role='doctor' AND is_active=TRUE LIMIT 1"
  );

  if (!chairResult.rows.length || !staffResult.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '空き枠の確保に失敗しました。お電話でご予約ください。' }]);
    return;
  }

  const res = await fetch(`${BACKEND_URL}/api/appointments`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      patient_id:       patient.id,
      staff_id:         staffResult.rows[0].id,
      chair_id:         chairResult.rows[0].id,
      treatment_id:     treatmentId,
      appointment_date: date,
      start_time:       time,
      source:           'line',
    }),
  });

  if (res.ok) {
    const treatment = await db.query('SELECT * FROM treatments WHERE id=$1', [treatmentId]);
    const t = treatment.rows[0];
    await replyMessage(replyToken, [{
      type: 'text',
      text: `✅ 予約が完了しました！\n\n📅 ${formatDateJP(date)}\n⏰ ${time}〜\n🦷 ${t.name}\n\n前日にリマインドをお送りします。ご来院をお待ちしております🦷`,
    }]);
  } else {
    await replyMessage(replyToken, [{ type: 'text', text: '予約の確定に失敗しました。お電話でご予約ください。' }]);
  }
}

async function startCancelFlow(replyToken, patient, lineUserId) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。診察券のQRコードを読み取ってください。' }]);
    return;
  }

  const result = await db.query(`
    SELECT a.id, a.appointment_date, a.start_time, t.name AS treatment_name
    FROM appointments a
    JOIN treatments t ON a.treatment_id = t.id
    WHERE a.patient_id = $1 AND a.status = 'confirmed' AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date LIMIT 3
  `, [patient.id]);

  if (!result.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: 'キャンセルできる予約がありません。' }]);
    return;
  }

  const actions = result.rows.map(appt => ({
    type:  'postback',
    label: `${formatDateJP(appt.appointment_date.toISOString().split('T')[0])} ${appt.start_time.substring(0,5)}`,
    data:  `action=cancel_appointment&appointment_id=${appt.id}`,
  }));

  await replyMessage(replyToken, [{
    type:     'template',
    altText:  'キャンセルする予約を選択',
    template: { type: 'buttons', text: 'キャンセルする予約を選択してください', actions },
  }]);
}

async function handleCancelAppointment(replyToken, appointmentId, patient) {
  await fetch(`${BACKEND_URL}/api/appointments/${appointmentId}`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ cancelled_by: 'patient', cancel_reason: 'LINEからキャンセル' }),
  });
  await replyMessage(replyToken, [{ type: 'text', text: '✅ 予約をキャンセルしました。またのご来院をお待ちしております。' }]);
}

async function showUpcomingAppointments(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。' }]);
    return;
  }

  const result = await db.query(`
    SELECT a.appointment_date, a.start_time, t.name AS treatment_name, s.name AS staff_name
    FROM appointments a
    JOIN treatments t ON a.treatment_id = t.id
    JOIN staff s ON a.staff_id = s.id
    WHERE a.patient_id=$1 AND a.status='confirmed' AND a.appointment_date >= CURRENT_DATE
    ORDER BY a.appointment_date LIMIT 3
  `, [patient.id]);

  if (!result.rows.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '現在ご予約はありません。' }]);
    return;
  }

  const text = result.rows.map(a =>
    `📅 ${formatDateJP(a.appointment_date.toISOString().split('T')[0])}\n⏰ ${a.start_time.substring(0,5)}\n🦷 ${a.treatment_name}\n👨‍⚕️ ${a.staff_name}`
  ).join('\n\n');

  await replyMessage(replyToken, [{ type: 'text', text: `ご予約一覧\n\n${text}` }]);
}

// ── ユーティリティ ────────────────────────────────────────
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

module.exports            = router;
module.exports.pushMessage = pushMessage;
