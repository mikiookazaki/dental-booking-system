require('dotenv').config();
const { Pool } = require('pg');

// Render（移行元）
const renderPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Supabase（移行先）
const supabasePool = new Pool({
  connectionString: 'postgresql://postgres.wykknbftyjesazexagir:%2CtV%21VM53%2BAGz36y@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('データ移行開始...');
  try {

    // chairs
    const chairs = await renderPool.query('SELECT * FROM chairs ORDER BY id');
    for (const row of chairs.rows) {
      await supabasePool.query(
        'INSERT INTO chairs (id, name, display_order, line_bookable, note, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.display_order, row.line_bookable, row.note, row.is_active, row.created_at]
      );
    }
    console.log('chairs: ' + chairs.rows.length + '件');

    // treatments
    const treatments = await renderPool.query('SELECT * FROM treatments ORDER BY id');
    for (const row of treatments.rows) {
      await supabasePool.query(
        'INSERT INTO treatments (id, name, name_en, duration, category, assignable_roles, price, color, is_active, line_visible, display_order, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.name_en, row.duration, row.category, row.assignable_roles, row.price, row.color, row.is_active, row.line_visible, row.display_order, row.created_at]
      );
    }
    console.log('treatments: ' + treatments.rows.length + '件');

    // blocked_slots
    const blockedSlots = await renderPool.query('SELECT * FROM blocked_slots ORDER BY id');
    for (const row of blockedSlots.rows) {
      await supabasePool.query(
        'INSERT INTO blocked_slots (id, block_date, start_time, end_time, affects_all, reason, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
        [row.id, row.block_date, row.start_time, row.end_time, row.affects_all, row.reason, row.created_by, row.created_at]
      );
    }
    console.log('blocked_slots: ' + blockedSlots.rows.length + '件');

    // blocked_slot_chairs
    const blockedChairs = await renderPool.query('SELECT * FROM blocked_slot_chairs');
    for (const row of blockedChairs.rows) {
      await supabasePool.query(
        'INSERT INTO blocked_slot_chairs (blocked_slot_id, chair_id) VALUES ($1,$2) ON CONFLICT (blocked_slot_id, chair_id) DO NOTHING',
        [row.blocked_slot_id, row.chair_id]
      );
    }
    console.log('blocked_slot_chairs: ' + blockedChairs.rows.length + '件');

    // booking_blocks
    const bookingBlocks = await renderPool.query('SELECT * FROM booking_blocks ORDER BY id');
    for (const row of bookingBlocks.rows) {
      await supabasePool.query(
        'INSERT INTO booking_blocks (id, block_date, block_type, start_time, end_time, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [row.id, row.block_date, row.block_type, row.start_time, row.end_time, row.reason, row.created_at]
      );
    }
    console.log('booking_blocks: ' + bookingBlocks.rows.length + '件');

    // line_inquiry_sessions
    const sessions = await renderPool.query('SELECT * FROM line_inquiry_sessions ORDER BY id');
    for (const row of sessions.rows) {
      await supabasePool.query(
        'INSERT INTO line_inquiry_sessions (id, line_user_id, step, data, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (line_user_id) DO NOTHING',
        [row.id, row.line_user_id, row.step, row.data, row.created_at, row.updated_at]
      );
    }
    console.log('line_inquiry_sessions: ' + sessions.rows.length + '件');

    // admin_users
    const adminUsers = await renderPool.query('SELECT * FROM admin_users ORDER BY id');
    for (const row of adminUsers.rows) {
      await supabasePool.query(
        'INSERT INTO admin_users (id, username, password_hash, role, staff_id, is_active, last_login, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
        [row.id, row.username, row.password_hash, row.role, row.staff_id, row.is_active, row.last_login, row.created_at]
      );
    }
    console.log('admin_users: ' + adminUsers.rows.length + '件');

    console.log('データ移行完了！');
  } catch (err) {
    console.error('エラー:', err.message);
  } finally {
    renderPool.end();
    supabasePool.end();
  }
}

migrate();
