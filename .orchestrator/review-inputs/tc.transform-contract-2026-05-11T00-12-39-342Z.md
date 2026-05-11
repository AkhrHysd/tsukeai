# Review Task

Task ID: tc.transform-contract
Title: 変換ジョブの契約（状態・冪等・エラー）

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-contract

## Description
ADR に基づき状態機械と観測・冪等キーを共有パッケージに載せる方針まで。

## Allowed Paths
- packages/shared
- docs/orchestration

## Acceptance Criteria
- 変換ジョブの状態・冪等・エラーが共有契約で説明できる。

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

> tanka-reply-sns@0.0.0 test
> pnpm --filter @tanka-reply-sns/web test


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-contract/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-contract/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- docs/orchestration/transform-architecture.md
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/docs/orchestration/transform-architecture.md b/docs/orchestration/transform-architecture.md
index bdaec7b..bc925cb 100644
--- a/docs/orchestration/transform-architecture.md
+++ b/docs/orchestration/transform-architecture.md
@@ -27,6 +27,17 @@ MVP の変換アーキテクチャは **非同期ジョブを正とし、短時
 
 ジョブ状態は少なくとも `queued`、`processing`、`succeeded`、`failed`、`rejected` を持つ。`failed` は一時障害やタイムアウト後の失敗、`rejected` は検証失敗や入力制約違反など再試行しても同じ結果になりやすい失敗を表す。
 
+### Shared Transform Contract
+
+変換ジョブの共有契約は `packages/shared/src/index.ts` を正本とする。API、Web、将来のジョブ実行部は、状態名・冪等キー・公開エラー・観測項目をこの契約から参照する。
+
+- **状態機械**: `TransformJobState` は `queued` → `processing` → `succeeded | failed | rejected` を表す。許可する遷移は `TRANSFORM_JOB_STATE_TRANSITIONS` に列挙し、`TransformTerminalJobState` は `succeeded`、`failed`、`rejected` のみとする。終端状態から別状態へ戻さない。
+- **対象種別**: `TransformJobKind` は `post_575` と `reply_77` とする。投稿は 5-7-5、返信は 7-7 の変換契約に対応する。
+- **冪等キー**: `TransformIdempotencyScope` は `userId`、`kind`、任意の `parentPostId`、`inputHash`、クライアント発行の `clientKey` で構成する。同じ scope の再送は同じ `TransformJobDto`、または同じ公開結果 ID を含む `TransformJobDto` を返す。
+- **公開結果**: `TransformJobDto` はジョブ状態に加え、成功時に `publishedPostId` または `publishedReplyId` を持つ。素入力本文や LLM の生レスポンスは DTO に含めない。
+- **エラー分類**: `TransformJobErrorDto` は利用者に返す `TransformPublicErrorCode` と、運用観測用の `TransformFailureReason` を分ける。`failed` は `retry_later`、`rejected` は原則 `revise_input` の `TransformUserAction` に対応する。
+- **観測項目**: `TransformJobObservationDto` は `jobId`、`state`、`reason`、`attempts`、`durationMs`、`estimatedCostMicros`、`model`、`inputHash`、時刻を持つ。素入力、prompt body、LLM 生レスポンス、provider error body は含めない。
+
 ### Prompting and Logging Operations
 
 - プロンプトはサーバ側で組み立てる。クライアントはモデル名、system prompt、出力制約、再試行条件を指定できない。
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 514b7f4..00588ad 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -12,7 +12,10 @@ export type ApiErrorCode =
   | "conflict"
   | "rate_limited"
   | "internal_error"
-  | "service_unavailable";
+  | "service_unavailable"
+  | "transform_failed"
+  | "transform_input_rejected"
+  | "transform_limit_exceeded";
 
 export type ApiErrorDto = {
   code: ApiErrorCode;
@@ -30,6 +33,106 @@ export type ApiErrorResponseDto = {
   error: ApiErrorDto;
 };
 
+export const TRANSFORM_JOB_STATES = [
+  "queued",
+  "processing",
+  "succeeded",
+  "failed",
+  "rejected",
+] as const;
+
+export type TransformJobState = (typeof TRANSFORM_JOB_STATES)[number];
+
+export const TRANSFORM_TERMINAL_JOB_STATES = [
+  "succeeded",
+  "failed",
+  "rejected",
+] as const satisfies readonly TransformJobState[];
+
+export type TransformTerminalJobState =
+  (typeof TRANSFORM_TERMINAL_JOB_STATES)[number];
+
+export const TRANSFORM_JOB_STATE_TRANSITIONS = [
+  ["queued", "processing"],
+  ["queued", "failed"],
+  ["queued", "rejected"],
+  ["processing", "succeeded"],
+  ["processing", "failed"],
+  ["processing", "rejected"],
+] as const satisfies readonly (readonly [TransformJobState, TransformJobState])[];
+
+export type TransformJobStateTransition =
+  (typeof TRANSFORM_JOB_STATE_TRANSITIONS)[number];
+
+export type TransformJobKind = "post_575" | "reply_77";
+
+export type TransformIdempotencyScope = {
+  userId: EntityId;
+  kind: TransformJobKind;
+  parentPostId?: EntityId;
+  inputHash: string;
+  clientKey: string;
+};
+
+export type TransformRetryPolicy = "server_retryable" | "client_revisable";
+
+export type TransformUserAction = "retry_later" | "revise_input";
+
+export type TransformPublicErrorCode = Extract<
+  ApiErrorCode,
+  "transform_failed" | "transform_input_rejected" | "transform_limit_exceeded"
+>;
+
+export type TransformFailureReason =
+  | "timeout"
+  | "rate_limited"
+  | "provider_unavailable"
+  | "provider_rejected"
+  | "invalid_provider_response"
+  | "input_limit_exceeded"
+  | "output_limit_exceeded"
+  | "cost_limit_exceeded"
+  | "validation_failed"
+  | "prompt_injection_detected"
+  | "unauthorized"
+  | "configuration_error";
+
+export type TransformJobErrorDto = {
+  code: TransformPublicErrorCode;
+  reason: TransformFailureReason;
+  message: string;
+  retryPolicy: TransformRetryPolicy;
+  userAction: TransformUserAction;
+};
+
+export type TransformJobObservationDto = {
+  jobId: EntityId;
+  state: TransformJobState;
+  reason?: TransformFailureReason;
+  attempts: number;
+  durationMs?: number;
+  estimatedCostMicros?: number;
+  model?: string;
+  inputHash: string;
+  createdAt: IsoDateTimeString;
+  updatedAt: IsoDateTimeString;
+};
+
+export type TransformJobDto = {
+  id: EntityId;
+  kind: TransformJobKind;
+  state: TransformJobState;
+  idempotency: TransformIdempotencyScope;
+  observation: TransformJobObservationDto;
+  publishedPostId?: EntityId;
+  publishedReplyId?: EntityId;
+  error?: TransformJobErrorDto;
+};
+
+export type TransformJobResponseDto = {
+  job: TransformJobDto;
+};
+
 export type AuthorDto = {
   id: EntityId;
   displayName: string;

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