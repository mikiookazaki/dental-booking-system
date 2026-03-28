// routes/line.js （Supabase移行版）
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

async function hideRichMenu(lineUserId) {
  await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/richmenu`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  }).catch(() => {});
}

async function showRichMenu(lineUserId) {
  const menuId = process.env.LINE_RICH_MENU_ID;
  if (!menuId) return;
  await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/richmenu/${menuId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  }).catch(() => {});
}

// GET /api/line/link
router.get('/link', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('patient_code が必要です');
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, patient_code')
    .eq('patient_code', code)
    .eq('is_active', true)
    .single();
  if (!patient) return res.status(404).send('患者が見つかりません');
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
        text: `🦷 スマイル歯科クリニックへようこそ！\n\nご予約・変更・キャンセルはメニューからどうぞ。\n\n初めての方は「予約する」から問診・患者登録ができます。\n\n診察券をお持ちの方は受付でQRコードを発行してもらってください。`,
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
      const session = await getInquirySession(lineUserId);
      if (session) {
        await handleInquiryMessage(replyToken, lineUserId, session, cleanText);
        break;
      }

      if      (cleanText === '予約' || cleanText === '予約する')             await startBookingOrInquiry(replyToken, lineUserId, patient);
      else if (cleanText === 'キャンセル' || cleanText === '予約キャンセル') await startCancelFlow(replyToken, patient);
      else if (cleanText === '予約確認')                                     await showUpcomingAppointments(replyToken, patient);
      else { await replyMessage(replyToken, [{ type: 'text', text: '下のメニューから操作してください' }]); }
      break;
    }

    case 'postback': {
      const data    = new URLSearchParams(event.postback.data);
      const action  = data.get('action');
      const patient = await getPatientByLineId(lineUserId);

      const ts = data.get('ts');
      const timeoutActions = ['select_date','select_time','confirm_booking','cancel_appointment'];
      if (ts && timeoutActions.includes(action)) {
        const elapsed = Date.now() - parseInt(ts);
        if (elapsed > 30 * 60 * 1000) {
          await replyMessage(replyToken, [{ type: 'text', text: 'このボタンの有効期限が切れました。\nもう一度メニューから操作してください。' }]);
          break;
        }
      }

      const session = await getInquirySession(lineUserId);
      if (session && action && action.startsWith('inq_')) {
        await handleInquiryPostback(replyToken, lineUserId, session, action, data);
        break;
      }

      switch (action) {
        case 'start_inquiry':      await startInquiryFlow(replyToken, lineUserId); break;
        case 'select_treatment':   await handleTreatmentSelect(replyToken, data.get('treatment_id'), patient); break;
        case 'select_date':        await handleDateSelect(replyToken, data.get('treatment_id'), data.get('date'), patient); break;
        case 'select_time':        await handleTimeSelect(replyToken, data, patient); break;
        case 'confirm_booking':    await handleConfirmBooking(replyToken, lineUserId, data, patient); break;
        case 'cancel_appointment': await handleCancelAppointment(replyToken, data.get('appointment_id'), patient); break;
        case 'set_age_group':      await handleSetAgeGroup(replyToken, lineUserId, data.get('range')); break;
        case 'set_age_detail':     await handleSetAgeDetail(replyToken, lineUserId, data.get('age_group')); break;
      }
      break;
    }
  }
}

// ============================================================
// 問診セッション管理
// ============================================================
async function getInquirySession(lineUserId) {
  const { data } = await supabase
    .from('line_inquiry_sessions')
    .select('*')
    .eq('line_user_id', lineUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  if (new Date() - new Date(data.updated_at) > 60 * 60 * 1000) {
    await supabase.from('line_inquiry_sessions').delete().eq('line_user_id', lineUserId);
    return null;
  }
  return data;
}

async function saveSession(lineUserId, step, data) {
  await supabase
    .from('line_inquiry_sessions')
    .upsert({ line_user_id: lineUserId, step, data, updated_at: new Date().toISOString() }, { onConflict: 'line_user_id' });
}

async function clearSession(lineUserId) {
  await supabase.from('line_inquiry_sessions').delete().eq('line_user_id', lineUserId);
}

// ============================================================
// 予約 or 問診フロー分岐
// ============================================================
async function startBookingOrInquiry(replyToken, lineUserId, patient) {
  if (patient) {
    await startBookingFlow(replyToken, patient);
  } else {
    await replyMessage(replyToken, [{
      type: 'template', altText: '初めてのご来院ですか？',
      template: {
        type: 'confirm',
        text: 'スマイル歯科クリニックへようこそ！\n\n初めてのご来院ですか？',
        actions: [
          { type: 'postback', label: '初めて（問診へ）', data: 'action=start_inquiry&ts=' + Date.now() },
          { type: 'message',  label: '以前に来院あり',  text: '受付で診察券番号をご確認の上、QRコードを発行してもらってください。' },
        ],
      },
    }]);
  }
}

// ============================================================
// 問診フロー
// ============================================================
async function startInquiryFlow(replyToken, lineUserId) {
  await saveSession(lineUserId, 'name', {});
  await hideRichMenu(lineUserId);
  await replyMessage(replyToken, [{ type: 'text', text: '問診を開始します。\n\n【1/5】お名前を入力してください。\n例：山田 花子' }]);
}

async function handleInquiryMessage(replyToken, lineUserId, session, text) {
  const step = session.step;
  const data = session.data || {};

  switch (step) {
    case 'name': {
      if (!text || text.length < 2) {
        await replyMessage(replyToken, [{ type: 'text', text: 'お名前を入力してください（例：山田 花子）' }]);
        return;
      }
      data.name = text;
      await saveSession(lineUserId, 'kana', data);
      await replyMessage(replyToken, [{ type: 'text', text: `【2/5】フリガナを入力してください。\n\n「${text}」さんのフリガナをカタカナで入力してください。\n例：ヤマダ ハナコ` }]);
      break;
    }
    case 'kana': {
      if (!/^[ァ-ヶーぁ-ん\s　]+$/.test(text)) {
        await replyMessage(replyToken, [{ type: 'text', text: 'カタカナで入力してください。\n例：ヤマダ ハナコ' }]);
        return;
      }
      data.name_kana = text.replace(/[ぁ-ん]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
      await saveSession(lineUserId, 'age', data);
      await replyMessage(replyToken, [{
        type: 'template', altText: '年代を選択してください',
        template: {
          type: 'buttons', text: '【3/5】あなたの年代を教えてください',
          actions: [
            { type: 'postback', label: '10〜30代', data: 'action=inq_age&range=young' },
            { type: 'postback', label: '40〜50代', data: 'action=inq_age&range=middle' },
            { type: 'postback', label: '60〜70代', data: 'action=inq_age&range=senior' },
            { type: 'postback', label: '80代以上', data: 'action=inq_age&range=elder' },
          ],
        },
      }]);
      break;
    }
    case 'phone': {
      const phone = text.replace(/[^0-9-]/g, '');
      if (phone.length < 10) {
        await replyMessage(replyToken, [{ type: 'text', text: '正しい電話番号を入力してください。\n例：090-1234-5678' }]);
        return;
      }
      data.phone = phone;
      await saveSession(lineUserId, 'postal', data);
      await replyMessage(replyToken, [{
        type: 'template', altText: '郵便番号を入力しますか？',
        template: {
          type: 'confirm', text: '【4/5 続き】郵便番号を教えていただけますか？（任意）',
          actions: [
            { type: 'postback', label: '入力する', data: 'action=inq_postal_yes' },
            { type: 'postback', label: 'スキップ', data: 'action=inq_postal_skip' },
          ],
        },
      }]);
      break;
    }
    case 'postal_input': {
      const postal = text.replace(/[^0-9]/g, '');
      data.postal_code = postal.length === 7 ? `${postal.substring(0,3)}-${postal.substring(3)}` : text;
      await saveSession(lineUserId, 'referral', data);
      await askReferral(replyToken, lineUserId);
      break;
    }
    case 'memo': {
      data.memo = text;
      await saveSession(lineUserId, 'confirm', data);
      await showRichMenu(lineUserId);
      await showConfirm(replyToken, lineUserId, data);
      break;
    }
    default: {
      await replyMessage(replyToken, [{ type: 'text', text: '下のメニューから操作してください' }]);
    }
  }
}

async function handleInquiryPostback(replyToken, lineUserId, session, action, data) {
  const sData = session.data || {};

  if (action === 'inq_age') {
    const rangeMap = {
      young:  [['10代','inq_age_10'],['20代','inq_age_20'],['30代','inq_age_30']],
      middle: [['40代','inq_age_40'],['50代','inq_age_50']],
      senior: [['60代','inq_age_60'],['70代','inq_age_70']],
      elder:  [['80代','inq_age_80'],['90代以上','inq_age_90']],
    };
    const ages = rangeMap[data.get('range')] || rangeMap.young;
    await replyMessage(replyToken, [{
      type: 'template', altText: '年代を選択',
      template: { type: 'buttons', text: '年代を選択してください', actions: ages.map(([label, act]) => ({ type: 'postback', label, data: `action=${act}` })) },
    }]);
    return;
  }

  if (action.startsWith('inq_age_')) {
    const ageMap = { inq_age_10:'10代', inq_age_20:'20代', inq_age_30:'30代', inq_age_40:'40代', inq_age_50:'50代', inq_age_60:'60代', inq_age_70:'70代', inq_age_80:'80代', inq_age_90:'90代以上' };
    sData.age_group = ageMap[action] || '';
    await saveSession(lineUserId, 'phone', sData);
    await hideRichMenu(lineUserId);
    await replyMessage(replyToken, [{ type: 'text', text: '【4/5】電話番号を入力してください。\n例：090-1234-5678' }]);
    return;
  }

  if (action === 'inq_postal_yes') {
    await saveSession(lineUserId, 'postal_input', sData);
    await hideRichMenu(lineUserId);
    await replyMessage(replyToken, [{ type: 'text', text: '郵便番号を入力してください。\n例：150-0001' }]);
    return;
  }

  if (action === 'inq_postal_skip') {
    sData.postal_code = '';
    await saveSession(lineUserId, 'referral', sData);
    await askReferral(replyToken, lineUserId);
    return;
  }

  if (action === 'inq_referral_cat') {
    await saveSession(lineUserId, 'referral', sData);
    await askReferralDetail(replyToken, data.get('cat'));
    return;
  }

  if (action === 'inq_referral') {
    sData.referral_source = data.get('source');
    await saveSession(lineUserId, 'memo', sData);
    await showRichMenu(lineUserId);
    await replyMessage(replyToken, [{
      type: 'template', altText: 'その他ご連絡事項はありますか？',
      template: {
        type: 'confirm', text: '最後に、アレルギーや服用中のお薬など\nスタッフへの伝言はありますか？',
        actions: [
          { type: 'postback', label: 'あり（入力する）', data: 'action=inq_memo_yes' },
          { type: 'postback', label: 'なし（スキップ）', data: 'action=inq_memo_skip' },
        ],
      },
    }]);
    return;
  }

  if (action === 'inq_memo_yes') {
    await saveSession(lineUserId, 'memo', sData);
    await hideRichMenu(lineUserId);
    await replyMessage(replyToken, [{ type: 'text', text: 'アレルギーや服用中のお薬など、スタッフへ伝えたいことを入力してください。' }]);
    return;
  }

  if (action === 'inq_memo_skip') {
    sData.memo = '';
    await saveSession(lineUserId, 'confirm', sData);
    await showRichMenu(lineUserId);
    await showConfirm(replyToken, lineUserId, sData);
    return;
  }

  if (action === 'inq_confirm_yes') {
    await registerNewPatient(replyToken, lineUserId, sData);
    return;
  }

  if (action === 'inq_confirm_no') {
    await clearSession(lineUserId);
    await replyMessage(replyToken, [{ type: 'text', text: '問診をキャンセルしました。\nもう一度「予約する」から始めてください。' }]);
    return;
  }
}

async function askReferral(replyToken, lineUserId) {
  await replyMessage(replyToken, [{
    type: 'template', altText: 'クリニックをどこで知りましたか？',
    template: {
      type: 'buttons', text: '【5/5】当クリニックをどこでお知りになりましたか？\nカテゴリを選んでください。',
      actions: [
        { type: 'postback', label: 'Web・デジタル系', data: 'action=inq_referral_cat&cat=web' },
        { type: 'postback', label: '口コミ・広告系',  data: 'action=inq_referral_cat&cat=ads' },
      ],
    },
  }]);
}

async function askReferralDetail(replyToken, cat) {
  const webActions = [
    { type: 'postback', label: 'インターネット検索', data: 'action=inq_referral&source=インターネット検索' },
    { type: 'postback', label: 'SNS・Instagram',    data: 'action=inq_referral&source=SNS・Instagram' },
    { type: 'postback', label: '公式HP',             data: 'action=inq_referral&source=公式HP' },
  ];
  const adsActions = [
    { type: 'postback', label: 'ご紹介',      data: 'action=inq_referral&source=ご紹介' },
    { type: 'postback', label: '看板・チラシ', data: 'action=inq_referral&source=看板・チラシ' },
    { type: 'postback', label: 'TVCM',        data: 'action=inq_referral&source=TVCM' },
  ];
  await replyMessage(replyToken, [{
    type: 'template', altText: '来院きっかけを選んでください',
    template: { type: 'buttons', text: '具体的にどちらですか？', actions: cat === 'web' ? webActions : adsActions },
  }]);
}

async function showConfirm(replyToken, lineUserId, d) {
  const confirmText =
    `ご入力内容を確認してください。\n\n` +
    `お名前: ${d.name}\nフリガナ: ${d.name_kana}\n年代: ${d.age_group}\n` +
    `電話番号: ${d.phone}\n郵便番号: ${d.postal_code || 'なし'}\n` +
    `来院きっかけ: ${d.referral_source || 'なし'}\nその他: ${d.memo || 'なし'}\n\nこの内容で登録しますか？`;

  await replyMessage(replyToken, [{
    type: 'template', altText: '入力内容の確認',
    template: {
      type: 'confirm', text: confirmText,
      actions: [
        { type: 'postback', label: '登録する', data: 'action=inq_confirm_yes' },
        { type: 'postback', label: 'やり直す', data: 'action=inq_confirm_no' },
      ],
    },
  }]);
}

async function registerNewPatient(replyToken, lineUserId, d) {
  try {
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        name: d.name, name_kana: d.name_kana, phone: d.phone,
        age_group: d.age_group || null, postal_code: d.postal_code || null,
        referral_source: d.referral_source || null, notes: d.memo || null,
        line_user_id: lineUserId, line_linked_at: new Date().toISOString(), is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    await clearSession(lineUserId);
    await showRichMenu(lineUserId);
    await replyMessage(replyToken, [{
      type: 'text',
      text: `✅ 患者登録が完了しました！\n\n患者番号: ${patient.patient_code}\n${patient.name} 様\n\n続けてご予約いただけます。`,
    }]);
    await startBookingFlow(replyToken, patient);
  } catch (err) {
    console.error('registerNewPatient error:', err);
    await replyMessage(replyToken, [{ type: 'text', text: '登録中にエラーが発生しました。受付にお問い合わせください。' }]);
  }
}

// ============================================================
// QRコード連携
// ============================================================
async function handleLineLink(replyToken, lineUserId, patientCode) {
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_code', patientCode)
    .eq('is_active', true)
    .single();

  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '患者番号が見つかりません。\n受付にお問い合わせください。' }]);
    return;
  }
  if (patient.line_user_id && patient.line_user_id !== lineUserId) {
    await replyMessage(replyToken, [{ type: 'text', text: 'このQRコードはすでに別のアカウントで連携されています。\n受付にお問い合わせください。' }]);
    return;
  }
  if (patient.line_user_id === lineUserId) {
    await replyMessage(replyToken, [{ type: 'text', text: `${patient.name} 様はすでに連携済みです。\nメニューからご予約いただけます` }]);
    return;
  }

  await supabase
    .from('patients')
    .update({ line_user_id: lineUserId, line_linked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', patient.id);

  if (!patient.age_group && !patient.birth_date) {
    await replyMessage(replyToken, [
      { type: 'text', text: `${patient.name} 様（${patient.patient_code}）、LINE連携が完了しました！` },
      {
        type: 'template', altText: 'あなたの年代を教えてください',
        template: {
          type: 'buttons', text: 'あなたの年代を教えてください（データ分析にのみ使用します）',
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
    await replyMessage(replyToken, [{ type: 'text', text: `${patient.name} 様（${patient.patient_code}）、LINE連携が完了しました！\n\n「予約する」から診察の予約ができます` }]);
  }
}

// ============================================================
// 予約フロー
// ============================================================
async function startBookingFlow(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '受付で発行したQRコードを読み取って患者登録を先に行ってください。' }]);
    return;
  }
  const { data: treatments } = await supabase
    .from('treatments')
    .select('*')
    .eq('is_active', true)
    .eq('line_visible', true)
    .order('display_order');

  if (!treatments?.length) {
    await replyMessage(replyToken, [{ type: 'text', text: '現在予約できる治療メニューがありません。' }]);
    return;
  }
  const columns = treatments.slice(0, 10).map(t => ({
    title: t.name.substring(0, 40), text: `所要時間: ${t.duration}分`,
    actions: [{ type: 'postback', label: '選択する', data: `action=select_treatment&treatment_id=${t.id}&ts=${Date.now()}` }],
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: '治療メニューを選択してください', template: { type: 'carousel', columns } }]);
}

async function handleTreatmentSelect(replyToken, treatmentId, patient) {
  const { data: setting } = await supabase
    .from('clinic_settings')
    .select('value')
    .eq('key', 'open_days')
    .single();

  const openDays = setting ? JSON.parse(setting.value) : [1,2,3,4,5,6];
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (openDays.includes(d.getDay())) dates.push(d.toISOString().split('T')[0]);
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
  const res  = await fetch(`${BACKEND_URL}/api/appointments/available-slots/${date}`);
  const data = await res.json();
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

  const { data: t } = await supabase.from('treatments').select('*').eq('id', treatmentId).single();
  await replyMessage(replyToken, [{
    type: 'template', altText: '予約内容の確認',
    template: {
      type: 'confirm',
      text: `以下で予約しますか？\n\n${formatDateJP(date)}\n${time}〜\n${t.name}（${t.duration}分）`,
      actions: [
        { type: 'postback', label: '予約する', data: `action=confirm_booking&treatment_id=${treatmentId}&date=${date}&time=${time}&ts=${Date.now()}` },
        { type: 'postback', label: 'やり直す', data: 'action=restart' },
      ],
    },
  }]);
}

async function handleConfirmBooking(replyToken, lineUserId, data, patient) {
  if (!patient) return;
  const treatmentId = data.get('treatment_id');
  const date        = data.get('date');
  const time        = data.get('time');

  try {
    const { data: t } = await supabase.from('treatments').select('*').eq('id', treatmentId).single();
    if (!t) {
      await pushMessage(lineUserId, [{ type: 'text', text: '治療メニューの取得に失敗しました。お電話でご予約ください。' }]);
      return;
    }
    const endTime = addMinutes(time, t.duration);

    // 空きチェアを取得
    const { data: bookedChairs } = await supabase
      .from('appointments')
      .select('chair_id')
      .eq('appointment_date', date)
      .eq('status', 'confirmed')
      .lt('start_time', endTime)
      .gt('end_time', time);

    const bookedChairIds = bookedChairs?.map(a => a.chair_id) || [];
    const { data: chairs } = await supabase
      .from('chairs')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order');

    const availableChair = chairs?.find(c => !bookedChairIds.includes(c.id));
    if (!availableChair) {
      await pushMessage(lineUserId, [{ type: 'text', text: `申し訳ございません。${formatDateJP(date)} ${time}〜 は満員です。\n他の日時をお選びいただくか、お電話でご相談ください。` }]);
      return;
    }

    // 空きスタッフを取得
    const { data: bookedStaff } = await supabase
      .from('appointments')
      .select('staff_id')
      .eq('appointment_date', date)
      .eq('status', 'confirmed')
      .lt('start_time', endTime)
      .gt('end_time', time);

    const bookedStaffIds = bookedStaff?.map(a => a.staff_id) || [];
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, name')
      .eq('is_active', true)
      .eq('role', 'doctor')
      .order('id');

    let availableStaff = staffList?.find(s => !bookedStaffIds.includes(s.id));
    if (!availableStaff) {
      const { data: anyStaff } = await supabase
        .from('staff')
        .select('id, name')
        .eq('is_active', true)
        .order('id');
      availableStaff = anyStaff?.find(s => !bookedStaffIds.includes(s.id));
    }

    if (!availableStaff) {
      await pushMessage(lineUserId, [{ type: 'text', text: `申し訳ございません。${formatDateJP(date)} ${time}〜 は担当スタッフが空いておりません。\n他の日時をお選びいただくか、お電話でご相談ください。` }]);
      return;
    }

    // 予約登録
    await supabase.from('appointments').insert({
      patient_id: patient.id, staff_id: availableStaff.id, chair_id: availableChair.id,
      treatment_id: parseInt(treatmentId), appointment_date: date, start_time: time, end_time: endTime,
      status: 'confirmed', source: 'line', patient_name: patient.name, patient_phone: patient.phone,
    });

    await pushMessage(lineUserId, [{
      type: 'text',
      text: `予約が完了しました！\n\n${formatDateJP(date)}\n${time}〜\n${t.name}\n担当: ${availableStaff.name}\n\n前日にリマインドをお送りします。ご来院をお待ちしております`,
    }]);
  } catch (err) {
    console.error('予約確定エラー:', err);
    await pushMessage(lineUserId, [{ type: 'text', text: '予約の確定に失敗しました。お電話でご予約ください。' }]);
  }
}

async function startCancelFlow(replyToken, patient) {
  if (!patient) {
    await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。受付で発行したQRコードを読み取ってください。' }]);
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, appointment_date, start_time, treatments(name)')
    .eq('patient_id', patient.id)
    .eq('status', 'confirmed')
    .gte('appointment_date', today)
    .order('appointment_date')
    .limit(3);

  if (!appts?.length) {
    await replyMessage(replyToken, [{ type: 'text', text: 'キャンセルできる予約がありません。' }]);
    return;
  }
  const actions = appts.map(appt => ({
    type: 'postback',
    label: `${formatDateJP(appt.appointment_date)} ${appt.start_time.substring(0,5)}`,
    data: `action=cancel_appointment&appointment_id=${appt.id}&ts=${Date.now()}`,
  }));
  await replyMessage(replyToken, [{ type: 'template', altText: 'キャンセルする予約を選択', template: { type: 'buttons', text: 'キャンセルする予約を選択してください', actions } }]);
}

async function handleCancelAppointment(replyToken, appointmentId, patient) {
  try {
    await supabase.from('appointments').update({
      status: 'cancelled', cancelled_by: 'patient',
      cancel_reason: 'LINEからキャンセル', updated_at: new Date().toISOString(),
    }).eq('id', appointmentId);
    await replyMessage(replyToken, [{ type: 'text', text: '予約をキャンセルしました。またのご来院をお待ちしております。' }]);
  } catch (err) {
    console.error('キャンセルエラー:', err);
    await replyMessage(replyToken, [{ type: 'text', text: 'キャンセルに失敗しました。お電話でご連絡ください。' }]);
  }
}

async function showUpcomingAppointments(replyToken, patient) {
  if (!patient) { await replyMessage(replyToken, [{ type: 'text', text: '患者登録が必要です。' }]); return; }
  const today = new Date().toISOString().split('T')[0];
  const { data: appts } = await supabase
    .from('appointments')
    .select('appointment_date, start_time, treatments(name), staff(name)')
    .eq('patient_id', patient.id)
    .eq('status', 'confirmed')
    .gte('appointment_date', today)
    .order('appointment_date')
    .limit(3);

  if (!appts?.length) { await replyMessage(replyToken, [{ type: 'text', text: '現在ご予約はありません。' }]); return; }
  const text = appts.map(a =>
    `${formatDateJP(a.appointment_date)}\n${a.start_time.substring(0,5)} ${a.treatments?.name}\nDr.${a.staff?.name}`
  ).join('\n\n');
  await replyMessage(replyToken, [{ type: 'text', text: `ご予約一覧\n\n${text}` }]);
}

// ============================================================
// 年代設定
// ============================================================
async function handleSetAgeGroup(replyToken, lineUserId, range) {
  const rangeMap = {
    young:  [['10代','10代'],['20代','20代'],['30代','30代']],
    middle: [['40代','40代'],['50代','50代']],
    senior: [['60代','60代'],['70代','70代']],
    elder:  [['80代','80代'],['90代以上','90代以上']],
  };
  const ages = rangeMap[range] || rangeMap.young;
  await replyMessage(replyToken, [{
    type: 'template', altText: '年代を選択してください',
    template: {
      type: 'buttons', text: '年代を選択してください',
      actions: ages.map(([label, ag]) => ({ type: 'postback', label, data: `action=set_age_detail&age_group=${ag}` })),
    },
  }]);
}

async function handleSetAgeDetail(replyToken, lineUserId, ageGroup) {
  const patient = await getPatientByLineId(lineUserId);
  if (!patient) return;
  await supabase.from('patients').update({ age_group: ageGroup, updated_at: new Date().toISOString() }).eq('id', patient.id);
  await replyMessage(replyToken, [{ type: 'text', text: `ありがとうございます！\n\n「予約する」から診察の予約ができます\nご来院をお待ちしております` }]);
}

// ============================================================
// ユーティリティ
// ============================================================
async function getPatientByLineId(lineUserId) {
  if (!lineUserId) return null;
  const { data } = await supabase.from('patients').select('*').eq('line_user_id', lineUserId).single();
  return data || null;
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
