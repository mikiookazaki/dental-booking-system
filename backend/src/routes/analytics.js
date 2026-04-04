const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/analytics/age
// 年代別分析データを返す（スタッフ・管理者共通）
router.get('/age', requireAuth, async (req, res) => {
  try {
    const thisMonth = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    })();
    const lastMonth = (() => {
      const d = new Date(); d.setMonth(d.getMonth()-1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    })();

    // 年代別患者数（性別クロス）
    const ageGroups = await pool.query(`
      SELECT
        CASE
          WHEN age_group IS NOT NULL AND age_group != '' THEN age_group
          WHEN birth_date IS NOT NULL THEN
            CONCAT(FLOOR(DATE_PART('year',AGE(birth_date))/10)*10,'代')
          ELSE '不明'
        END AS age_group,
        COUNT(*) AS count,
        COUNT(CASE WHEN gender='male'   THEN 1 END) AS male,
        COUNT(CASE WHEN gender='female' THEN 1 END) AS female
      FROM patients WHERE is_active=TRUE
      GROUP BY 1 ORDER BY 1
    `);

    // 月別予約数（予約経路別・過去12ヶ月）
    const monthly = await pool.query(`
      SELECT
        TO_CHAR(appointment_date,'YYYY-MM') AS month,
        COUNT(*) AS total,
        COUNT(CASE WHEN source='line'  THEN 1 END) AS line,
        COUNT(CASE WHEN source='phone' THEN 1 END) AS phone,
        COUNT(CASE WHEN source='staff' THEN 1 END) AS staff
      FROM appointments
      WHERE status='confirmed'
        AND appointment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1
    `);

    // 曜日別予約数（過去3ヶ月）
    const dowStats = await pool.query(`
      SELECT EXTRACT(DOW FROM appointment_date) AS dow, COUNT(*) AS count
      FROM appointments
      WHERE status='confirmed' AND appointment_date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY 1 ORDER BY 1
    `);

    // 時間帯別予約数（過去3ヶ月）
    const hourStats = await pool.query(`
      SELECT EXTRACT(HOUR FROM start_time::time) AS hour, COUNT(*) AS count
      FROM appointments
      WHERE status='confirmed' AND appointment_date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY 1 ORDER BY 1
    `);

    // 年代×治療クロス集計（過去6ヶ月）
    const crossTab = await pool.query(`
      SELECT
        COALESCE(NULLIF(p.age_group,''),
          CASE WHEN p.birth_date IS NOT NULL
               THEN CONCAT(FLOOR(DATE_PART('year',AGE(p.birth_date))/10)*10,'代')
               ELSE '不明' END
        ) AS age_group,
        t.name AS treatment,
        COUNT(*) AS count
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN treatments t ON a.treatment_id = t.id
      WHERE a.status='confirmed'
        AND a.appointment_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1,2 ORDER BY 1,3 DESC
    `);

    // LINE連携率
    const lineStats = await pool.query(`
      SELECT COUNT(*) AS total,
        COUNT(CASE WHEN line_user_id IS NOT NULL THEN 1 END) AS linked
      FROM patients WHERE is_active=TRUE
    `);

    // 今月 vs 先月
    const [thisM, lastM, newP] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM appointments WHERE TO_CHAR(appointment_date,'YYYY-MM')=$1 AND status='confirmed'`, [thisMonth]),
      pool.query(`SELECT COUNT(*) FROM appointments WHERE TO_CHAR(appointment_date,'YYYY-MM')=$1 AND status='confirmed'`, [lastMonth]),
      pool.query(`SELECT COUNT(*) FROM patients WHERE TO_CHAR(created_at,'YYYY-MM')=$1 AND is_active=TRUE`, [thisMonth]),
    ]);

    // 流入チャネル集計
    const referralResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(referral_source,''), 'その他') AS source,
        COUNT(*) AS count
      FROM patients
      WHERE is_active = TRUE
      GROUP BY 1
      ORDER BY 2 DESC
    `);

    // 郵便番号別患者数（来院地域マップ用）
    const postalResult = await pool.query(`
      SELECT
        postal_code,
        COUNT(*) AS count
      FROM patients
      WHERE is_active = TRUE
        AND postal_code IS NOT NULL
        AND postal_code != ''
      GROUP BY postal_code
      ORDER BY count DESC
    `);

    // クリニック情報（clinic_settings から取得）
    let clinicLocation = { name: 'スマイル歯科', address: '', lat: null, lng: null };
    try {
      const clinicSettings = await pool.query(`
        SELECT key, value FROM clinic_settings
        WHERE key IN ('clinic_address', 'clinic_lat', 'clinic_lng', 'clinic_name')
      `);
      const clinicMap = {};
      clinicSettings.rows.forEach(r => { clinicMap[r.key] = r.value });
      clinicLocation = {
        name:    clinicMap.clinic_name    || 'スマイル歯科',
        address: clinicMap.clinic_address || '',
        lat:     clinicMap.clinic_lat     ? parseFloat(clinicMap.clinic_lat)  : null,
        lng:     clinicMap.clinic_lng     ? parseFloat(clinicMap.clinic_lng) : null,
      };
    } catch (e) {
      console.warn('clinicLocation取得エラー（無視）:', e.message);
    }

    res.json({
      ageGroups:   ageGroups.rows,
      monthly:     monthly.rows,
      dowStats:    dowStats.rows,
      hourStats:   hourStats.rows,
      crossTab:    crossTab.rows,
      referralSources: referralResult.rows,
      postalCounts:    postalResult.rows,
      lineStats:   lineStats.rows[0],
      thisMonthAppts: parseInt(thisM.rows[0].count),
      lastMonthAppts: parseInt(lastM.rows[0].count),
      newPatientsMonth: parseInt(newP.rows[0].count),
      clinicLocation,
    });
  } catch (err) {
    console.error('analytics/age error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});


// ─────────────────────────────────────────────────────────
// GET /api/analytics/churn?months=3
// 離脱リスク患者一覧
// ─────────────────────────────────────────────────────────
router.get('/churn', requireAuth, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3
    const isTest = req.isTestMode

    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, patient_code, name, last_visit_date, line_user_id, age_group, gender, total_visits')
      .eq('is_active', true)
      .eq('is_test', isTest)
      .not('last_visit_date', 'is', null)
      .lte('last_visit_date', cutoffStr)
      .order('last_visit_date', { ascending: true })
      .limit(200)

    if (error) throw error

    const today = new Date()
    const result = (patients || []).map(p => {
      const lastVisit  = new Date(p.last_visit_date)
      const diffMs     = today - lastVisit
      const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30))
      return { ...p, months_since_visit: diffMonths }
    })

    res.json({ patients: result, count: result.length, cutoff_date: cutoffStr, months })
  } catch (err) {
    console.error('analytics/churn error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────
// POST /api/analytics/churn/send
// 離脱リスク患者にLINEメッセージ送信
// ─────────────────────────────────────────────────────────
router.post('/churn/send', requireAuth, async (req, res) => {
  const { patient_ids, message_text, is_test } = req.body
  if (!patient_ids?.length) return res.status(400).json({ error: '送信対象が指定されていません' })
  if (!message_text?.trim()) return res.status(400).json({ error: 'メッセージ本文は必須です' })

  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { pushMessage } = require('./line')
  const isTest = is_test === true

  const results = { sent: 0, failed: 0, no_line: 0 }

  try {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, line_user_id')
      .in('id', patient_ids)
      .eq('is_test', isTest)

    for (const patient of patients || []) {
      if (!patient.line_user_id) { results.no_line++; continue }
      try {
        await pushMessage(patient.line_user_id, [{
          type: 'flex',
          altText: patient.name + '様へのご連絡',
          contents: {
            type: 'bubble',
            header: {
              type: 'box', layout: 'vertical',
              backgroundColor: '#2563eb', paddingAll: '16px',
              contents: [{ type: 'text', text: 'スマイル歯科からのご連絡', color: '#ffffff', size: 'sm', weight: 'bold' }],
            },
            body: {
              type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
              contents: [
                { type: 'text', text: patient.name + ' 様', size: 'sm', weight: 'bold', color: '#1f2937' },
                { type: 'separator', margin: 'sm' },
                { type: 'text', text: message_text, size: 'sm', color: '#374151', wrap: true, margin: 'sm' },
              ],
            },
            footer: {
              type: 'box', layout: 'vertical', paddingAll: '12px',
              contents: [
                {
                  type: 'button',
                  action: { type: 'uri', label: '予約する', uri: 'https://line.me/R/ti/p/' + (process.env.LINE_BOT_BASIC_ID || '@210vmmzk') },
                  style: 'primary', color: '#2563eb', height: 'sm',
                },
                { type: 'text', text: 'スマイル歯科', size: 'xs', color: '#9ca3af', align: 'center', margin: 'sm' },
              ],
            },
          },
        }])
        await supabase.from('reminder_logs').insert({
          patient_id: patient.id, reminder_type: 'churn_alert',
          status: 'sent', error_message: '離脱防止フォロー',
        })
        results.sent++
      } catch (err) {
        await supabase.from('reminder_logs').insert({
          patient_id: patient.id, reminder_type: 'churn_alert',
          status: 'failed', error_message: err.message,
        })
        results.failed++
      }
      await new Promise(r => setTimeout(r, 50))
    }
    res.json({ success: true, results })
  } catch (err) {
    console.error('churn/send error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router;
