// scripts/load-sample-data.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function loadSampleData() {
  console.log('📦 サンプルデータ投入開始...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'sample-data.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ サンプルデータ投入完了');
    console.log('   患者: 15名追加');
    console.log('   予約: 3月〜4月 約80件追加');
  } catch (err) {
    console.error('❌ エラー:', err.message);
  } finally {
    await pool.end();
  }
}

loadSampleData();
