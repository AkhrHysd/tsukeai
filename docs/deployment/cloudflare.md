# Neon と Cloudflare へのデプロイ手順

本書は **Neon（Postgres）の用意**、**API（Hono on Cloudflare Workers）のデプロイ**、**Web（Next.js）を Cloudflare 上に載せる方法**の順で説明します。

前提:

- Cloudflare アカウントと、そのアカウントでの Wrangler / Dashboard 操作権限があること。
- コマンドはリポジトリルートから実行する場合はパスに注意してください（`apps/api` など）。

関連ドキュメント:

- [Neon と Hyperdrive の接続（英語）](../orchestration/neon-hyperdrive.md)
- [DB マイグレーション](../../apps/api/MIGRATIONS.md)

---

## 1. Neon の設定

### 1.1 プロジェクト作成

1. [Neon Console](https://console.neon.tech/) にサインインします。
2. **Create project** で新規プロジェクトを作成します。
3. **Region** は利用者に近いものを選びます（例: AWS Tokyo `ap-northeast-1`）。
4. 作成完了後、プロジェクトのダッシュボードを開きます。

### 1.2 接続文字列の取得

1. Neon の **Dashboard → Connection details**（または **Connection string**）を開きます。
2. **Connection pooling** がオンになっている接続（PgBouncer 経由）を推奨します。サーバレス Worker からの接続数を抑えやすくなります。
3. **SSL mode** は `require` を選び、表示された URI をコピーします。形式の例:

   ```text
   postgres://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require
   ```

4. この文字列は **リポジトリにコミットしないでください**。パスワードマネージャや CI のシークレットストアに保存します。

### 1.3 マイグレーションの適用（Neon へ）

Neon の接続 URL を `DATABASE_URL` に設定し、ルートからマイグレーションを流します。

```sh
export DATABASE_URL="postgres://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
pnpm --filter @tsukeai/api migrate:up
```

成功すると、`accounts` / `threads` / `public_conversions` / `transform_jobs` などが Neon 上に作成されます。詳細は `apps/api/MIGRATIONS.md` を参照してください。

### 1.4 （任意）ブランチやロール

- **Preview 環境** を分けたい場合は Neon の **Branches** で開発用ブランチを切り、ブランチごとに接続文字列を用意できます。そのブランチ用に別の Hyperdrive 設定を Cloudflare 側で用意するのが一般的です。
- **最小権限の DB ユーザー** を Neon で作成し、アプリ用ユーザーだけを Hyperdrive に渡す運用も推奨です。

---

## 2. Cloudflare Hyperdrive と API（Workers）のデプロイ

API は `apps/api` の Worker としてデプロイします。Neon への実接続は **Hyperdrive** が保持する接続情報経由です（Neon のパスワードは Workers のコードや git には載せません）。

### 2.1 Wrangler のログイン

```sh
pnpm install
cd apps/api
pnpm exec wrangler login
```

初回はブラウザで Cloudflare アカウントを許可します。

補足:

- `wrangler` は `apps/api/package.json` の `devDependencies` として管理しています。`cd apps/api` せずに実行したい場合は、次でも同等です:

  ```sh
  pnpm --filter @tsukeai/api exec wrangler login
  ```

### 2.2 Hyperdrive の作成

Neon の接続文字列を指定して Hyperdrive 設定を作成します（名前は任意）。

```sh
cd apps/api
pnpm exec wrangler hyperdrive create tsukeai-neon-prod \
  --connection-string="postgres://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
```

出力に **Hyperdrive の ID**（UUID に近い文字列）が表示されます。これをメモします。

既存の一覧・削除は Wrangler のサブコマンド（`wrangler hyperdrive list` など）または [Dashboard → Workers & Pages → Hyperdrive](https://dash.cloudflare.com/) からも確認できます。

### 2.3 `wrangler.toml` と Hyperdrive ID

リポジトリの `apps/api/wrangler.toml` には Hyperdrive のプレースホルダがあります。

- **ID を git に書き込む場合**: `[[hyperdrive]]` の `id` を実際の Hyperdrive ID に置き換えます。
- **ID を git に書きかない場合**: プレースホルダのままにし、デプロイ時だけ一時設定ファイルを生成する方法が `docs/orchestration/neon-hyperdrive.md` にあります（`sed` で ID を差し替えて `wrangler deploy --config`）。

### 2.4 本番向けの環境変数（`[vars]`）

`apps/api/wrangler.toml` の `[vars]` で **公開してよい** 値だけを定義します。

必ず **デプロイ後にブラウザからアクセスするフロントのオリジン** を `API_ALLOWED_ORIGINS` に含めます（カンマ区切りで複数可）。

```toml
[vars]
API_ALLOWED_ORIGINS = "https://your-pages-domain.pages.dev"
```

ローカル開発用の `http://localhost:3000` のみのままだと、本番フロントからの Cookie 付きリクエストが CORS で拒否されます。

**LLM のエンドポイントとモデル ID**（`LLM_BASE_URL`・`LLM_MODEL`）はアプリケーションコードに既定値がないため、本番では次のいずれかで設定します。

- Dashboard: Worker → **Settings → Variables** で **Plaintext** 変数として追加  
- または `wrangler.toml` の `[vars]` に追記（URL とモデル名は機密ではないことが多い）

### 2.5 シークレット（Wrangler）

以下は **Secret** として登録します（git に書かない）。

```sh
cd apps/api

pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put LLM_API_KEY
```

プロンプトに従って値を貼り付けます。環境（Production / Preview）が Wrangler のバージョンによって選べる場合は、プレビュー用 Worker を別にデプロイする運用に合わせて設定してください。

### 2.6 デプロイ実行

```sh
cd apps/api
pnpm exec wrangler deploy
```

初回は Worker 名（`wrangler.toml` の `name`）が Cloudflare 上に作成されます。

### 2.7 動作確認

デプロイログに表示される Worker の URL（例: `https://tsukeai-api.<subdomain>.workers.dev`）を使います。

```sh
curl "https://<your-worker-host>/api/health"
curl "https://<your-worker-host>/api/db/health"
```

`/api/db/health` が Neon に届いていれば、データベース名と Postgres のバージョンが JSON で返ります。

---

## 3. Web（Next.js）を Cloudflare にデプロイする

このリポジトリの `apps/web` は **Next.js App Router** と **サーバー側での `fetch`（SSR）** を使っています。そのため **静的ホスティングだけでは動きません**。Cloudflare 上では次のいずれかが一般的です。

| 方式 | 概要 |
|---|---|
| **A. OpenNext for Cloudflare（推奨）** | Next.js を Cloudflare Workers に変換してホストする公式寄りのスタック。 |
| **B. `@cloudflare/next-on-pages`** | Pages のビルドパイプラインと組み合わせて SSR を載せる従来パターン。 |

どちらも **ビルド設定と依存パッケージの追加** が必要です。以下では **手順の骨子** と **環境変数** を記載します。実際のアダプター名・コマンドは [Cloudflare Developers の Next.js ガイド](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/) を最新版として参照してください。

### 3.1 共通: フロントから API を指す

Pages / Workers に載せたフロントでは、**サーバー側** が API にアクセスするために **`API_BASE_URL`** を必ず設定します。

例（本番 API のベース URL）:

```text
API_BASE_URL=https://tsukeai-api.<subdomain>.workers.dev
```

Cloudflare Dashboard で対象の Pages プロジェクト → **Settings → Environment variables** に設定します。**Production** と **Preview** で API の URL を分けると安全です。

### 3.2 CORS と Cookie

- API の `API_ALLOWED_ORIGINS` に、Pages の本番 URL（例: `https://xxxx.pages.dev`）およびカスタムドメインを含めます。
- 認証 Cookie をクロスオリジンで送る場合は、Cookie の `SameSite`・ドメイン設計と合わせて **同一サイト構成**（サブドメイン運用）や **リバースプロキシで同一オリジンにまとめる** などの設計が必要になることがあります。現状の MVP 実装に合わせて別途設計してください。

### 3.3 Build コマンドと出力ディレクトリ（Pages の場合）

アダプターを導入した後は、プロジェクトの README にある通常の `next build` だけではなく、**アダプター付きのビルドコマンド**（例: OpenNext の `opennextjs-cloudflare build`）を Cloudflare Pages の **Build command** に指定します。**Output directory** はアダプターのドキュメントに従ってください。

### 3.4 モノレポでの注意

- ビルドマシンで **`pnpm install` がルートから実行される** ように CI を設定します。
- `packages/shared` などワークスペース依存があるため、**リポジトリルートをビルドのルートディレクトリ**にし、`apps/web` をビルド対象にする設定が一般的です。

### 3.5 カスタムドメイン

- **Workers**: Dashboard で該当 Worker にカスタムドメインやルートをバインドできます。
- **Pages**: プロジェクトの **Custom domains** からドメインを追加し、DNS（CNAME など）を指示に従って設定します。

---

## 4. チェックリスト（本番リリース前）

- [ ] Neon にマイグレーション済みで、`/api/db/health` が成功する。
- [ ] `SESSION_SECRET`・`LLM_API_KEY` が Worker の Secret に設定されている。
- [ ] `LLM_BASE_URL`・`LLM_MODEL` が Worker の Variables（または Secret）に設定されている。
- [ ] `API_ALLOWED_ORIGINS` に本番フロントのオリジンが含まれている。
- [ ] フロントの `API_BASE_URL` が本番 API の URL を指している。
- [ ] （該当する場合）`WRITE_SMOKE_FIXED_PUBLIC_TEXT` を本番では無効または未設定にしている。

---

## 5. トラブルシュートの手がかり

| 現象 | 確認すること |
|---|---|
| `/api/db/health` が 503 | Hyperdrive ID、Neon の接続文字列、Neon 側のプロジェクト稼働状態。 |
| フロントから API が CORS エラー | `API_ALLOWED_ORIGINS`、リクエストの `Origin`、プリフライト。 |
| LLM が configuration_error | `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` の欠落や typo。 |
| Pages で SSR が動かない | Next.js 用 Cloudflare アダプター未導入、ビルドコマンド／出力ディレクトリの誤り。 |

以上です。
