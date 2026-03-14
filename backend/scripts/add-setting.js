require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
p.query(
  "INSERT INTO clinic_settings(key,value,description) VALUES('has_lunch_break','true','昼休みあり') ON CONFLICT(key) DO NOTHING"
).then(() => {
  console.log('OK');
  p.end();
});