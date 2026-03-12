require('dotenv').config({ path: '../backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  console.log('🔌 データベースに接続中...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  
  try {
    await pool.query(sql);
    console.log('✅ データベーススキーマの作成が完了しました');
    console.log('  - テーブル数: 12');
    console.log('  - 初期データ: スタッフ5名、チェア5台、治療8種、患者3名');
  } catch (err) {
    console.error('❌ エラー:', err.message);
  } finally {
    await pool.end();
  }
}

initDB();