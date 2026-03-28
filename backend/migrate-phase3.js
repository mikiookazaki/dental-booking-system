require('dotenv').config();
const { Pool } = require('pg');

// Render（移行元）
const renderPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Supabase（移行先）※パスワードを入力してください
const supabasePool = new Pool({
  connectionString: 'postgresql://postgres.wykknbftyjesazexagir:%2CtV%21VM53%2BAGz36y@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('データ移行開始...');
  try {

    // patients
    const patients = await renderPool.query('SELECT * FROM patients ORDER BY id');
    for (const row of patients.rows) {
      await supabasePool.query(
        `INSERT INTO patients (
          id, patient_code, rececon_id, data_source, mapped_at,
          name, name_kana, birth_date, gender, phone, email, address,
          insurance_number, allergies, notes, line_user_id, line_linked_at,
          first_visit, last_visit, total_visits, is_active,
          created_at, updated_at, age_group, postal_code,
          referral_source, line_inquiry_step, line_inquiry_data
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25,$26,$27,$28
        ) ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.patient_code, row.rececon_id, row.data_source, row.mapped_at,
          row.name, row.name_kana, row.birth_date, row.gender, row.phone, row.email, row.address,
          row.insurance_number, row.allergies, row.notes, row.line_user_id, row.line_linked_at,
          row.first_visit, row.last_visit, row.total_visits, row.is_active,
          row.created_at, row.updated_at, row.age_group, row.postal_code,
          row.referral_source, row.line_inquiry_step, row.line_inquiry_data
        ]
      );
    }
    console.log('patients: ' + patients.rows.length + '件');

    // appointments
    const appointments = await renderPool.query('SELECT * FROM appointments ORDER BY id');
    for (const row of appointments.rows) {
      await supabasePool.query(
        `INSERT INTO appointments (
          id, patient_id, staff_id, chair_id, treatment_id,
          appointment_date, start_time, end_time, status, source,
          patient_name, patient_phone, notes, reminder_sent, reminder_sent_at,
          cancelled_at, cancelled_by, cancel_reason,
          created_at, updated_at, treatment_color, duration_minutes, chair_number, doctor_name
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24
        ) ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.patient_id, row.staff_id, row.chair_id, row.treatment_id,
          row.appointment_date, row.start_time, row.end_time, row.status, row.source,
          row.patient_name, row.patient_phone, row.notes, row.reminder_sent, row.reminder_sent_at,
          row.cancelled_at, row.cancelled_by, row.cancel_reason,
          row.created_at, row.updated_at, row.treatment_color, row.duration_minutes, row.chair_number, row.doctor_name
        ]
      );
    }
    console.log('appointments: ' + appointments.rows.length + '件');

    // appointment_logs
    const logs = await renderPool.query('SELECT * FROM appointment_logs ORDER BY id');
    for (const row of logs.rows) {
      await supabasePool.query(
        `INSERT INTO appointment_logs (id, appointment_id, action, changed_by, changed_by_id, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.appointment_id, row.action, row.changed_by, row.changed_by_id, row.note, row.created_at]
      );
    }
    console.log('appointment_logs: ' + logs.rows.length + '件');

    console.log('データ移行完了！');
  } catch (err) {
    console.error('エラー:', err.message);
  } finally {
    renderPool.end();
    supabasePool.end();
  }
}

migrate();
