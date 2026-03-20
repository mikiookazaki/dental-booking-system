// scripts/update-sample-patients.js
// 郵便番号・来院きっかけのサンプルデータを更新
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('サンプルデータ更新開始...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'update-sample-data.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ 完了: 郵便番号・来院きっかけを更新しました');
  } catch (err) {
    console.error('エラー:', err.message);
  } finally {
    await pool.end();
  }
}
run();
