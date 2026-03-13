/**
 * LINEリッチメニュー 自動作成スクリプト
 *
 * 使い方:
 *   cd backend
 *   npm install canvas
 *   node scripts/createRichMenu.js
 */

require('dotenv').config();
const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const API_HEADERS  = {
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'Content-Type':  'application/json',
};

// ── DBから医院設定を取得 ──────────────────────────────────
async function getClinicSettings() {
  const db     = require('../src/config/database');
  const result = await db.query('SELECT key, value FROM clinic_settings');
  const settings = {};
  result.rows.forEach(row => { settings[row.key] = row.value; });
  return settings;
}

// ── メニューボタンの定義（電話番号はDBから取得） ──────────
function buildButtons(clinicPhone) {
  return [
    { icon: '📅', label: '予約する',       action: { type: 'message', text: '予約' },             col: 0, row: 0 },
    { icon: '🔍', label: '予約確認',       action: { type: 'message', text: '予約確認' },          col: 1, row: 0 },
    { icon: '❌', label: 'キャンセル',     action: { type: 'message', text: 'キャンセル' },        col: 2, row: 0 },
    { icon: '🏥', label: 'クリニック情報', action: { type: 'message', text: 'クリニック情報' },    col: 0, row: 1 },
    { icon: '📞', label: '電話する',       action: { type: 'uri',     uri: `tel:${clinicPhone}` }, col: 1, row: 1 },
    { icon: '❓', label: 'よくある質問',   action: { type: 'message', text: 'よくある質問' },      col: 2, row: 1 },
  ];
}

// ── 画像生成 ─────────────────────────────────────────────
function generateImage(buttons) {
  const W = 2500, H = 843;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const cellW  = W / 3;
  const cellH  = H / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  buttons.forEach(({ icon, label, col, row }) => {
    const x = col * cellW;
    const y = row * cellH;

    ctx.fillStyle = row === 0 ? '#f7fff7' : '#ffffff';
    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth   = 3;
    ctx.strokeRect(x, y, cellW, cellH);

    ctx.font         = '160px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#333333';
    ctx.fillText(icon, x + cellW / 2, y + cellH * 0.42);

    ctx.font      = 'bold 80px sans-serif';
    ctx.fillStyle = '#333333';
    ctx.fillText(label, x + cellW / 2, y + cellH * 0.78);

    if (row === 0) {
      ctx.fillStyle = '#06C755';
      ctx.fillRect(x + 40, y + cellH - 12, cellW - 80, 8);
    }
  });

  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth   = 6;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  const outputPath = path.join(__dirname, 'richmenu.png');
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`✅ 画像生成完了: ${outputPath} (${W}x${H}px)`);
  return outputPath;
}

// ── LINE API: リッチメニュー構造を作成 ───────────────────
async function createRichMenuStructure(buttons) {
  const W = 2500, H = 843;
  const cellW = Math.floor(W / 3);
  const cellH = Math.floor(H / 2);

  const areas = buttons.map(({ action, col, row }) => ({
    bounds: { x: col * cellW, y: row * cellH, width: cellW, height: cellH },
    action,
  }));

  const res  = await fetch('https://api.line.me/v2/bot/richmenu', {
    method:  'POST',
    headers: API_HEADERS,
    body:    JSON.stringify({
      size:        { width: W, height: H },
      selected:    true,
      name:        'スマイル歯科メニュー',
      chatBarText: 'メニュー',
      areas,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`リッチメニュー作成失敗: ${JSON.stringify(data)}`);
  console.log(`✅ リッチメニュー構造作成: ${data.richMenuId}`);
  return data.richMenuId;
}

// ── LINE API: 画像アップロード ────────────────────────────
async function uploadImage(richMenuId, imagePath) {
  const res = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'image/png' },
      body:    fs.readFileSync(imagePath),
    }
  );
  if (!res.ok) throw new Error(`画像アップロード失敗: ${await res.text()}`);
  console.log('✅ 画像アップロード完了');
}

// ── LINE API: デフォルトメニューに設定 ───────────────────
async function setAsDefault(richMenuId) {
  const res = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    { method: 'POST', headers: API_HEADERS }
  );
  if (!res.ok) throw new Error(`デフォルト設定失敗: ${await res.text()}`);
  console.log('✅ 全ユーザーのデフォルトメニューに設定完了');
}

// ── LINE API: 既存メニューを削除 ─────────────────────────
async function deleteExistingMenus() {
  const res  = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: API_HEADERS });
  const data = await res.json();
  for (const menu of (data.richmenus || [])) {
    await fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
      method: 'DELETE', headers: API_HEADERS,
    });
    console.log(`🗑️  既存メニュー削除: ${menu.richMenuId}`);
  }
}

// ── メイン ───────────────────────────────────────────────
async function main() {
  if (!ACCESS_TOKEN) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
    console.error('   backend/.env を確認してください');
    process.exit(1);
  }

  console.log('🦷 スマイル歯科 LINEリッチメニュー作成開始\n');

  console.log('📋 医院設定をDBから取得中...');
  const settings    = await getClinicSettings();
  const clinicPhone = settings.clinic_tel;
  if (!clinicPhone) {
    console.error('❌ 管理画面の医院設定に電話番号(clinic_tel)が登録されていません');
    process.exit(1);
  }
  console.log(`✅ 電話番号取得: ${clinicPhone}\n`);

  const buttons = buildButtons(clinicPhone);

  await deleteExistingMenus();
  const imagePath  = generateImage(buttons);
  const richMenuId = await createRichMenuStructure(buttons);
  await uploadImage(richMenuId, imagePath);
  await setAsDefault(richMenuId);

  console.log('\n🎉 完了！LINEアプリでメニューを確認してください。');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
