# tsukeai

短歌（五七五 / 七七）の形式で句を読み合う公開タイムライン。素の入力を LLM で短歌形式に変換し、形式検証に通った句だけを公開する。

## アーキテクチャ

```
apps/web   — Next.js App Router (SSR) … フロントエンド
apps/api   — Hono on Cloudflare Workers … REST API
packages/shared — DTO 型定義・短歌形式検証ロジック
```

- **DB**: Neon Postgres（Cloudflare Hyperdrive 経由）
- **変換**: OpenAI 互換 API で短歌変換。API 側で非同期ジョブとして管理
- **認証**: Cookie ベースのセッション（HMAC 署名）

詳細は `docs/orchestration/` 配下の ADR を参照:

| ドキュメント | 内容 |
|---|---|
| `transform-architecture.md` | 変換ジョブの同期/非同期・冪等性・コスト上限 |
| `authentication.md` | パスワード + パスキー + TOTP の認証方式 |
| `neon-hyperdrive.md` | Neon DB と Hyperdrive の接続手順 |
| `apps/api/MIGRATIONS.md` | DB マイグレーション手順 |
| [`docs/deployment/cloudflare.md`](docs/deployment/cloudflare.md) | Neon 設定・API／Web の Cloudflare デプロイ手順書 |

## リポジトリ／フォルダ名

コードとパッケージ名は **`tsukeai`**（スコープ `@tsukeai/*`）に揃えています。クローン先のディレクトリ名を `tsukeai` にしたい場合は、作業ツリー外でリネームしてください。

```sh
# 例: 親ディレクトリで
mv tanka-reply-sns tsukeai
```

その後、Cursor や IDE で **`tsukeai` フォルダをワークスペースとして開き直す**とパスが一致します。

## 前提条件

- **Node.js** >= 22
- **pnpm** 10.x（`packageManager` フィールドで固定）
- **Docker**（ローカル Postgres を使う場合）

## セットアップ

### 1. 依存インストール

```sh
pnpm install
```

### 2. ローカル Postgres の起動

Docker Compose でローカル DB を立ち上げます:

```sh
docker compose up -d
```

接続情報:

| 項目 | 値 |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `tsukeai` |
| User | `tsukeai` |
| Password | `tsukeai` |
| URL | `postgres://tsukeai:tsukeai@localhost:5433/tsukeai` |

> ポート 5433 を使用しているのは、ホストの Postgres（5432）との衝突を避けるためです。  
> **DB 名・ユーザー・パスワードを `tanka` から変更した場合**は、既存の Docker ボリュームを削除してから `docker compose up -d` し直してください（`docker compose down -v` で `pgdata` が消えます）。

### 3. マイグレーション

```sh
DATABASE_URL="postgres://tsukeai:tsukeai@localhost:5433/tsukeai" \
  pnpm --filter @tsukeai/api migrate:up
```

### 4. API の起動

```sh
# apps/api/.dev.vars にシークレットを設定（テンプレート: apps/api/.dev.vars.example）
cp apps/api/.dev.vars.example apps/api/.dev.vars

# API サーバー起動（http://localhost:8787）
pnpm --filter @tsukeai/api dev
```

> `wrangler dev` はローカルモードで動作し、Hyperdrive バインディングは
> `wrangler.toml` の設定から直接 DB に接続します。
> ローカル開発では `wrangler.toml` 内の Hyperdrive ID がプレースホルダでも
> `--local` モードで DB_URL を `.dev.vars` から読み取れます。

### 5. Web の起動

```sh
# apps/web/.env.local に環境変数を設定（テンプレート: apps/web/.env.local.example）
cp apps/web/.env.local.example apps/web/.env.local

# Web サーバー起動（http://localhost:3000）
pnpm --filter @tsukeai/web dev
```

### まとめて起動（turbo）

```sh
pnpm dev
```

> 現時点では root に `dev` スクリプトがないため、上記の個別起動を使ってください。

## 環境変数一覧

### apps/api（Cloudflare Workers の Bindings / `.dev.vars`）

| 変数 | 必須 | 説明 | デフォルト |
|---|---|---|---|
| `HYPERDRIVE` | yes | Hyperdrive バインディング（wrangler.toml で設定） | — |
| `SESSION_SECRET` | yes | セッション Cookie の HMAC 署名鍵 | — |
| `LLM_API_KEY` | yes† | OpenAI 互換 API キー | — |
| `LLM_BASE_URL` | yes† | チャット完了 API の絶対 URL（`http` / `https` のみ。コードに既定値はない） | — |
| `LLM_MODEL` | yes† | そのエンドポイント向けのモデル ID（コードに既定値はない） | — |
| `API_ALLOWED_ORIGINS` | — | CORS 許可オリジン（カンマ区切り） | `http://localhost:3000` |
| `SESSION_COOKIE_NAME` | — | セッション Cookie 名 | `__Host-tsukeai_session` |
| `LLM_TIMEOUT_MS` | — | LLM リクエストタイムアウト (ms) | `8000` |
| `LLM_MAX_INPUT_CHARS` | — | 入力文字数上限 | `1000` |
| `LLM_MAX_OUTPUT_TOKENS` | — | 出力トークン上限 | `96` |
| `LLM_MAX_RETRIES` | — | LLM リトライ回数 | `1` |
| `WRITE_SMOKE_FIXED_PUBLIC_TEXT` | — | `1` で LLM を通さず固定テキストを公開（テスト用） | — |

† 実際に変換ジョブで LLM を呼ぶ場合は `LLM_API_KEY`・`LLM_BASE_URL`・`LLM_MODEL` の三者がすべて必要です。固定テキストの書き込みスモークだけなら、変換 API を叩かない限り未設定でも起動できます。本番・ステージングでは Cloudflare の Secrets / Vars または `wrangler.toml` の `[vars]` でプロバイダごとに設定してください。

### apps/web（Next.js の `.env.local`）

| 変数 | 必須 | 説明 | デフォルト |
|---|---|---|---|
| `API_BASE_URL` | — | API のベース URL | `http://localhost:8787` |
| `WRITE_SMOKE_FIXED_PUBLIC_TEXT` | — | `1` で固定テキスト書き込み（テスト用） | — |

## 開発コマンド

```sh
# lint + format チェック
pnpm biome

# 型チェック（全パッケージ）
pnpm --filter @tsukeai/shared typecheck
pnpm --filter @tsukeai/api typecheck
pnpm --filter @tsukeai/web typecheck

# Next.js ビルド
pnpm --filter @tsukeai/web build

# スモークテスト
pnpm test

# turbo で全パッケージの check を実行
pnpm check

# フォーマット自動修正
pnpm format
```

## LLM なしでの動作確認

LLM API キーがない環境でも、書き込み系の動作を確認できます:

1. `apps/api/.dev.vars` に `WRITE_SMOKE_FIXED_PUBLIC_TEXT=1` を追加
2. `apps/web/.env.local` に `WRITE_SMOKE_FIXED_PUBLIC_TEXT=1` を追加

この設定で投稿・返信すると、LLM 変換をスキップして固定の短歌テキストが公開されます。
タイムライン閲覧・削除は LLM に依存しないため、常にそのまま動作します。

## DB にテストユーザーを作成

ローカル Postgres にテスト用のアカウントを作成するには:

```sql
insert into accounts (id, display_name, handle)
values (
  'a0000000-0000-0000-0000-000000000001',
  'テストユーザー',
  'test'
);
```

セッション Cookie の生成には `SESSION_SECRET` で HMAC 署名が必要です。
ローカル開発時は curl で直接 API を叩くか、将来の認証 UI 実装を待ってください。

## プロジェクト構造

```
tsukeai/                      （リポジトリルートの想定ディレクトリ名）
├── apps/
│   ├── api/                  Hono API（Cloudflare Workers）
│   │   ├── migrations/       SQL マイグレーション
│   │   ├── scripts/          migrate.mjs
│   │   ├── src/
│   │   │   ├── index.ts      API ルート・ミドルウェア
│   │   │   └── llm-adapter.ts LLM 変換アダプター
│   │   └── wrangler.toml
│   └── web/                  Next.js フロントエンド
│       ├── scripts/          スモークテスト
│       └── src/
│           ├── app/          App Router ページ
│           └── lib/          ユーティリティ
├── packages/
│   └── shared/               DTO 型・短歌形式検証
├── docs/
│   └── orchestration/        ADR・設計ドキュメント
├── biome.json                Biome 設定
├── turbo.json                Turborepo 設定
└── docker-compose.yml        ローカル Postgres
```
