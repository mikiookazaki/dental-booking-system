const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ データベース接続エラー:', err.message);
  } else {
    console.log('✅ データベースに接続しました');
    release();
  }
});

module.exports = pool;