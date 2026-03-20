require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  console.log('地図サンプルデータ投入開始...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'add-map-sample-data.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ 完了: 郵便番号・来院きっかけ・追加患者30名を登録しました');
  } catch (err) { console.error('エラー:', err.message); }
  finally { await pool.end(); }
}
run();
