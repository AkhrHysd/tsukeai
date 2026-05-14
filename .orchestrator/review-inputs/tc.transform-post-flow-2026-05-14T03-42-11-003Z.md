# Review Task

Task ID: tc.transform-post-flow
Title: 投稿変換フロー実装候補

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.transform-post-flow

## Description
素→5-7-5。パイプライン詳細は ADR へ合わせる。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 投稿パイプラインが ADR とポリシーに一致する。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/src/index.ts
- apps/api/src/llm-adapter.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 4477a98..ee9c0d0 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1,6 +1,7 @@
 import {
-  type ApiErrorCode,
   checkTransformForm,
+  getTransformRetryPolicy,
+  type ApiErrorCode,
   type PostDto,
   type ReplyDto,
   type TimelineItemDto,
@@ -369,7 +370,7 @@ async function sha256Hex(value: string): Promise<string> {
 }
 
 function toRetryPolicy(classification: TransformFailureClassification): TransformRetryPolicy {
-  return classification.retryable ? "server_retryable" : "client_revisable";
+  return getTransformRetryPolicy(classification.logCode);
 }
 
 function toTransformJobDto(row: TransformJobRow): TransformJobDto {
@@ -744,6 +745,19 @@ async function publishPostTransformJob(
   return sql.begin(async (transaction) => {
     const publicConversionId = crypto.randomUUID();
     const threadId = crypto.randomUUID();
+    const [runnableJob] = await transaction<{ id: string }[]>`
+      select id::text
+      from transform_jobs
+      where
+        id = ${job.id}::uuid
+        and state = 'processing'
+        and public_conversion_id is null
+      for update
+    `;
+
+    if (!runnableJob) {
+      return undefined;
+    }
 
     await transaction`
       insert into threads (id)
@@ -782,6 +796,8 @@ async function publishPostTransformJob(
         model = ${model},
         updated_at = now()
       where id = ${job.id}::uuid
+        and state = 'processing'
+        and public_conversion_id is null
       returning
         id::text,
         account_id::text,
@@ -820,6 +836,20 @@ async function publishReplyTransformJob(
   }
 
   return sql.begin(async (transaction) => {
+    const [runnableJob] = await transaction<{ id: string }[]>`
+      select id::text
+      from transform_jobs
+      where
+        id = ${job.id}::uuid
+        and state = 'processing'
+        and public_conversion_id is null
+      for update
+    `;
+
+    if (!runnableJob) {
+      return undefined;
+    }
+
     const [parentPost] = await transaction<ReplyParentPostRow[]>`
       select
         p.id::text,
@@ -872,6 +902,8 @@ async function publishReplyTransformJob(
         model = ${model},
         updated_at = now()
       where id = ${job.id}::uuid
+        and state = 'processing'
+        and public_conversion_id is null
       returning
         id::text,
         account_id::text,
@@ -939,7 +971,10 @@ async function markTransformJobFailed(
       duration_ms = ${durationMs},
       model = ${model ?? null},
       updated_at = now()
-    where id = ${jobId}::uuid
+    where
+      id = ${jobId}::uuid
+      and state = 'processing'
+      and public_conversion_id is null
     returning
       id::text,
       account_id::text,
@@ -961,7 +996,7 @@ async function markTransformJobFailed(
       to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
   `;
 
-  return row;
+  return row ?? selectTransformJob(sql, jobId);
 }
 
 async function runTransformJob(
@@ -1084,11 +1119,15 @@ async function waitForTransformJob(
 function responseStatusForTransformJob(
   job: TransformJobRow,
   created: boolean,
-): 200 | 201 | 202 | 422 | 503 {
+): 200 | 201 | 202 | 422 | 429 | 503 {
   if (job.state === "succeeded") {
     return created ? 201 : 200;
   }
 
+  if (job.error_code === "transform_limit_exceeded") {
+    return 429;
+  }
+
   if (job.state === "rejected") {
     return 422;
   }
diff --git a/apps/api/src/llm-adapter.ts b/apps/api/src/llm-adapter.ts
index ec4a25f..f9927e4 100644
--- a/apps/api/src/llm-adapter.ts
+++ b/apps/api/src/llm-adapter.ts
@@ -1,4 +1,14 @@
-import { checkTransformForm, TRANSFORM_FORM_RULES, type TransformJobKind } from "@tsukeai/shared";
+import {
+  checkTransformForm,
+  getTransformPublicErrorCode,
+  getTransformRetryPolicy,
+  getTransformUserAction,
+  TRANSFORM_FORM_RULES,
+  type TransformFailureReason,
+  type TransformJobKind,
+  type TransformPublicErrorCode,
+  type TransformUserAction,
+} from "@tsukeai/shared";
 
 export type LlmAdapterBindings = {
   LLM_API_KEY?: string;
@@ -26,7 +36,8 @@ export type TransformTextResponse = {
   durationMs: number;
 };
 
-export type LlmAdapterErrorCode =
+export type LlmAdapterErrorCode = Extract<
+  TransformFailureReason,
   | "configuration_error"
   | "cost_limit_exceeded"
   | "input_limit_exceeded"
@@ -37,19 +48,20 @@ export type LlmAdapterErrorCode =
   | "provider_unavailable"
   | "provider_rejected"
   | "invalid_provider_response"
-  | "validation_failed";
+  | "validation_failed"
+>;
 
 export type TransformFailureJobState = "failed" | "rejected";
 
-export type TransformFailureUserAction = "retry_later" | "revise_input";
+export type TransformFailureUserAction = TransformUserAction;
 
-export type TransformFailurePublicCode = "transform_failed" | "transform_input_rejected";
+export type TransformFailurePublicCode = TransformPublicErrorCode;
 
 export type TransformFailureClassification = {
   jobState: TransformFailureJobState;
   userAction: TransformFailureUserAction;
   publicCode: TransformFailurePublicCode;
-  httpStatus: 422 | 503;
+  httpStatus: 422 | 429 | 503;
   logCode: LlmAdapterErrorCode;
   retryable: boolean;
 };
@@ -232,14 +244,18 @@ export function createLlmAdapter(bindings: LlmAdapterBindings) {
 }
 
 export function classifyTransformFailure(error: LlmAdapterError): TransformFailureClassification {
+  const publicCode = getTransformPublicErrorCode(error.code);
+  const userAction = getTransformUserAction(error.code);
+  const retryable = getTransformRetryPolicy(error.code) === "server_retryable";
+
   if (error.code === "prompt_injection_detected") {
     return {
       jobState: "rejected",
-      userAction: "revise_input",
-      publicCode: "transform_input_rejected",
+      userAction,
+      publicCode,
       httpStatus: 422,
       logCode: error.code,
-      retryable: false,
+      retryable,
     };
   }
 
@@ -252,21 +268,21 @@ export function classifyTransformFailure(error: LlmAdapterError): TransformFailu
   ) {
     return {
       jobState: "rejected",
-      userAction: "revise_input",
-      publicCode: "transform_input_rejected",
-      httpStatus: 422,
+      userAction,
+      publicCode,
+      httpStatus: publicCode === "transform_limit_exceeded" ? 429 : 422,
       logCode: error.code,
-      retryable: false,
+      retryable,
     };
   }
 
   return {
     jobState: "failed",
-    userAction: "retry_later",
-    publicCode: "transform_failed",
+    userAction,
+    publicCode,
     httpStatus: 503,
     logCode: error.code,
-    retryable: error.retryable,
+    retryable,
   };
 }
 

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