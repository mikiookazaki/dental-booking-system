require('dotenv').config();
const { Pool } = require('pg');

// Render（移行元）
const renderPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Supabase（移行先）
const supabasePool = new Pool({
  connectionString: 'postgresql://postgres:[YOUR-PASSWORD]@db.wykknbftyjesazexagir.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🔄 データ移行開始...');
  try {

    // clinic_settings
    const cs = await renderPool.query('SELECT * FROM clinic_settings');
    for (const row of cs.rows) {
      await supabasePool.query(
        `INSERT INTO clinic_settings (key, value, description, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $4`,
        [row.key, row.value, row.description, row.updated_at]
      );
    }
    console.log(`✅ clinic_settings: ${cs.rows.length}件`);

    // system_settings
    const ss = await renderPool.query('SELECT * FROM system_settings');
    for (const row of ss.rows) {
      await supabasePool.query(
        `INSERT INTO system_settings (key, value, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [row.key, row.value, row.created_at]
      );
    }
    console.log(`✅ system_settings: ${ss.rows.length}件`);

    // staff
    const st = await renderPool.query('SELECT * FROM staff ORDER BY id');
    for (const row of st.rows) {
      await supabasePool.query(
        `INSERT INTO staff (id, name, name_kana, role, title, color, email, phone, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET name=$2, role=$4, is_active=$9`,
        [row.id, row.name, row.name_kana, row.role, row.title, row.color, row.email, row.phone, row.is_active, row.created_at, row.updated_at]
      );
    }
    console.log(`✅ staff: ${st.rows.length}件`);

    // staff_shifts
    const shifts = await renderPool.query('SELECT * FROM staff_shifts ORDER BY id');
    for (const row of shifts.rows) {
      await supabasePool.query(
        `INSERT INTO staff_shifts (id, staff_id, work_days, start_time, end_time, break_start, break_end, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.staff_id, row.work_days, row.start_time, row.end_time, row.break_start, row.break_end, row.created_at, row.updated_at]
      );
    }
    console.log(`✅ staff_shifts: ${shifts.rows.length}件`);

    // staff_chair_assignments
    const sca = await renderPool.query('SELECT * FROM staff_chair_assi