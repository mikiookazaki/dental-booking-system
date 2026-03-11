# 🚀 セットアップガイド（Step-by-Step）

## 前提条件
- Node.js 18以上がインストールされていること
- Git / GitHubのアカウント
- Renderのアカウント

---

## Step 1: このプロジェクトをGitHubに登録する

```bash
# 1. GitHubで新しいリポジトリを作成
#    名前例: dental-system
#    Public or Private どちらでもOK

# 2. ローカルでGitを初期化
cd dental-system
git init
git add .
git commit -m "🦷 初回コミット：プロジェクト構成・DB設計"

# 3. GitHubに接続してpush
git remote add origin https://github.com/あなたのユーザー名/dental-system.git
git branch -M main
git push -u origin main
```

---

## Step 2: Renderでデータベースを作成する

1. https://render.com にログイン
2. 「New +」→「PostgreSQL」を選択
3. 以下を設定：
   - Name: `dental-system-db`
   - Database: `dental_system`
   - User: `dental_admin`
   - Plan: **Free**
4. 「Create Database」をクリック
5. 作成後、「Connection String」をコピーしておく

---

## Step 3: ローカルでデータベースを初期化する

```bash
# .env.exampleをコピーして.envを作成
cd backend
copy .env.example .env   # Windowsの場合

# .envを開いてDATABASE_URLにRenderのConnection Stringを貼り付ける
# メモ帳やVSCodeで編集する

# データベースにテーブルを作成
npm run db:init
# → 「✅ データベーススキーマの作成が完了しました」と表示されればOK
```

---

## Step 4: バックエンドをローカルで起動する

```bash
cd backend
npm install
npm run dev
# → 「🦷 歯科予約システム バックエンド起動」と表示されればOK
# → ブラウザで http://localhost:3001/health を開いて {"status":"ok"} が返ればOK
```

---

## Step 5: 管理者ユーザーを作成する

バックエンドが起動中の状態で、以下のコマンドを実行（PowerShellの場合）：

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/auth/setup" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"your-password"}'
```

---

## Step 6: Renderにバックエンドをデプロイする

1. Renderで「New +」→「Web Service」を選択
2. GitHubのリポジトリを選択
3. 以下を設定：
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. 環境変数を追加：
   - `DATABASE_URL` ← RenderのPostgreSQLのConnection String
   - `LINE_CHANNEL_SECRET` ← LINEの設定（後で）
   - `LINE_CHANNEL_ACCESS_TOKEN` ← LINEの設定（後で）
   - `JWT_SECRET` ← 任意の長い文字列
   - `FRONTEND_URL` ← フロントのURL（後で）
5. 「Create Web Service」をクリック

---

## Step 7: フロントエンドを起動する（次のステップ）

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 でブラウザが開く
```

---

## APIエンドポイント一覧

| Method | URL | 説明 |
|--------|-----|------|
| GET    | /health | ヘルスチェック |
| POST   | /api/auth/login | ログイン |
| GET    | /api/appointments | 予約一覧 |
| POST   | /api/appointments | 予約作成 |
| PUT    | /api/appointments/:id | 予約更新 |
| DELETE | /api/appointments/:id | 予約キャンセル |
| GET    | /api/appointments/available/slots | 空き枠取得 |
| GET    | /api/patients | 患者一覧 |
| POST   | /api/patients | 患者登録 |
| POST   | /api/patients/link-line | LINE連携 |
| GET    | /api/staff | スタッフ一覧 |
| PUT    | /api/staff/:id/shift | シフト更新 |
| GET    | /api/treatments | 治療メニュー一覧 |
| GET    | /api/chairs | チェア一覧 |
| GET    | /api/settings | クリニック設定 |
| PUT    | /api/settings | 設定更新 |
| GET    | /api/blocked-slots | ブロック一覧 |
| POST   | /api/blocked-slots | ブロック追加 |
| POST   | /api/line/webhook | LINE Webhook |
