# Review Task

Task ID: tc.transform-contract
Title: 変換ジョブの契約（状態・冪等・エラー）

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.transform-contract

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
logs: test: skipped by task validationPolicy

## Changed Files
- docs/orchestration/transform-architecture.md
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/docs/orchestration/transform-architecture.md b/docs/orchestration/transform-architecture.md
index 4edbbbc..fe68057 100644
--- a/docs/orchestration/transform-architecture.md
+++ b/docs/orchestration/transform-architecture.md
@@ -74,10 +74,11 @@ MVP の変換アーキテクチャは **非同期ジョブを正とし、短時
 変換ジョブの共有契約は `packages/shared/src/index.ts` を正本とする。API、Web、将来のジョブ実行部は、状態名・冪等キー・公開エラー・観測項目をこの契約から参照する。
 
 - **状態機械**: `TransformJobState` は `queued` → `processing` → `succeeded | failed | rejected` を表す。許可する遷移は `TRANSFORM_JOB_STATE_TRANSITIONS` に列挙し、`TransformTerminalJobState` は `succeeded`、`failed`、`rejected` のみとする。終端状態から別状態へ戻さない。
+- **状態判定**: 実装は `isTransformActiveJobState`、`isTransformTerminalJobState`、`canTransitionTransformJobState` を使って、ポーリング表示、終端再利用、排他更新時の遷移検証を同じ状態機械に寄せる。
 - **対象種別**: `TransformJobKind` は `post_575` と `reply_77` とする。投稿は 5-7-5、返信は 7-7 の変換契約に対応する。
 - **冪等キー**: `TransformIdempotencyScope` は `userId`、`kind`、任意の `parentPostId`、`inputHash`、クライアント発行の `clientKey` で構成する。同じ scope の再送は同じ `TransformJobDto`、または同じ公開結果 ID を含む `TransformJobDto` を返す。
 - **公開結果**: `TransformJobDto` はジョブ状態に加え、成功時に `publishedPostId` または `publishedReplyId` を持つ。素入力本文や LLM の生レスポンスは DTO に含めない。
-- **エラー分類**: `TransformJobErrorDto` は利用者に返す `TransformPublicErrorCode` と、運用観測用の `TransformFailureReason` を分ける。`failed` は `retry_later`、`rejected` は原則 `revise_input` の `TransformUserAction` に対応する。
+- **エラー分類**: `TransformJobErrorDto` は利用者に返す `TransformPublicErrorCode` と、運用観測用の `TransformFailureReason` を分ける。`TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS` は `failed` と `retry_later`、`TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS` は原則 `rejected` と `revise_input` に対応する。`TransformFailureReason` の全値は型検査でどちらか一方の分類に明示所属させ、未分類や重複分類を許さない。`content_policy_violation` は入力修正可能な拒否として `TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS` に含め、公開コードは `transform_input_rejected` とする。公開コードとユーザー行動は `getTransformPublicErrorCode`、`getTransformRetryPolicy`、`getTransformUserAction` で共有契約から導出し、レスポンス生成時は `createTransformJobErrorDto` で整合させる。
 - **観測項目**: `TransformJobObservationDto` は `jobId`、`state`、`reason`、`attempts`、`durationMs`、`estimatedCostMicros`、`model`、`inputHash`、時刻を持つ。素入力、prompt body、LLM 生レスポンス、provider error body は含めない。
 
 ### Prompting and Logging Operations
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 4058e0c..d108def 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -56,6 +56,13 @@ export const TRANSFORM_TERMINAL_JOB_STATES = [
 
 export type TransformTerminalJobState = (typeof TRANSFORM_TERMINAL_JOB_STATES)[number];
 
+export const TRANSFORM_ACTIVE_JOB_STATES = [
+  "queued",
+  "processing",
+] as const satisfies readonly TransformJobState[];
+
+export type TransformActiveJobState = (typeof TRANSFORM_ACTIVE_JOB_STATES)[number];
+
 export const TRANSFORM_JOB_STATE_TRANSITIONS = [
   ["queued", "processing"],
   ["queued", "failed"],
@@ -67,6 +74,27 @@ export const TRANSFORM_JOB_STATE_TRANSITIONS = [
 
 export type TransformJobStateTransition = (typeof TRANSFORM_JOB_STATE_TRANSITIONS)[number];
 
+export function isTransformTerminalJobState(
+  state: TransformJobState,
+): state is TransformTerminalJobState {
+  return TRANSFORM_TERMINAL_JOB_STATES.some((terminalState) => terminalState === state);
+}
+
+export function isTransformActiveJobState(
+  state: TransformJobState,
+): state is TransformActiveJobState {
+  return TRANSFORM_ACTIVE_JOB_STATES.some((activeState) => activeState === state);
+}
+
+export function canTransitionTransformJobState(
+  from: TransformJobState,
+  to: TransformJobState,
+): boolean {
+  return TRANSFORM_JOB_STATE_TRANSITIONS.some(
+    ([transitionFrom, transitionTo]) => transitionFrom === from && transitionTo === to,
+  );
+}
+
 export type TransformJobKind = "post_575" | "reply_77";
 
 export const TRANSFORM_FORM_RULES = {
@@ -127,9 +155,102 @@ export type TransformFailureReason =
   | "cost_limit_exceeded"
   | "validation_failed"
   | "prompt_injection_detected"
+  | "content_policy_violation"
   | "unauthorized"
   | "configuration_error";
 
+export const TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS = [
+  "timeout",
+  "rate_limited",
+  "provider_unavailable",
+  "invalid_provider_response",
+  "configuration_error",
+] as const satisfies readonly TransformFailureReason[];
+
+export type TransformServerRetryableFailureReason =
+  (typeof TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS)[number];
+
+export const TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS = [
+  "provider_rejected",
+  "input_limit_exceeded",
+  "output_limit_exceeded",
+  "cost_limit_exceeded",
+  "validation_failed",
+  "prompt_injection_detected",
+  "content_policy_violation",
+  "unauthorized",
+] as const satisfies readonly TransformFailureReason[];
+
+export type TransformClientRevisableFailureReason =
+  (typeof TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS)[number];
+
+export type ClassifiedTransformFailureReason =
+  | TransformServerRetryableFailureReason
+  | TransformClientRevisableFailureReason;
+
+type AssertTransformFailureReasonClassification<T extends never> = T;
+export type TransformFailureReasonClassificationExhaustive =
+  AssertTransformFailureReasonClassification<
+    Exclude<TransformFailureReason, ClassifiedTransformFailureReason>
+  >;
+export type TransformFailureReasonClassificationExclusive =
+  AssertTransformFailureReasonClassification<
+    Extract<TransformServerRetryableFailureReason, TransformClientRevisableFailureReason>
+  >;
+
+export function isTransformServerRetryableFailureReason(
+  reason: TransformFailureReason,
+): reason is TransformServerRetryableFailureReason {
+  return TRANSFORM_SERVER_RETRYABLE_FAILURE_REASONS.some(
+    (retryableReason) => retryableReason === reason,
+  );
+}
+
+export function isTransformClientRevisableFailureReason(
+  reason: TransformFailureReason,
+): reason is TransformClientRevisableFailureReason {
+  return TRANSFORM_CLIENT_REVISABLE_FAILURE_REASONS.some(
+    (revisableReason) => revisableReason === reason,
+  );
+}
+
+export function getTransformRetryPolicy(reason: TransformFailureReason): TransformRetryPolicy {
+  if (isTransformServerRetryableFailureReason(reason)) {
+    return "server_retryable";
+  }
+
+  if (isTransformClientRevisableFailureReason(reason)) {
+    return "client_revisable";
+  }
+
+  const unclassifiedReason: never = reason;
+  throw new Error(`Unclassified transform failure reason: ${unclassifiedReason}`);
+}
+
+export function getTransformUserAction(reason: TransformFailureReason): TransformUserAction {
+  return getTransformRetryPolicy(reason) === "server_retryable"
+    ? "retry_later"
+    : "revise_input";
+}
+
+export function getTransformPublicErrorCode(
+  reason: TransformFailureReason,
+): TransformPublicErrorCode {
+  if (
+    reason === "input_limit_exceeded" ||
+    reason === "output_limit_exceeded" ||
+    reason === "cost_limit_exceeded"
+  ) {
+    return "transform_limit_exceeded";
+  }
+
+  if (getTransformRetryPolicy(reason) === "client_revisable") {
+    return "transform_input_rejected";
+  }
+
+  return "transform_failed";
+}
+
 export type TransformJobErrorDto = {
   code: TransformPublicErrorCode;
   reason: TransformFailureReason;
@@ -138,6 +259,19 @@ export type TransformJobErrorDto = {
   userAction: TransformUserAction;
 };
 
+export function createTransformJobErrorDto(
+  reason: TransformFailureReason,
+  message: string,
+): TransformJobErrorDto {
+  return {
+    code: getTransformPublicErrorCode(reason),
+    reason,
+    message,
+    retryPolicy: getTransformRetryPolicy(reason),
+    userAction: getTransformUserAction(reason),
+  };
+}
+
 export type TransformJobObservationDto = {
   jobId: EntityId;
   state: TransformJobState;
@@ -168,6 +302,7 @@ export type TransformJobResponseDto = {
 
 export type BoundaryTransformJobState = TransformJobState;
 export type BoundaryTransformTerminalJobState = TransformTerminalJobState;
+export type BoundaryTransformActiveJobState = TransformActiveJobState;
 export type BoundaryTransformJobKind = TransformJobKind;
 export type BoundaryTransformFormCheckReason = TransformFormCheckReason;
 export type BoundaryTransformFormCheckSegmentDto = TransformFormCheckSegment;
@@ -178,6 +313,10 @@ export type BoundaryTransformRetryPolicy = TransformRetryPolicy;
 export type BoundaryTransformUserAction = TransformUserAction;
 export type BoundaryTransformPublicErrorCode = TransformPublicErrorCode;
 export type BoundaryTransformFailureReason = TransformFailureReason;
+export type BoundaryTransformServerRetryableFailureReason =
+  TransformServerRetryableFailureReason;
+export type BoundaryTransformClientRevisableFailureReason =
+  TransformClientRevisableFailureReason;
 export type BoundaryTransformJobErrorDto = TransformJobErrorDto;
 export type BoundaryTransformJobObservationDto = TransformJobObservationDto;
 export type BoundaryTransformJobDto = TransformJobDto;

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