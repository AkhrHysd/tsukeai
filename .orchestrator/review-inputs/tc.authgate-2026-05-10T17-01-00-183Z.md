# Review Task

Task ID: tc.authgate
Title: 認証方式の決定ゲート

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.authgate

## Description
パスワード／パスキー／TOTP の組み合わせを記録。SMS 従量依存は避ける（Design）。

## Allowed Paths
- docs/orchestration

## Acceptance Criteria
- 認証方式が orchestration 文書に記録される。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: $ npm test
skipped:
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_01_00_143Z-debug-0.log

## Changed Files
- docs/orchestration/design.md
- docs/orchestration/plan.md
- docs/orchestration/authentication.md

## Unified Diff
```diff
diff --git a/docs/orchestration/design.md b/docs/orchestration/design.md
index 8c82fd5..97e835e 100644
--- a/docs/orchestration/design.md
+++ b/docs/orchestration/design.md
@@ -8,6 +8,8 @@
 
 **Design で確定した認証の要点（ユーザー回答の要約）**: GT は **未ログインでも読める**。投稿・返信は **ログイン必須**。通報・管理者削除は **MVP に含めない**。
 
+**認証方式の決定**: `tc.authgate` により、MVP は **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP** とし、**SMS は採用しない**。詳細は **`authentication.md`** を正とする。
+
 ## Architecture Policy
 
 **公開インターネット向け Web**。利用は **数十人の実験**を想定し、**計画的停止・短時間のダウンは許容**する。 **LLM 以外の固定費は極力抑え**、可能なら無料枠を活用する。**東京リージョンを優先**し、国内からの利用体感をよくする。
@@ -66,7 +68,7 @@ flowchart LR
 - **投稿・返信**: **ログイン必須**（ユーザー確認済み）。
 - **本人削除**: **自分の投稿・返信（変換後の公開句）を削除できる**ことを MVP に含める（ユーザー確認済み）。**Scope の M6** と一致する。
 - **通報・管理者削除**: **MVP には含めない**（ユーザー確認済み）。リスクとして Design で認識し、後続で検討。
-- **セキュリティ志向（料金不要の範囲）**: **SMS のような従量前提に依存しない**前提で、**WebAuthn／パスキーまたは TOTP 等の 2FA クラス**を志向する（ユーザー発言に基づく）。**パスワードのみ／パスキーのみ／併用などの組み合わせは、実装作業に着手する前に確定**する。Design は **志向と境界**までとし、**ベンダー固定や詳細フローは書かない**。
+- **認証方式**: **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP** を MVP の組み合わせとする。**SMS は採用しない**。ベンダー固定や詳細フローは **`authentication.md`** の境界に従い、実装タスク側で決める。
 
 ## llm-task-orchestrator Boundary
 
diff --git a/docs/orchestration/plan.md b/docs/orchestration/plan.md
index 9bfb611..cb8e8d3 100644
--- a/docs/orchestration/plan.md
+++ b/docs/orchestration/plan.md
@@ -2,7 +2,7 @@
 
 ## Source Design
 
-この Plan は、セッション `tanka-reply-sns` の **`design.md`** および **`design.coverage.json`** を唯一の上流の方式・境界入力とする。Neon（東京）＋ Hyperdrive、Hono on Cloudflare Workers、Next.js App Router（SSR）、REST（JSON）、モノレポ（pnpm workspaces／Turborepo）、Biome 単一、GT 未ログイン閲覧、投稿／返信はログイン必須、本人削除（M6）、通報／管理者削除は MVP 外、といった Design の確定事項を前提に分解する。
+この Plan は、セッション `tanka-reply-sns` の **`design.md`** および **`design.coverage.json`** を唯一の上流の方式・境界入力とする。Neon（東京）＋ Hyperdrive、Hono on Cloudflare Workers、Next.js App Router（SSR）、REST（JSON）、モノレポ（pnpm workspaces／Turborepo）、Biome 単一、GT 未ログイン閲覧、投稿／返信はログイン必須、本人削除（M6）、通報／管理者削除は MVP 外、といった Design の確定事項を前提に分解する。認証方式は **`authentication.md`** で **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP、SMS 不採用**として記録済み。
 
 実装リポジトリの Bootstrap 先は **`/Users/akyrhysd/work/tanka-reply-sns`** とする（ユーザーが Bootstrap を実行済み）。
 
@@ -39,7 +39,7 @@ Plan は **タスク候補・依存・パス候補・Done 条件・検証／レ
 おおまかな筋:
 
 - 共有契約とモノレポ → API コア → 公開タイムライン読み取り。
-- 認証方式決定 → セッション境界。
+- 認証方式決定（`authentication.md`） → セッション境界。
 - **スキーマとセッションが揃ったうえで `tc.transform-arch-gate`**（3.5）。その後に変換契約・LLM アダプタ・各変換フロー。
 - GT SSR は公開 API と Next シェルに依存。
 - 書き込み E2E は変換経路と削除が整理されるまで blocked。

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