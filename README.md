# 🦷 スマイル歯科クリニック 予約管理システム

LINE予約Bot + 管理カレンダー + 患者カルテ の統合システム

## 技術スタック

| 区分 | 技術 |
|------|------|
| フロントエンド | React + Vite |
| バックエンド | Node.js + Express |
| データベース | PostgreSQL |
| LINE連携 | LINE Messaging API |
| ホスティング | Render |
| バージョン管理 | Git / GitHub |

## フォルダ構成

```
dental-system/
├── backend/          # Node.js + Express API サーバー
│   ├── src/
│   │   ├── routes/       # APIルーティング
│   │   ├── controllers/  # ビジネスロジック
│   │   ├── models/       # DBアクセス
│   │   ├── middleware/   # 認証・バリデーション
│   │   ├── utils/        # 共通ユーティリティ
│   │   └── config/       # 設定ファイル
│   ├── tests/        # テストコード
│   └── package.json
├── frontend/         # React 管理画面
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── pages/        # ページ
│   │   ├── hooks/        # カスタムフック
│   │   ├── context/      # グローバル状態管理
│   │   └── utils/        # フロント共通処理
│   └── package.json
├── docs/             # 設計書・仕様書
├── scripts/          # DB初期化などのスクリプト
└── README.md
```

## 開発フェーズ

- [x] Phase 0: プロジェクト構成・DB設計
- [ ] Phase 1: バックエンドAPI（予約CRUD）
- [ ] Phase 2: 管理カレンダー画面（React）
- [ ] Phase 3: LINE予約Bot連携
- [ ] Phase 4: 患者カルテ・QR連携
- [ ] Phase 5: リマインド・分析機能

## ローカル起動方法

```bash
# バックエンド
cd backend
npm install
npm run dev

# フロントエンド（別ターミナル）
cd frontend
npm install
npm run dev
```

## 環境変数（.env）

backend/.env に以下を設定：

```
DATABASE_URL=postgresql://...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
JWT_SECRET=...
PORT=3001
```
