# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

スマイル歯科クリニック予約管理システム (Dental Clinic Booking System) - a full-stack web app for managing dental appointments, integrating a LINE Messaging API bot for patient self-booking, and providing an admin dashboard for clinic staff.

**Tech Stack:**
- Frontend: React 19 + Vite 7 + Tailwind CSS 4
- Backend: Node.js + Express 4
- Database: PostgreSQL (raw `pg` queries, no ORM)
- Auth: JWT (7-day expiry, Bearer tokens)
- External: LINE Messaging API, deployed on Render

## 本番環境

- Frontend: https://dental-booking-frontend.onrender.com
- Backend: https://dental-booking-api-k2v1.onrender.com
- GitHub: https://github.com/mikiookazaki/dental-booking-system (mainブランチ)

## Commands

### Backend (`backend/`)
```bash
npm run dev     # Start dev server (nodemon, port 3001)
npm start       # Production server
npm run db:init # Initialize schema from scripts/schema.sql
```

### Frontend (`frontend/`)
```bash
npm run dev     # Vite dev server (port 5173, proxies /api -> localhost:3001)
npm run build   # Production build to dist/
npm run lint    # ESLint check
npm run preview # Preview production build
```

No test suite is currently configured.

## Architecture

### Backend Structure
Business logic lives entirely in route files - the `controllers/` directory is empty.

```
backend/src/
├── index.js              # App entry: Express setup, CORS, inline ALTER TABLE migrations
├── config/database.js    # pg connection pool (DATABASE_URL env var)
├── middleware/auth.js    # JWT verification + role guards (admin/superadmin)
└── routes/               # All business logic
    ├── appointments.js   # Booking CRUD, slot availability
    ├── patients.js       # Patient records, LINE linking
    ├── staff.js          # Profiles, shift management
    ├── line.js           # LINE webhook handler (590 LOC)
    ├── lineDebug.js      # Superadmin LINE testing interface
    ├── reminders.js      # node-cron reminder scheduling (749 LOC)
    ├── campaigns.js      # Bulk LINE messaging
    ├── analytics.js      # Stats/reporting
    ├── admin.js          # Admin management
    ├── settings.js       # Clinic config (key-value store)
    ├── auth.js           # Login, JWT issuance
    ├── treatments.js     # Treatment menu CRUD
    ├── chairs.js         # Chair/room management
    ├── blockedSlots.js   # Time blocking
    ├── followupMessages.js
    └── licenses.js
```

### Frontend Structure
```
frontend/src/
├── App.jsx               # React Router with AdminGuard / SuperAdminGuard
├── api.js                # Axios client - injects JWT + x-test-mode header
├── context/TestModeContext.jsx  # Global test mode state
├── pages/
│   ├── CalendarPage.jsx  # Main appointment calendar (~107KB, most complex page)
│   ├── PatientsPage.jsx
│   ├── StaffPage.jsx
│   └── admin/            # Login, dashboard, settings, LINE debug
└── components/
    ├── common/Sidebar.jsx
    ├── calendar/
    ├── admin/
    └── line/
```

### Authentication & Roles
- JWT stored in `localStorage` (`admin_token`, `admin_role`, `admin_name`)
- Two roles: `admin` (standard staff access), `superadmin` (full access + test mode toggle)
- `AdminGuard` / `SuperAdminGuard` components protect frontend routes

### Test Mode
- Superadmin can enable test mode; all requests add `x-test-mode: true` header
- Backend uses this flag to isolate test data from production patients/appointments
- State persisted in `localStorage` via `TestModeContext`

### Database Migrations
- Initial schema: `backend/scripts/schema.sql`
- Incremental changes: inline `ALTER TABLE IF NOT EXISTS` in `backend/src/index.js` (run on every startup)
- No migration framework - add new migrations as additional ALTER TABLE statements in `index.js`

## データベース構成

DBは2つに分かれている：

| テーブル | DB |
|---------|-----|
| patients, appointments, reminder_logs, clinic_settings, clinic_licenses, line_inquiry_sessions | Supabase |
| staff, chairs, treatments, booking_blocks | Render PostgreSQL |

## Key Environment Variables

```
# Render PostgreSQL
DATABASE_URL=postgresql://...

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# 認証
JWT_SECRET=<random>

# LINE
LINE_CHANNEL_SECRET=<from LINE Developers console>
LINE_CHANNEL_ACCESS_TOKEN=<from LINE Developers console>

# Cron
CRON_SECRET=smile-dental-cron-2026

# URL
FRONTEND_URL=http://localhost:5173
PORT=3001
BACKEND_URL=http://localhost:3001
```

## ログイン情報

| ロール | ID | パスワード |
|--------|-----|-----------|
| superadmin | admin | smile2026 |
| staff | staff | dental2026 |

## LINE Integration

- Webhook endpoint: `POST /api/line/webhook` (signature verified via `LINE_CHANNEL_SECRET`)
- Handles: text-based booking, rich menus, quick replies, push messages, patient auto-linking
- Debug/testing UI available at `/admin/line-debug` (superadmin only)
- `lineDebug.js` routes allow sending test messages without affecting production state
- 岡崎様のline_user_id: `Ua38dbbc9abdfaf7df09fe3652102b6bf`（患者ID: 190, is_test=false）

## Cron設定

| 時刻（JST） | 処理 |
|------------|------|
| 毎日 9:00 | 予約リマインダー・定期検診・誕生日・3日後フォロー |
| 毎日 18:00 | 治療後フォロー（当日分） |

手動実行（PowerShell）:
```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://dental-booking-api-k2v1.onrender.com/api/reminders/run" `
  -Headers @{ "x-cron-secret" = "smile-dental-cron-2026" }
```

## Notable Patterns

- Patient codes auto-generated as `P-00001` format
- `clinic_settings` table stores key-value config (clinic name, hours, slot duration, etc.)
- Reminder scheduling uses `node-cron` inside `reminders.js`
- Deployment config is in `render.yaml` (Render.com - backend service + static frontend + PostgreSQL)

## 残課題

- [ ] 治療後フォロー cron動的反映（設定時刻をcronに反映する仕組み）
- [ ] Stripe月額課金連携
- [ ] Google口コミ誘導
- [ ] QRコード患者登録
- [ ] アンケート機能
- [ ] クーポン発行

## ⚠️ Claude Codeへの重要なルール

1. **パッケージ・ツールのインストール前に必ず説明と承認を得ること**
   - 何をインストールするのか、なぜ必要なのかを日本語でわかりやすく説明する
   - 承認を得てから実行する

2. **ファイルの削除は勝手に行わないこと**
   - 削除が必要な場合は、対象ファイルと理由を説明し、承認を得てから実行する

3. **作業前に変更内容を日本語で説明すること**
   - どのファイルを、どのように変更するかを事前に説明する
