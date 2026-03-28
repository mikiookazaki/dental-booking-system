// backend/scripts/add-clinic-coords.js
require('dotenv').config()
const { Pool } = require('pg')
const https = require('https')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
})

// 座標が取れない場合は手動で固定値を使用
// 東京都渋谷区渋谷1-24-4 の座標（Google Mapsで確認済み）
const FALLBACK_LAT = 35.6591
const FALLBACK_LNG = 139.7006
const ADDRESS = '東京都渋谷区渋谷1-24-4'

function geocode(query) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query)
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?format=json&q=${encoded}&limit=1&accept-language=ja&countrycodes=jp`,
      method: 'GET',
      headers: {
        'User-Agent': 'SmileDental/1.0',
        'Accept': 'application/json',
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.length > 0) {
            resolve({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) })
          } else {
            resolve(null)
          }
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

async function main() {
  console.log('🦷 クリニック座標をDBに登録します')
  console.log(`📍 住所: ${ADDRESS}`)
  console.log('🌐 ジオコーディング中...')

  // 複数の形式で試みる
  let coords = null
  const queries = [
    '渋谷区渋谷1-24-4',
    'Shibuya 1-24-4, Shibuya-ku, Tokyo',
    '東京都渋谷区渋谷',
  ]

  for (const q of queries) {
    console.log(`  試行: ${q}`)
    coords = await geocode(q)
    if (coords) {
      console.log(`✅ 座標取得成功: 緯度 ${coords.lat}, 経度 ${coords.lng}`)
      break
    }
  }

  // 全て失敗したらフォールバック座標を使用
  if (!coords) {
    console.log(`⚠️  ジオコーディング失敗。フォールバック座標を使用します。`)
    console.log(`   緯度: ${FALLBACK_LAT}, 経度: ${FALLBACK_LNG}`)
    coords = { lat: FALLBACK_LAT, lng: FALLBACK_LNG }
  }

  const client = await pool.connect()
  try {
    await client.query(`
      INSERT INTO clinic_settings (key, value, description)
      VALUES
        ('clinic_address', $1, 'クリニック住所'),
        ('clinic_lat',     $2, 'クリニック緯度'),
        ('clinic_lng',     $3, 'クリニック経度')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [ADDRESS, String(coords.lat), String(coords.lng)])

    const result = await client.query(`
      SELECT key, value FROM clinic_settings
      WHERE key IN ('clinic_name', 'clinic_address', 'clinic_lat', 'clinic_lng')
      ORDER BY key
    `)

    console.log('\n📊 DB登録結果:')
    console.table(result.rows)
    console.log('🎉 完了！ダッシュボードの地域マップを再読み込みしてください。')

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('致命的エラー:', err.message)
  process.exit(1)
})
