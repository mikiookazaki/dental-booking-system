// routes/patients.js （Supabase移行版）
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function isValidKana(str) {
  return /^[ァ-ヶー　\s]+$/.test(str);
}

function calcAgeGroup(birthDate) {
  if (!birthDate) return null;
  const age = Math.floor((new Date() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 365.25));
  const decade = Math.floor(age / 10) * 10;
  return decade >= 90 ? '90代以上' : `${decade}代`;
}

// GET /api/patients
router.get('/', requireAuth, async (req, res) => {
  try {
    const search = req.query.q || req.query.search || '';

    let query = supabase
      .from('patients')
      .select('id, patient_code, name, name_kana, phone, email, birth_date, gender, address, notes, age_group, postal_code, referral_source, line_user_id, total_visits, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,phone.ilike.%${search}%,patient_code.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ patients: data });
  } catch (err) {
    console.error('GET patients error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// GET /api/patients/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: '患者が見つかりません' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// GET /api/patients/:id/qr
router.get('/:id/qr', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, patient_code, name, name_kana, line_user_id')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: '患者が見つかりません' });

    const lineId = process.env.LINE_BOT_BASIC_ID || '@210vmmzk';
    const qr_url = `https://line.me/R/ti/p/${lineId}?patientCode=${data.patient_code}`;
    res.json({
      id: data.id, patient_code: data.patient_code,
      name: data.name, name_kana: data.name_kana,
      line_linked: !!data.line_user_id, qr_url,
    });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// POST /api/patients
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, birth_date, gender, address, notes, age_group, postal_code, referral_source } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '氏名は必須です' });
    if (!name_kana?.trim()) return res.status(400).json({ error: 'フリガナは必須です' });
    if (!isValidKana(name_kana.trim())) return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });

    const finalAgeGroup = birth_date ? calcAgeGroup(birth_date) : (age_group || null);

    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: name.trim(), name_kana: name_kana.trim(),
        phone, email, birth_date, gender, address, notes,
        age_group: finalAgeGroup,
        postal_code: postal_code || null,
        referral_source: referral_source || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST patient error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// PUT /api/patients/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, name_kana, phone, email, birth_date, gender, address, notes, age_group, postal_code, referral_source } = req.body;
    if (name !== undefined && !name?.trim()) return res.status(400).json({ error: '氏名は必須です' });
    if (name_kana !== undefined) {
      if (!name_kana?.trim()) return res.status(400).json({ error: 'フリガナは必須です' });
      if (!isValidKana(name_kana.trim())) return res.status(400).json({ error: 'フリガナはカタカナで入力してください' });
    }

    const finalAgeGroup = birth_date ? calcAgeGroup(birth_date) : age_group;

    const updateData = { updated_at: new Date().toISOString() };
    if (name !== undefined)            updateData.name            = name.trim();
    if (name_kana !== undefined)       updateData.name_kana       = name_kana.trim();
    if (phone !== undefined)           updateData.phone           = phone;
    if (email !== undefined)           updateData.email           = email;
    if (birth_date !== undefined)      updateData.birth_date      = birth_date;
    if (gender !== undefined)          updateData.gender          = gender;
    if (address !== undefined)         updateData.address         = address;
    if (notes !== undefined)           updateData.notes           = notes;
    if (finalAgeGroup !== undefined)   updateData.age_group       = finalAgeGroup;
    if (postal_code !== undefined)     updateData.postal_code     = postal_code;
    if (referral_source !== undefined) updateData.referral_source = referral_source;

    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(404).json({ error: '患者が見つかりません' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
