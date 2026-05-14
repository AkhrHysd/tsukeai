# Review Task

Task ID: tc.llm-adapter
Title: Workers 上の LLM アダプタ

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.llm-adapter

## Description
タイムアウト・上限・Secrets。ゲートで決めた契約に従う。

## Allowed Paths
- apps/api

## Acceptance Criteria
- ADR の呼び出し契約に適合するアダプタが説明できる。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/ORCHESTRATION.md
- apps/api/src/llm-adapter.ts

## Unified Diff
```diff
diff --git a/apps/api/ORCHESTRATION.md b/apps/api/ORCHESTRATION.md
index e748a93..723c763 100644
--- a/apps/api/ORCHESTRATION.md
+++ b/apps/api/ORCHESTRATION.md
@@ -15,3 +15,57 @@ conversions.
 If Neon cannot be reached during session verification, protected writes fail
 closed with `503`. If the cookie is missing, invalid, or points at no active
 account, protected writes return `401`.
+
+## LLM Adapter Contract
+
+The transform ADR is `docs/orchestration/transform-architecture.md`; the API
+implementation point is `src/llm-adapter.ts` plus the job runner in
+`src/index.ts`.
+
+The adapter follows the ADR call contract as follows:
+
+- **Server-only call boundary**: the client sends only transform input and an
+  idempotency key to the API. The Worker builds the system/user messages, model
+  request, retry prompt, and provider request. `LLM_API_KEY` is read from Worker
+  bindings and must be configured as a Secret; it is never accepted from the
+  client or exposed in a response.
+- **Required provider configuration**: `LLM_API_KEY`, `LLM_BASE_URL`, and
+  `LLM_MODEL` are mandatory when a transform job executes. Missing or invalid
+  configuration is classified as `configuration_error` and the job fails without
+  publishing.
+- **Timeouts**: each provider attempt uses `LLM_TIMEOUT_MS` through an
+  `AbortController`. Timeouts become retryable `timeout` failures and are
+  reported to users as retry-later transform failures.
+- **Input and output limits**: `LLM_MAX_INPUT_CHARS` rejects oversized or blank
+  input before the provider call. `LLM_MAX_OUTPUT_TOKENS` is sent to the
+  provider and also bounds accepted response text length. Limit violations are
+  non-retryable rejected jobs.
+- **Bounded retries and call budget**: `LLM_MAX_RETRIES` is clamped by the
+  adapter and then capped again by the job runner's remaining call budget.
+  Retryable provider failures, rate limits, and timeouts may be retried; input
+  limits, prompt-injection signals, provider rejections, output limits, and form
+  validation failures are not retried after the configured attempts are
+  exhausted.
+- **Prompt and data boundary**: user input is normalized and encoded as JSON
+  string data inside the prompt. The client cannot choose the model, system
+  prompt, output rules, retry conditions, or token limits.
+- **Publication gate**: only output accepted by `checkTransformForm` is
+  published. Failed transforms are marked `failed` for temporary/provider
+  problems or `rejected` for revisable input/validation problems.
+- **Logging boundary**: transform logs include job ID, input hash, failure code,
+  retryability, attempts, duration, and model. They do not include the source
+  input, prompt body, raw provider response, provider error body, or rejected
+  output text.
+
+Runtime knobs are intentionally environment bindings, with conservative clamps
+inside the adapter:
+
+| Binding | Default | Clamp / requirement |
+| --- | ---: | --- |
+| `LLM_API_KEY` | none | required Secret |
+| `LLM_BASE_URL` | none | required absolute `http`/`https` URL |
+| `LLM_MODEL` | none | required non-blank model ID |
+| `LLM_TIMEOUT_MS` | `8000` | `1000` to `20000` |
+| `LLM_MAX_INPUT_CHARS` | `1000` | `1` to `4000` |
+| `LLM_MAX_OUTPUT_TOKENS` | `96` | `16` to `256` |
+| `LLM_MAX_RETRIES` | `1` | `0` to `2` retries, plus the first attempt |
diff --git a/apps/api/src/llm-adapter.ts b/apps/api/src/llm-adapter.ts
index 42fc6a7..ec4a25f 100644
--- a/apps/api/src/llm-adapter.ts
+++ b/apps/api/src/llm-adapter.ts
@@ -168,7 +168,6 @@ export function createLlmAdapter(bindings: LlmAdapterBindings) {
 
       const startedAt = Date.now();
       let lastError: LlmAdapterError | undefined;
-      let lastNormalizedOutput: string | undefined;
       let lastFormCheck: ReturnType<typeof checkTransformForm> | undefined;
       const maxAttempts = Math.min(
         config.maxAttempts,
@@ -190,7 +189,6 @@ export function createLlmAdapter(bindings: LlmAdapterBindings) {
             };
           }
 
-          lastNormalizedOutput = normalized;
           lastFormCheck = formCheck;
 
           // Retry within the adapter (same request) when the provider output is
@@ -200,14 +198,9 @@ export function createLlmAdapter(bindings: LlmAdapterBindings) {
             continue;
           }
 
-          const preview =
-            (lastNormalizedOutput ?? normalized).length > 200
-              ? `${(lastNormalizedOutput ?? normalized).slice(0, 200)}…`
-              : (lastNormalizedOutput ?? normalized);
-
           throw new LlmAdapterError(
             "validation_failed",
-            `LLM provider response did not satisfy the required tanka form. kind=${request.kind} output=${JSON.stringify(preview)}`,
+            `LLM provider response did not satisfy the required tanka form. kind=${request.kind}`,
             false,
             attempt,
             config.model,
@@ -432,14 +425,7 @@ async function requestCompletion(
   );
 
   if (!response.ok) {
-    let responseText: string | undefined;
-    try {
-      responseText = (await response.clone().text()).slice(0, 400);
-    } catch {
-      responseText = undefined;
-    }
-
-    throw errorForProviderStatus(response.status, responseText);
+    throw errorForProviderStatus(response.status);
   }
 
   const payload = (await response.json()) as ChatCompletionResponse;
@@ -581,10 +567,8 @@ async function fetchWithTimeout(
   }
 }
 
-function errorForProviderStatus(status: number, responseText?: string): LlmAdapterError {
-  const suffix = responseText
-    ? ` (status=${status} body=${JSON.stringify(responseText)})`
-    : ` (status=${status})`;
+function errorForProviderStatus(status: number): LlmAdapterError {
+  const suffix = ` (status=${status})`;
 
   if (status === 429) {
     return new LlmAdapterError(

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