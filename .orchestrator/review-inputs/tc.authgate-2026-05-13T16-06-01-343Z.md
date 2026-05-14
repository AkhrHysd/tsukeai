# Review Task

Task ID: tc.authgate
Title: Passkey（S1）の orchestration 同期と SimpleWebAuthn スパイク

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.authgate

## Description
Design で確定した S1（@simplewebauthn/server on Hono Workers、Neon にクレデンシャル／セッション、httpOnly Cookie、パスワードなし）を docs/orchestration に同期し、Workers 上でのライブラリ適合をスパイクして記録する。

## Allowed Paths
- docs/orchestration

## Acceptance Criteria
- S1 パスキー方針とスパイク結果が orchestration 文書に記録される。
- RP ID・公開 URL・Cookie ドメイン・CORS の対応が orchestration に記載される。
- MVP におけるメール検証の要否（採用／不採用／将来）が orchestration に明文化される。
- SimpleWebAuthn on Workers のスパイク結果と代替方針が orchestration に記載される。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: $ npm test
exitCode: 0
stdout:

> tsukeai@0.0.0 test
> pnpm --filter @tsukeai/web test


> @tsukeai/web@0.0.0 test /Users/akyrhysd/work/tsukeai/.worktrees/tc.authgate/apps/web
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tsukeai/web@0.0.0 smoke:read /Users/akyrhysd/work/tsukeai/.worktrees/tc.authgate/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tsukeai/web@0.0.0 smoke:write /Users/akyrhysd/work/tsukeai/.worktrees/tc.authgate/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- docs/orchestration/authentication.md
- docs/orchestration/design.md
- docs/orchestration/intermediate-plan.json
- docs/orchestration/plan.md

## Unified Diff
```diff
diff --git a/docs/orchestration/authentication.md b/docs/orchestration/authentication.md
index d43d2f1..b9f8c1c 100644
--- a/docs/orchestration/authentication.md
+++ b/docs/orchestration/authentication.md
@@ -8,41 +8,50 @@ Accepted for MVP implementation.
 
 Design では、GT の閲覧は未ログインでも可能、投稿・返信・本人削除はログイン必須とする。認証は無料枠・低固定費を優先し、SMS のような従量課金や電話番号依存の要素には依存しない。
 
-`tc.authgate` は、実装前にパスワード／パスキー／TOTP の組み合わせを確定するためのゲートである。
+`tc.authgate` は、実装前に S1 の認証方式、Workers 上のライブラリ適合、RP／Cookie／CORS 境界を確定するためのゲートである。
 
 ## Decision
 
-MVP の認証方式は次の組み合わせとする。
+MVP の認証方式は **S1: パスキー（WebAuthn）によるパスワードレス認証** とする。
 
-- **パスワード**: 初期登録・ログインの基本方式として採用する。
-- **パスキー（WebAuthn）**: 追加ログイン方式として採用する。対応端末ではパスワードレスに近い導線を目指すが、MVP ではパスワードを完全には廃止しない。
-- **TOTP**: 2FA として採用する。投稿・返信・本人削除を行うアカウントの保護強化に使う。
+- **パスキー（WebAuthn）**: 採用する。登録・ログインの基本方式とし、Hono on Cloudflare Workers 上で `@simplewebauthn/server` により registration / authentication ceremony を検証する。
+- **パスワード**: MVP では採用しない。パスワードハッシュ、リセットメール、パスワードポリシーを初期範囲から外し、認証状態はパスキーとサーバセッションに寄せる。
+- **TOTP**: MVP では採用しない。パスキーが possession / user verification を担うため、初期実装では追加 2FA を持たない。
 - **SMS**: 採用しない。ログイン、2FA、復旧のいずれも SMS 従量課金に依存しない。
 
-実装上の初期方針は **パスワード + 任意のパスキー + 任意の TOTP** とする。将来、利用者が増えた段階で TOTP の必須化やパスキー優先への変更を検討できるが、MVP では登録離脱と実装量を抑えるため任意設定に留める。
+アカウントは内部 `account_id` と WebAuthn 用の `user.id` を分ける。クレデンシャルは Neon Postgres に保存し、少なくとも credential ID、公開鍵、sign counter、device type、backup state、transport、所属 account を保持する。セッションも Neon を正本とし、Cookie はセッション ID を運ぶ transport に限定する。
 
 ## Passkey Spike
 
-`@simplewebauthn/server` は Web Crypto を前提にした実装を持ち、Cloudflare Workers 上でも `globalThis.crypto` を使う構成で利用できる見込みがある。MVP のスパイク結果としては **採用候補** とし、実装タスクでは Workers の `nodejs_compat` に頼りすぎず、Web Crypto と `Uint8Array` 前提で登録・認証の検証を組む。
+S1 のスパイクでは、`@simplewebauthn/server` を **Hono on Cloudflare Workers で採用する方針**とする。根拠は次の通り。
 
-ただし、MVP ではパスキーを唯一の認証手段にはしない。端末・ブラウザ・復旧導線の差を吸収するため、パスワードを基本方式として残し、パスキーは任意の追加ログイン方式にする。もし Workers runtime またはライブラリ更新で問題が出る場合は、同じ WebAuthn データモデルを維持しつつ、検証処理だけを API 側の薄い別実装へ置き換える方針とする。
+- Cloudflare Workers は Web Crypto の `crypto.subtle`、`crypto.getRandomValues()`、`crypto.randomUUID()` を提供する。WebAuthn 検証で必要な署名検証・ダイジェスト・ランダム challenge 生成は Workers runtime の Web 標準 API に寄せられる。
+- SimpleWebAuthn の server package は credential の `publicKey: Uint8Array`、`counter`、`deviceType`、`backedUp`、`transports` などを永続化するモデルを前提としており、Neon Postgres に bytea / text / jsonb 等で保持する方針と整合する。
+- Workers では Node.js Crypto API と Web Crypto API の差が実装リスクになるため、S1 の実装では `nodejs_compat` への依存を最小化し、Web Crypto / Web standard 型、Base64URL、`Uint8Array` の変換境界を contract test で固定する。
+- スパイク時点の判定は **採用可**。ただし、実装タスクでは `generateRegistrationOptions`、`verifyRegistrationResponse`、`generateAuthenticationOptions`、`verifyAuthenticationResponse` を Workers の Miniflare / Vitest または同等環境で実行し、ESM bundle と runtime API の両方を確認する。
+
+代替方針は **WebAuthn データモデルを維持した検証層の差し替え** とする。`@simplewebauthn/server` が Workers の bundle、Web Crypto 対応、依存更新のいずれかで詰まる場合でも、Neon の credential / challenge / session スキーマは変えず、検証処理だけを次の順で置き換える。
+
+1. Workers の `nodejs_compat` を明示して同ライブラリを継続する。
+2. Web Crypto だけを使う薄い WebAuthn 検証実装を Hono API 内に閉じる。
+3. 最後の手段として、同じ REST 契約の認証検証だけを別 runtime に逃がす。ただし、セッション正本は Neon、Cookie 発行境界は Hono API に戻す。
 
 ## RP, Cookie, and CORS
 
-- **RP ID**: 本番公開ホストの eTLD+1 を使う。API と Web を分割ドメインにする場合でも、WebAuthn の ceremony は利用者が見る Web 側 origin を基準に設計する。
-- **公開 URL**: `NEXT_PUBLIC_API_BASE_URL` などで Web から API を参照する場合、登録・認証 ceremony の `origin` 検証は Web の公開 URL と一致させる。
-- **Cookie ドメイン**: API と Web を同一サイト配下に置ける場合は `__Host-` prefix、`Secure`、`HttpOnly`、`SameSite=Lax` を基本とする。サブドメインをまたぐ必要がある場合は `__Host-` を使えないため、Domain 属性の採用可否を実装タスクで明示する。
-- **CORS**: credentials 付き request を許可する origin は明示リストに限定する。`Access-Control-Allow-Credentials: true` と wildcard origin は併用しない。
+- **RP ID**: 本番公開 Web ホストの registrable domain を使う。API と Web を分割ドメインにする場合でも、WebAuthn ceremony の `rpID` と `expectedOrigin` は利用者が操作する Web 側 origin を基準にする。localhost / preview / production は環境別に明示し、preview の RP ID 混入を本番へ持ち込まない。
+- **公開 URL**: Web の公開 URL と API の公開 URL を環境変数で分ける。例: `PUBLIC_WEB_ORIGIN` は WebAuthn の `expectedOrigin`、`PUBLIC_API_ORIGIN` または `NEXT_PUBLIC_API_BASE_URL` は REST 呼び出し先。registration / authentication options 生成時の RP 表示名、RP ID、origin 検証値は `PUBLIC_WEB_ORIGIN` から導く。
+- **Cookie ドメイン**: セッション Cookie は `Secure`、`HttpOnly`、`SameSite=Lax` を基本とする。同一ホストまたは API を Web と同一オリジンに見せられる構成では `__Host-` prefix を使い、`Domain` 属性は付けない。Web と API をサブドメイン分割し、credentials 付き cross-origin が必要な場合のみ `Domain=.example.com` 相当を検討するが、その場合は `__Host-` prefix は使えない。
+- **CORS**: credentials 付き request を許可する origin は Web の公開 URL の明示リストに限定する。`Access-Control-Allow-Credentials: true` と wildcard origin は併用しない。`Vary: Origin` を付け、allowed methods / headers は登録・認証・書き込み API に必要な範囲へ絞る。
 
 ## Email Verification
 
-MVP ではメール検証を **必須にしない**。理由は、数十人規模の実験ではメール送信基盤の固定費・運用・到達性対応が認証本体より大きくなりやすいためである。
+MVP ではメール検証を **採用しない**。S1 はパスキーのみで登録・ログインを成立させるため、メールアドレスは初期登録の必須識別子にしない。理由は、数十人規模の実験ではメール送信基盤の固定費・運用・到達性対応が認証本体より大きくなりやすく、パスワードレス方針とも責務がずれるためである。
 
-アカウント復旧、通知、不正利用対策が必要になった段階で、メールアドレスと検証済み状態を追加する。追加時も、GT 閲覧は未ログインで可能なまま維持し、投稿・返信・本人削除の書き込み境界だけを強化する。
+メールアドレスと検証済み状態は **将来候補** とする。採用条件は、アカウント復旧、通知、不正利用対策、複数デバイス移行のいずれかが MVP の実利用で問題になった場合。追加時も、GT 閲覧は未ログインで可能なまま維持し、投稿・返信・本人削除の書き込み境界だけを強化する。
 
 ## Session Source of Truth
 
-MVP のセッション状態の単一正本は **Neon Postgres** とする。署名付き httpOnly Cookie はセッション識別子またはアカウント識別子を運ぶための transport とし、最終的な有効性、失効、ローテーション、アカウントとの対応は Neon 側のレコードで判断する。
+MVP のセッション状態の単一正本は **Neon Postgres** とする。署名付き httpOnly Cookie はセッション識別子を運ぶための transport とし、最終的な有効性、失効、ローテーション、アカウントとの対応は Neon 側のレコードで判断する。Cookie には credential ID や公開鍵、account profile を載せない。
 
 KV は MVP では採用しない。Cloudflare KV は低遅延キャッシュには向くが、セッション失効や本人削除の認可境界では整合性の説明が複雑になるため、初期実装では Neon に寄せる。将来、読み取り負荷やレイテンシが問題になった場合のみ、短 TTL の補助キャッシュとして再検討する。
 
@@ -50,11 +59,12 @@ KV は MVP では採用しない。Cloudflare KV は低遅延キャッシュに
 
 - 認証セッションは投稿・返信・本人削除の前提とする。
 - GT の閲覧 API/UI は未ログインでも成立させる。
-- ベンダー固定、具体的な DB スキーマ、復旧フローの詳細は実装タスク側で決める。
+- WebAuthn の具体的な DB スキーマ、復旧フローの詳細は実装タスク側で決める。ただし、credential と session の正本は Neon から動かさない。
 - 電話番号を必須識別子にしない。
+- パスワードを必須識別子にしない。
 
 ## Consequences
 
-- SMS コストと電話番号収集を避けられる。
-- パスキー非対応環境でもパスワードで利用できる。
-- TOTP 導入により復旧フローの検討が必要になるため、MVP では任意設定として実装範囲を制御する。
+- SMS コスト、電話番号収集、パスワードリセット運用を避けられる。
+- パスキー非対応環境では MVP を利用できない可能性がある。初期の実験規模では許容し、必要なら将来メール検証または別認証を追加する。
+- 復旧導線は弱くなるため、少なくとも複数端末登録または再登録時の運用ルールを実装タスクで検討する。
diff --git a/docs/orchestration/design.md b/docs/orchestration/design.md
index 97e835e..5d0fc2c 100644
--- a/docs/orchestration/design.md
+++ b/docs/orchestration/design.md
@@ -8,7 +8,7 @@
 
 **Design で確定した認証の要点（ユーザー回答の要約）**: GT は **未ログインでも読める**。投稿・返信は **ログイン必須**。通報・管理者削除は **MVP に含めない**。
 
-**認証方式の決定**: `tc.authgate` により、MVP は **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP** とし、**SMS は採用しない**。詳細は **`authentication.md`** を正とする。
+**認証方式の決定**: `tc.authgate` により、MVP は **S1: パスキー（WebAuthn）によるパスワードレス認証** とし、**パスワード、TOTP、SMS は採用しない**。Hono on Workers 上で `@simplewebauthn/server` を使い、クレデンシャルとセッションの正本は Neon、ブラウザには httpOnly Cookie を発行する。詳細は **`authentication.md`** を正とする。
 
 ## Architecture Policy
 
@@ -68,7 +68,7 @@ flowchart LR
 - **投稿・返信**: **ログイン必須**（ユーザー確認済み）。
 - **本人削除**: **自分の投稿・返信（変換後の公開句）を削除できる**ことを MVP に含める（ユーザー確認済み）。**Scope の M6** と一致する。
 - **通報・管理者削除**: **MVP には含めない**（ユーザー確認済み）。リスクとして Design で認識し、後続で検討。
-- **認証方式**: **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP** を MVP の組み合わせとする。**SMS は採用しない**。ベンダー固定や詳細フローは **`authentication.md`** の境界に従い、実装タスク側で決める。
+- **認証方式**: **S1: パスキー（WebAuthn）によるパスワードレス認証** を MVP の方式とする。**パスワード、TOTP、SMS は採用しない**。`@simplewebauthn/server` の Workers 適合、RP ID、公開 URL、Cookie ドメイン、CORS、メール検証の扱いは **`authentication.md`** の境界に従い、実装タスク側で検証を固定する。
 
 ## llm-task-orchestrator Boundary
 
diff --git a/docs/orchestration/intermediate-plan.json b/docs/orchestration/intermediate-plan.json
index facdd77..5048430 100644
--- a/docs/orchestration/intermediate-plan.json
+++ b/docs/orchestration/intermediate-plan.json
@@ -123,7 +123,7 @@
     {
       "id": "tc.authgate",
       "title": "認証方式の決定ゲート",
-      "description": "パスワード／パスキー／TOTP の組み合わせを記録。SMS 従量依存は避ける（Design）。",
+      "description": "S1: パスキー（WebAuthn）によるパスワードレス認証を記録。@simplewebauthn/server on Hono Workers、Neon の credential/session、httpOnly Cookie、RP/CORS/メール検証境界を含める。",
       "milestoneId": "ms.auth",
       "status": "candidate",
       "allowedPathCandidateIds": ["ap.docs.orch"],
@@ -329,7 +329,7 @@
     { "id": "ac.tc.neon", "description": "Hyperdrive 経由で Neon 接続を再現できる。", "source": "plan", "taskCandidateIds": ["tc.neon"] },
     { "id": "ac.tc.schema", "description": "最小エンティティのマイグレーション適用が手順どおり再現できる。", "source": "plan", "taskCandidateIds": ["tc.schema"] },
     { "id": "ac.tc.timeline", "description": "未認証でタイムライン JSON が取得できる。", "source": "plan", "taskCandidateIds": ["tc.timeline"] },
-    { "id": "ac.tc.authgate", "description": "認証方式が orchestration 文書に記録される。", "source": "plan", "taskCandidateIds": ["tc.authgate"] },
+    { "id": "ac.tc.authgate", "description": "S1 パスキー方針、Workers 上の SimpleWebAuthn スパイク結果、RP ID・公開 URL・Cookie ドメイン・CORS・メール検証方針が orchestration 文書に記録される。", "source": "plan", "taskCandidateIds": ["tc.authgate"] },
     { "id": "ac.tc.session", "description": "書き込み API が未認証で拒否される。", "source": "plan", "taskCandidateIds": ["tc.session"] },
     { "id": "ac.tc.transform-arch-gate", "description": "transform-architecture.md に同期性・失敗 UX・冪等・コストが ADR で記載される。", "source": "plan", "taskCandidateIds": ["tc.transform-arch-gate"] },
     { "id": "ac.tc.nextshell", "description": "Next がビルドしレイアウトが載る。", "source": "plan", "taskCandidateIds": ["tc.nextshell"] },
diff --git a/docs/orchestration/plan.md b/docs/orchestration/plan.md
index f8389ce..67b0738 100644
--- a/docs/orchestration/plan.md
+++ b/docs/orchestration/plan.md
@@ -2,7 +2,7 @@
 
 ## Source Design
 
-この Plan は、セッション `tsukeai` の **`design.md`** および **`design.coverage.json`** を唯一の上流の方式・境界入力とする。Neon（東京）＋ Hyperdrive、Hono on Cloudflare Workers、Next.js App Router（SSR）、REST（JSON）、モノレポ（pnpm workspaces／Turborepo）、Biome 単一、GT 未ログイン閲覧、投稿／返信はログイン必須、本人削除（M6）、通報／管理者削除は MVP 外、といった Design の確定事項を前提に分解する。認証方式は **`authentication.md`** で **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP、SMS 不採用**として記録済み。
+この Plan は、セッション `tsukeai` の **`design.md`** および **`design.coverage.json`** を唯一の上流の方式・境界入力とする。Neon（東京）＋ Hyperdrive、Hono on Cloudflare Workers、Next.js App Router（SSR）、REST（JSON）、モノレポ（pnpm workspaces／Turborepo）、Biome 単一、GT 未ログイン閲覧、投稿／返信はログイン必須、本人削除（M6）、通報／管理者削除は MVP 外、といった Design の確定事項を前提に分解する。認証方式は **`authentication.md`** で **S1: パスキー（WebAuthn）によるパスワードレス認証、パスワード／TOTP／SMS 不採用、Neon にクレデンシャル／セッション、httpOnly Cookie** として記録済み。
 
 実装リポジトリの Bootstrap 先は **`/Users/akyrhysd/work/tsukeai`** とする（ユーザーが Bootstrap を実行済み。フォルダ名は環境に合わせてよい）。
 

```

## JSON Only Response Schema
```json
{
  "decision": "accept" | "reject",
  "summary": "string",
  "requiredFixes": ["string"],
  "riskNotes": ["string"],
  "scopeViolations": ["string"]
}
```

## Reviewer Instructions
- コードを修正しないこと。
- 判定だけを返すこと。
- JSON only で返すこと。
- scope violation を明示すること。
- required fixes は短く具体的にすること。