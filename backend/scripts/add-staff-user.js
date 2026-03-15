// scripts/add-staff-user.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addStaffUser() {
  const username = 'staff';
  const password = 'dental2026';

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(`
      INSERT INTO admin_users (username, password_hash, role, is_active)
      VALUES ($1, $2, 'staff', TRUE)
      ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = 'staff'
    `, [username, hash]);
    console.log('✅ スタッフユーザー作成完了');
    console.log(`   ユーザー名: ${username}`);
    console.log(`   パスワード: ${password}`);
  } catch (err) {
    console.error('❌ エラー:', err.message);
  } finally {
    await pool.end();
  }
}

addStaffUser();
