// routes/analytics.js （Supabase移行版）
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.get('/age', requireAuth, async (req, res) => {
  try {
    const isTest = req.isTestMode;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const lastMonthDate = new Date(now); lastMonthDate.setMonth(now.getMonth()-1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;

    // 患者データ取得
    const { data: patients } = await supabase
      .from('patients')
      .select('age_group, birth_date, gender, line_user_id, referral_source, postal_code, created_at')
      .eq('is_active', true)
      .eq('is_test', isTest);

    // 年代別集計
    const ageMap = {};
    patients.forEach(p => {
      let ag = p.age_group || '不明';
      if ((!p.age_group || p.age_group === '') && p.birth_date) {
        const age = Math.floor((new Date() - new Date(p.birth_date)) / (1000*60*60*24*365.25));
        ag = `${Math.floor(age/10)*10}代`;
      }
      if (!ageMap[ag]) ageMap[ag] = { age_group: ag, count: 0, male: 0, female: 0 };
      ageMap[ag].count++;
      if (p.gender === 'male')   ageMap[ag].male++;
      if (p.gender === 'female') ageMap[ag].female++;
    });
    const ageGroups = Object.values(ageMap).sort((a, b) => a.age_group.localeCompare(b.age_group));

    // LINE連携率
    const lineStats = {
      total:  patients.length,
      linked: patients.filter(p => p.line_user_id).length,
    };

    // 今月の新規患者
    const newPatientsMonth = patients.filter(p =>
      p.created_at && p.created_at.startsWith(thisMonth)
    ).length;

    // 流入チャネル集計
    const referralMap = {};
    patients.forEach(p => {
      const src = p.referral_source || 'その他';
      referralMap[src] = (referralMap[src] || 0) + 1;
    });
    const referralSources = Object.entries(referralMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // 郵便番号別集計
    const postalMap = {};
    patients.forEach(p => {
      if (p.postal_code) postalMap[p.postal_code] = (postalMap[p.postal_code] || 0) + 1;
    });
    const postalCounts = Object.entries(postalMap)
      .map(([postal_code, count]) => ({ postal_code, count }))
      .sort((a, b) => b.count - a.count);

    // 予約データ取得（過去12ヶ月）
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth()-12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

    const { data: appts } = await supabase
      .from('appointments')
      .select('appointment_date, start_time, source, status, patient_id, treatment_id')
      .eq('status', 'confirmed')
      .eq('is_test', isTest)
      .gte('appointment_date', twelveMonthsAgoStr);

    // 月別予約数
    const monthlyMap = {};
    appts.forEach(a => {
      const month = a.appointment_date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, total: 0, line: 0, phone: 0, staff: 0 };
      monthlyMap[month].total++;
      if (a.source === 'line')  monthlyMap[month].line++;
      if (a.source === 'phone') monthlyMap[month].phone++;
      if (a.source === 'staff') monthlyMap[month].staff++;
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // 今月・先月の予約数
    const thisMonthAppts = appts.filter(a => a.appointment_date.startsWith(thisMonth)).length;
    const lastMonthAppts = appts.filter(a => a.appointment_date.startsWith(lastMonth)).length;

    // 曜日別集計（過去3ヶ月）
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
    const recentAppts = appts.filter(a => a.appointment_date >= threeMonthsAgoStr);

    const dowMap = {};
    recentAppts.forEach(a => {
      const dow = new Date(a.appointment_date).getDay();
      dowMap[dow] = (dowMap[dow] || 0) + 1;
    });
    const dowStats = Object.entries(dowMap)
      .map(([dow, count]) => ({ dow: parseInt(dow), count }))
      .sort((a, b) => a.dow - b.dow);

    // 時間帯別集計（過去3ヶ月）
    const hourMap = {};
    recentAppts.forEach(a => {
      if (a.start_time) {
        const hour = parseInt(a.start_time.substring(0, 2));
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      }
    });
    const hourStats = Object.entries(hourMap)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);

    // 年代×治療クロス集計（過去6ヶ月）
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: crossAppts } = await supabase
      .from('appointments')
      .select('patient_id, treatment_id, appointment_date, patients(age_group, birth_date), treatments(name)')
      .eq('status', 'confirmed')
      .eq('is_test', isTest)
      .gte('appointment_date', sixMonthsAgoStr);

    const crossMap = {};
    crossAppts.forEach(a => {
      let ag = a.patients?.age_group || '不明';
      if ((!ag || ag === '') && a.patients?.birth_date) {
        const age = Math.floor((new Date() - new Date(a.patients.birth_date)) / (1000*60*60*24*365.25));
        ag = `${Math.floor(age/10)*10}代`;
      }
      const treatment = a.treatments?.name || '不明';
      const key = `${ag}__${treatment}`;
      if (!crossMap[key]) crossMap[key] = { age_group: ag, treatment, count: 0 };
      crossMap[key].count++;
    });
    const crossTab = Object.values(crossMap).sort((a, b) =>
      a.age_group.localeCompare(b.age_group) || b.count - a.count
    );

    // クリニック情報
    let clinicLocation = { name: 'スマイル歯科', address: '', lat: null, lng: null };
    try {
      const { data: clinicSettings } = await supabase
        .from('clinic_settings')
        .select('key, value')
        .in('key', ['clinic_address', 'clinic_lat', 'clinic_lng', 'clinic_name']);

      const clinicMap = {};
      clinicSettings.forEach(r => { clinicMap[r.key] = r.value; });
      clinicLocation = {
        name:    clinicMap.clinic_name    || 'スマイル歯科',
        address: clinicMap.clinic_address || '',
        lat:     clinicMap.clinic_lat     ? parseFloat(clinicMap.clinic_lat)  : null,
        lng:     clinicMap.clinic_lng     ? parseFloat(clinicMap.clinic_lng)  : null,
      };
    } catch (e) {
      console.warn('clinicLocation取得エラー:', e.message);
    }

    res.json({
      ageGroups, monthly, dowStats, hourStats, crossTab,
      referralSources, postalCounts, lineStats,
      thisMonthAppts, lastMonthAppts, newPatientsMonth,
      clinicLocation,
    });
  } catch (err) {
    console.error('analytics/age error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ダッシュボード用サマリー
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const isTest = req.isTestMode;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const lastMonthDate = new Date(now); lastMonthDate.setMonth(now.getMonth()-1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;

    const { data: appts } = await supabase
      .from('appointments')
      .select('appointment_date, status, source, treatment_id, staff_id, chair_id, treatments(name), staff(name)')
      .eq('is_test', isTest)
      .gte('appointment_date', `${lastMonth}-01`);

    const thisMonthAppts  = appts.filter(a => a.appointment_date.startsWith(thisMonth));
    const lastMonthAppts  = appts.filter(a => a.appointment_date.startsWith(lastMonth));
    const confirmed       = thisMonthAppts.filter(a => a.status === 'confirmed');
    const cancelled       = thisMonthAppts.filter(a => a.status === 'cancelled');

    // 治療別集計
    const treatMap = {};
    confirmed.forEach(a => {
      const name = a.treatments?.name || '不明';
      treatMap[name] = (treatMap[name] || 0) + 1;
    });
    const byTreatment = Object.entries(treatMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // スタッフ別集計
    const staffMap = {};
    confirmed.forEach(a => {
      const name = a.staff?.name || '不明';
      if (!staffMap[name]) staffMap[name] = { name, count: 0, cancelled: 0 };
      staffMap[name].count++;
    });
    cancelled.forEach(a => {
      const name = a.staff?.name || '不明';
      if (!staffMap[name]) staffMap[name] = { name, count: 0, cancelled: 0 };
      staffMap[name].cancelled++;
    });
    const byStaff = Object.values(staffMap).sort((a, b) => b.count - a.count);

    // 日別予約数（今月）
    const dayMap = {};
    thisMonthAppts.forEach(a => {
      const day = parseInt(a.appointment_date.substring(8, 10));
      if (!dayMap[day]) dayMap[day] = { day, count: 0 };
      if (a.status !== 'cancelled') dayMap[day].count++;
    });
    const byDay = Object.values(dayMap).sort((a, b) => a.day - b.day);

    res.json({
      total:        thisMonthAppts.length,
      confirmed:    confirmed.length,
      cancelled:    cancelled.length,
      cancelRate:   thisMonthAppts.length > 0
        ? Math.round(cancelled.length / thisMonthAppts.length * 100)
        : 0,
      lastMonthTotal: lastMonthAppts.filter(a => a.status !== 'cancelled').length,
      byTreatment,
      byStaff,
      byDay,
    });
  } catch (err) {
    console.error('analytics/summary error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;