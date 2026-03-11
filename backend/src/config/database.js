const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render の本番環境では SSL が必要
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// 接続確認
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ データベース接続エラー:', err.message);
  } else {
    console.log('✅ データベースに接続しました');
    release();
  }
});

module.exports = pool;
