# 配当利回りウォッチャー — CLAUDE.md

## プロジェクト概要

日本株の配当利回りを毎日15:40 JSTに自動取得し、目標利回りとの乖離をランキング表示するマルチユーザー対応のWeb/PWAアプリ。
監視銘柄は高配当ETFの構成銘柄から自動インポートできる。各ユーザーが自分のウォッチリスト・通知しきい値・ランキング結果を持つ。

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド・DB | Firebase Firestore |
| 認証 | Firebase Auth（Googleログイン） |
| バッチ処理 | Firebase Cloud Functions v2（Python 3.12） |
| 株価データ取得 | Yahoo Finance Japan 非公式スクレイピング（`yfinance` ライブラリ） |
| ETF構成銘柄取得 | Next.js API Route（Nomura xlsx / Solactive CSV） |
| 通知 | Web Push（Firebase Cloud Messaging） |
| ホスティング | Vercel（フロント）/ Firebase（Functions） |
| CI/CD | GitHub Actions |

---

## ディレクトリ構成

```
dividend-watcher/
├── CLAUDE.md
├── .env.local                    # フロント用環境変数（Vercelにも設定）
├── .env.local.example            # テンプレート
├── .gitignore
├── package.json                  # predev/prebuild で SW 自動生成
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── postcss.config.js
├── firebase.json                 # Functions / Firestore 設定
├── firestore.rules               # Firestore セキュリティルール
├── firestore.indexes.json
├── .firebaserc                   # Firebaseプロジェクト紐付け
│
├── public/
│   ├── manifest.json             # PWAマニフェスト
│   ├── icon-192.png              # PWAアイコン（scripts/generate-icons.mjs で生成）
│   ├── icon-512.png
│   └── firebase-messaging-sw.js  # FCM Service Worker（scripts/generate-sw.mjs でビルド時生成。.gitignore対象）
│
├── scripts/
│   ├── generate-sw.mjs           # SW を .env.local の値で埋め込み生成
│   └── generate-icons.mjs        # PWAアイコン生成（sharp使用）
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # AuthProvider + Header
│   ├── page.tsx                  # ランキング画面（メイン）
│   ├── globals.css
│   ├── watchlist/
│   │   └── page.tsx              # 監視銘柄管理画面
│   ├── api/
│   │   ├── trigger/
│   │   │   └── route.ts          # 手動トリガー（Functions HTTP関数へフォワード）
│   │   └── etf/
│   │       └── [code]/
│   │           └── route.ts      # ETF構成銘柄プロキシ（CSV/xlsxを取得・パースしてJSON返却）
│   └── components/
│       ├── AuthProvider.tsx      # Firebase Auth コンテキスト
│       ├── AuthGate.tsx          # 未ログイン時のログイン誘導画面
│       ├── Header.tsx            # ナビ + ログイン状態表示
│       ├── RankingTable.tsx
│       ├── WatchlistEditor.tsx
│       ├── EtfImporter.tsx       # ETFキャッシュ更新 + 一括インポート
│       ├── StatusBar.tsx         # 「今すぐ取得」ボタン
│       ├── MetricCards.tsx       # 上部メトリクス4枚
│       ├── ThresholdSetting.tsx  # 通知しきい値の編集
│       └── PushPermissionBanner.tsx
│
├── lib/
│   ├── firebase.ts               # Firebase クライアント初期化
│   ├── firestore.ts              # Firestore CRUD ヘルパー
│   ├── auth.ts                   # signInWithGoogle / signOut / onAuthChange
│   ├── fcm.ts                    # FCMトークン取得・Firestore保存
│   └── types.ts                  # 共通型 + SUPPORTED_ETFS 定数
│
├── functions/                    # Firebase Cloud Functions (Python)
│   ├── requirements.txt
│   ├── main.py                   # エントリポイント（initialize_app + 関数公開）
│   ├── scheduler.py              # daily_yield_fetch + manual_trigger
│   ├── scraper.py                # Yahoo Finance スクレイピング（USE_MOCK対応）
│   ├── push_notifier.py          # FCM Web Push通知（ユーザー単位）
│   ├── holiday.py                # 営業日判定（jpholiday + 年末年始除外）
│   ├── etf_importer.py           # （現状未使用。ETF取得はNext.js側で実装）
│   ├── lib_etf_codes.py          # 対応ETF一覧（フロントの SUPPORTED_ETFS と同期）
│   └── test_scraper.py           # ユニットテスト（USE_MOCK=true 想定）
│
└── .github/workflows/
    ├── deploy.yml                # main push → Vercel デプロイ
    └── deploy-functions.yml      # functions/** か firestore.rules 変更時 → Firebase デプロイ
```

---

## 環境変数

### `.env.local`（フロントエンド・Vercel）

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=          # Cloud Messaging > Webプッシュ証明書
NEXT_PUBLIC_TRIGGER_FUNCTION_URL=        # Functions の manual_trigger HTTPエンドポイント
```

### Functions 用環境変数

FCM・Firestore は Firebase Admin SDK が自動認証するため追加の環境変数は不要。
テスト・開発時のみ `USE_MOCK=true` でスクレイピングをモックデータに切り替え。

---

## 認証

- Firebase Auth（Googleプロバイダ）必須。
- 未ログイン時は `AuthGate` がログインボタンのみを表示し、メイン画面・ウォッチリスト画面はガードされる。
- 各ユーザーが自分の監視銘柄・ランキング結果・通知設定を持つ（マルチユーザー対応）。

---

## Firestoreデータ構造

```
/users/{uid}/watchlist/{docId}
  code: string          # 証券コード（例: "8316"）
  name: string          # 銘柄名
  targetYield: number   # 目標利回り（例: 3.8）
  source: string        # "手動" | "ETF1489" など
  createdAt: timestamp

/users/{uid}/results/{YYYY-MM-DD}    # ドキュメントIDが日付（JST基準）
  fetchedAt: timestamp
  stocks: [
    {
      code: string
      name: string
      price: number | null
      annualDividend: number | null
      currentYield: number | null
      targetYield: number
      gap: number | null         # currentYield - targetYield（プラスが割安）
    }
  ]

/users/{uid}/settings/preferences
  notifyThreshold: number   # gap >= この値で通知。デフォルト +0.5

/users/{uid}/fcm_tokens/{token}      # ドキュメントIDがFCMトークン（重複防止）
  token: string
  createdAt: timestamp
  updatedAt: timestamp

/etf_cache/{etfCode}    # グローバル（全ユーザー共通）
  updatedAt: timestamp
  holdings: [{ code, name, targetYield }]
```

### Firestore セキュリティルール

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /etf_cache/{etfCode} {
  allow read, write: if request.auth != null;
}
```

`/users/{uid}/**` は本人のみアクセス可。`/etf_cache/**` は認証済みユーザーが読み書き可（個人運用想定。マルチテナントで運用するなら Functions/Admin SDK のみに制限すべき）。

---

## 乖離（gap）の符号規約

`gap = currentYield - targetYield`

- **プラス**: 現在利回りが目標を上回っている → 株価が割安 → **買い検討**
- **マイナス**: 現在利回りが目標を下回っている → 株価が割高
- ランキングは **gap 降順**（プラス大が先頭）でソート
- 通知は **gap ≥ notifyThreshold** で送信（しきい値プラス）
- 判定バッジ: `買い検討`（gap ≥ +0.5）/ `中立`（-0.5〜+0.5）/ `割高`（gap ≤ -0.5）

---

## ETF構成銘柄取得（Next.js API Route）

`/api/etf/[code]` で実装（Functions側ではなくNext.js側）。
クライアントから fetch → サーバー側で外部CSV/xlsxを取得・パース → JSON返却 → クライアントが Firestore `/etf_cache/{code}` に書き込む。

| ETFコード | 名称 | データソース | 状態 |
|---|---|---|---|
| 1489 | NEXT FUNDS 日経平均高配当株50指数連動型 | `nomura-am.co.jp/.../1489_brd_data.xlsx`（「保有明細」シート） | ✅ |
| 1577 | NEXT FUNDS 野村日本株高配当70連動型 | `nomura-am.co.jp/.../1577_brd_data.xlsx` | ✅ |
| 2564 | グローバルX MSCIスーパーディビィデンド－日本株式 | `legacy2.solactive.com/.../2564.csv`（英語名） | ✅ |
| 1478 | iShares MSCI ジャパン高配当利回り | （BlackRockのCSVエンドポイントが認証要求） | ❌ 自動取得未対応・手動追加 |

目標利回りは ETF ごとの固定デフォルト値：
- 1489: 4.0% / 1577: 3.8% / 2564: 5.0% / 1478: 3.5%（手動追加用）

### 操作フロー（フロント）

`/watchlist` 画面で：
1. ETF をチェック（1478は無効化済み）
2. **「キャッシュを更新」** → `/api/etf/{code}` を呼び `/etf_cache/{code}` に書き込み
3. **「選択したETFをインポート」** → `/etf_cache` から読み出して `/users/{uid}/watchlist` に追加（重複スキップ）

xlsx パースは `xlsx` (SheetJS) ライブラリで Node.js 実行時に処理。

---

## Firebase Cloud Functions 仕様

### `main.py` — エントリポイント

```python
import firebase_admin
firebase_admin.initialize_app()
from scheduler import daily_yield_fetch, manual_trigger
```

### `scheduler.py` — daily_yield_fetch + manual_trigger

```python
@scheduler_fn.on_schedule(schedule="every day 15:40", timezone="Asia/Tokyo")
def daily_yield_fetch(event):
    # 1. holiday.py で営業日チェック → 休業日ならスキップ
    # 2. /users コレクションを走査して各ユーザーごとに _process_user を実行

def _process_user(uid):
    # /users/{uid}/watchlist 全件取得
    # scraper.fetch_stock で株価・配当を取得
    # gap = currentYield - targetYield を計算
    # gap 降順（プラス大＝割安が先頭）でソート、None は末尾
    # /users/{uid}/results/{today_jst} に保存
    # /users/{uid}/settings/preferences の notifyThreshold を読み出し
    # push_notifier.notify_user(uid, results, threshold) で通知

@https_fn.on_request()
def manual_trigger(req):
    """開発・運用用の手動トリガー。
    ?userId=<uid> でそのユーザーのみ実行。userId 未指定なら全ユーザー。
    営業日チェックはスキップ。"""
```

### `scraper.py` — Yahoo Finance スクレイピング

```python
def fetch_stock(code: str) -> StockInfo:
    """
    USE_MOCK=true の場合はモックデータを返す（テスト・開発時用）。
    それ以外は yfinance.Ticker(f"{code}.T").info から取得。
    返り値: { price, annualDividend, currentYield } 各 None 可能。
    """
```

### `holiday.py` — 営業日判定

```python
def is_business_day(d: date) -> bool:
    # 土日 → False
    # jpholiday.is_holiday → False
    # 12/31, 1/1, 1/2, 1/3 → False（年末年始の手動除外）
    # それ以外 → True
    # 12/30（大納会）、1/4（大発会）は通常営業日扱い
```

### `push_notifier.py` — FCM Web Push通知

```python
def notify_user(uid: str, results: list, threshold: float):
    """
    /users/{uid}/fcm_tokens から該当ユーザーのトークンを取得し、multicast送信。
    gap >= threshold の銘柄を割安候補として通知（gap 降順、先頭が最も割安）。
    無効トークン (registration-token-not-registered) はFirestoreから自動削除。
    """
```

通知例:
- タイトル: 📊 配当利回りウォッチャー
- 本文:    割安候補 3件 | 三井住友FG +0.62% など
- リンク:   `/`（タップでアプリのランキング画面に遷移）

### `lib_etf_codes.py` / `etf_importer.py`

`lib_etf_codes.SUPPORTED_ETF_CODES` は対応ETF一覧（フロントの `SUPPORTED_ETFS` と同期）。
`etf_importer.py` は当初 Functions 側で構成銘柄を取得する想定だったが、**現在は Next.js の `/api/etf/[code]` に移行済み**。ファイル自体はテスト（`test_scraper.py`）から参照されるが、scheduler からは呼ばれない。

---

## フロントエンド画面仕様

### メイン画面 `/`（ランキング）

ログイン必須（`AuthGate` がガード）。
- 最新の `/users/{uid}/results/{today}` をリアルタイムリスナー（`onSnapshot`）で購読
- 上部にメトリクスカード4枚: 最終更新日時 / 監視銘柄数 / 平均乖離 / 割安候補数（gap ≥ threshold）
- 中段に通知しきい値の編集（`ThresholdSetting`）と「今すぐ取得」ボタン（`StatusBar`）
- テーブル列: 順位 / コード / 銘柄名 / 株価 / 年配当 / 現在利回り / 目標利回り / 乖離 / 判定バッジ
- 乖離列はデフォルト降順（プラス大＝割安が上位）。プラスは緑、マイナスは赤で着色
- 判定バッジ: `買い検討`（gap ≥ +0.5）/ `中立`（-0.5〜+0.5）/ `割高`（gap ≤ -0.5）
- 通知しきい値はユーザーごとに編集可能（デフォルト +0.5、即時 Firestore 反映）

### 監視銘柄管理 `/watchlist`

ログイン必須。
- ETFインポートUI（チェックボックスで複数選択 → ①「キャッシュを更新」→ ②「選択したETFをインポート」の2段階フロー）
- 1478（iShares）は自動取得未対応のため非選択固定（注釈表示）
- 手動追加フォーム（コード + 銘柄名 + 目標利回り）
- 銘柄一覧テーブル（削除ボタン付き）
- `/users/{uid}/watchlist` をリアルタイム表示

### 手動トリガー `/api/trigger`

POST `?userId=<uid>` で `NEXT_PUBLIC_TRIGGER_FUNCTION_URL`（Functions の `manual_trigger`）にフォワード。
StatusBar の「今すぐ取得」ボタンから呼ばれる。
**本番デプロイ時は認証保護の追加 or 削除を検討すること**（現状は誰でも叩ける）。

---

## PWA / Service Worker

### `public/manifest.json`

```json
{
  "name": "配当利回りウォッチャー",
  "short_name": "配当Watch",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### `public/firebase-messaging-sw.js`（自動生成）

`scripts/generate-sw.mjs` がビルド時に `.env.local` から Firebase 設定を読んで生成する。
SW 内では環境変数が使えないため、ビルド時埋め込み方式を採用。
`package.json` の `predev` / `prebuild` で自動実行され、`.gitignore` 対象。

```javascript
// 自動生成される内容（概略）
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
firebase.initializeApp({ /* .env.localの値が埋め込まれる */ });
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon-192.png",
    data: { url: payload.fcmOptions?.link ?? "/" },
  });
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### `lib/fcm.ts` — トークン取得・Firestore保存

```typescript
export async function registerPushToken(uid: string): Promise<string | null> {
  // Notification.requestPermission() で許可取得
  // Service Worker を /firebase-messaging-sw.js で登録
  // getToken({ vapidKey, serviceWorkerRegistration }) でトークン取得
  // /users/{uid}/fcm_tokens/{token} に保存（merge）
}
```

### `components/PushPermissionBanner.tsx`

ログイン後の初回訪問時に「通知を許可する」バナーを表示。
- 許可済み or 未対応ブラウザなら非表示
- 「許可する」ボタン押下 → `Notification.requestPermission()` → `registerPushToken(uid)` 呼び出し
- Android Chromeでは「ホーム画面に追加」後でないとインストール型通知が届かない旨を案内

### アイコン生成

`scripts/generate-icons.mjs` が SVG 定義から `public/icon-192.png` / `icon-512.png` を生成。
`sharp` を使用。手動実行: `node scripts/generate-icons.mjs`

---

## GitHub Actions — CI/CD

### `.github/workflows/deploy.yml` — Vercel デプロイ

main push で自動実行。Firebase 設定は GitHub Secrets から `npm run build` 時の env として注入。

### `.github/workflows/deploy-functions.yml` — Firebase Functions デプロイ

`functions/**` または `firestore.rules` 変更時に自動実行。`FIREBASE_TOKEN` Secret を使用。

---

## セットアップ手順

```powershell
# 1. リポジトリをクローン後、依存インストール
npm install

# 2. .env.local.example を .env.local にコピーして Firebase の値を埋める
#    （Firebase Console > プロジェクト設定 > マイアプリ）
#    VAPIDキー: Cloud Messaging > Webプッシュ証明書

# 3. .firebaserc の "default" を実プロジェクトIDに変更

# 4. Functions の Python venv 構築（Python 3.12 必須）
cd functions
py -3.12 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..

# 5. PWAアイコン生成
node scripts/generate-icons.mjs

# 6. Firestore ルール + ローカル動作確認
firebase deploy --only firestore:rules
npm run dev    # → http://localhost:3000

# 7. Cloud Functions の権限設定（初回のみ）
#    GCP Console > IAM で {project_number}-compute@developer.gserviceaccount.com に
#    「Cloud Build Service Account」ロールを付与（新規プロジェクトでは未付与）

# 8. Functions デプロイ（Blazeプラン必須）
firebase deploy --only functions
#    → デプロイログから manual_trigger の URL をコピーして
#       NEXT_PUBLIC_TRIGGER_FUNCTION_URL に設定

# 9. Vercel デプロイ
vercel --prod
```

---

## `functions/requirements.txt`

```
firebase-functions>=0.4.0
firebase-admin>=6.5.0
yfinance>=0.2.40
jpholiday>=0.1.10
beautifulsoup4>=4.12.0
requests>=2.31.0
```

---

## 重要な注意事項

- **`yfinance` はYahoo Financeの非公式ライブラリ**。利用規約上グレーゾーンのため商用利用は自己責任。`USE_MOCK=true` でテストモック使用可。
- **15:40実行はCloud Schedulerのcron精度により±数分のズレ**が発生する場合あり。
- **`/users/{uid}/results/{date}` は日付（JST）をドキュメントIDにするため冪等**（同日複数回実行で上書き）。
- **祝日判定は `jpholiday` + 年末年始（12/31〜1/3）の手動除外**。12/30（大納会）と 1/4（大発会）は通常営業日扱い。
- **ETF構成銘柄は外部サイトのフォーマット変更で取得できなくなる可能性**がある。Nomura xlsx の「保有明細」シート構造、Solactive CSV のヘッダーを定期確認。
- **1478 (iShares) は自動取得未対応**。BlackRock の CSV エンドポイントが認証/Refererを要求するため。手動追加で対応。
- **Cloud Functions は Blazeプラン（従量課金）必須**。無料枠で運用可能だが課金口座の登録が必要。
- **Cloud Build サービスアカウントの権限**: 新規プロジェクトでは Compute Engine default service account（`{project_number}-compute@developer.gserviceaccount.com`）に「Cloud Build Service Account」ロールを手動付与する必要あり（初回デプロイで `Build failed ... missing required permission` エラーになるため）。
- **Python ランタイムは 3.12 推奨**。3.13 はサポート対象だが、3.14 は Cloud Functions 未サポート。`firebase.json` の `runtime` と venv の Python バージョンを一致させること。
- **しきい値（notifyThreshold）の符号規約**: `gap = currentYield - targetYield`。プラス＝目標利回りより現在利回りが高い＝株価が割安。`gap ≥ threshold`（しきい値プラス）で買い検討バッジ・通知。
- **Web Push（FCM）の注意点**：
  - `firebase-messaging-sw.js` は必ず `public/` 直下（パスが `/firebase-messaging-sw.js`）。`scripts/generate-sw.mjs` で自動生成され `.gitignore` 対象。
  - Androidでは「ホーム画面に追加」でPWAインストールしないとバックグラウンド通知が届かない場合がある。`PushPermissionBanner` で案内。
  - FCMトークンはアプリ再インストールやブラウザクリアで変わる。古いトークンへの送信失敗（`registration-token-not-registered`）は `push_notifier.py` で自動削除。
  - Service Worker内ではFirebase設定値が環境変数経由で取れないため、ビルド時に値を埋め込む（`scripts/generate-sw.mjs`）。
- **手動トリガー `/api/trigger` と Functions `manual_trigger` の保護**: 現状は認証なしで誰でも叩ける開発用エンドポイント。本番運用時は認証チェック追加 or 削除を検討すること。
