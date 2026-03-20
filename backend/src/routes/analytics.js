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
    });
  } catch (err) {
    console.error('analytics/age error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
