require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const tables = ['chairs', 'treatments', 'blocked_slots', 'blocked_slot_chairs', 'booking_blocks', 'line_inquiry_sessions', 'admin_users'];

async function main() {
  for (const table of tables) {
    const r = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = '${table}'
      ORDER BY ordinal_position
    `);
    console.log(`\n=== ${table} ===`);
    r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`));
  }
  pool.end();
}

main().catch(console.error);