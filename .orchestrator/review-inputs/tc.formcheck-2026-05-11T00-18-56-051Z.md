# Review Task

Task ID: tc.formcheck
Title: FormCheck（非 LLM）

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.formcheck

## Description
受理／却下の機械検証。Design の規則確度により粒度調整。

## Allowed Paths
- packages/shared
- apps/api

## Acceptance Criteria
- 規則外は公開フローに進まない。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.formcheck/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.formcheck/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/llm-adapter.ts
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/llm-adapter.ts b/apps/api/src/llm-adapter.ts
index ddfb8d9..f07c37e 100644
--- a/apps/api/src/llm-adapter.ts
+++ b/apps/api/src/llm-adapter.ts
@@ -1,3 +1,9 @@
+import {
+  checkTransformForm,
+  TRANSFORM_FORM_RULES,
+  type TransformJobKind,
+} from "@tanka-reply-sns/shared";
+
 export type LlmAdapterBindings = {
   LLM_API_KEY?: string;
   LLM_BASE_URL?: string;
@@ -8,7 +14,7 @@ export type LlmAdapterBindings = {
   LLM_MAX_RETRIES?: string;
 };
 
-export type TransformKind = "post_575" | "reply_77";
+export type TransformKind = TransformJobKind;
 
 export type TransformTextRequest = {
   kind: TransformKind;
@@ -34,7 +40,8 @@ export type LlmAdapterErrorCode =
   | "rate_limited"
   | "provider_unavailable"
   | "provider_rejected"
-  | "invalid_provider_response";
+  | "invalid_provider_response"
+  | "validation_failed";
 
 export type TransformFailureJobState = "failed" | "rejected";
 
@@ -127,6 +134,10 @@ const SYSTEM_PROMPT = [
     "Return only the transformed public Japanese text,",
     "with no markdown, labels, or commentary.",
   ].join(" "),
+  [
+    "Separate every phrase with a newline.",
+    "Use kana only, except punctuation separators.",
+  ].join(" "),
 ].join(" ");
 
 export type LlmAdapter = ReturnType<typeof createLlmAdapter>;
@@ -197,6 +208,7 @@ export function classifyTransformFailure(
     error.code === "input_limit_exceeded" ||
     error.code === "cost_limit_exceeded" ||
     error.code === "output_limit_exceeded" ||
+    error.code === "validation_failed" ||
     error.code === "provider_rejected"
   ) {
     return {
@@ -365,7 +377,7 @@ async function requestCompletion(
     );
   }
 
-  return text;
+  return assertAcceptedTransformOutput(request.kind, text);
 }
 
 function buildMessages(request: TransformTextRequest): ChatMessage[] {
@@ -373,9 +385,11 @@ function buildMessages(request: TransformTextRequest): ChatMessage[] {
     request.kind === "post_575"
       ? "5-7-5 の上の句"
       : "7-7 の返信句";
+  const requiredMoraCounts = TRANSFORM_FORM_RULES[request.kind].join("-");
   const metadataJson = JSON.stringify({
     jobId: request.jobId,
     requiredForm: form,
+    requiredMoraCounts,
   });
   const sourceTextJson = JSON.stringify(normalizeSourceText(request.input));
 
@@ -401,6 +415,23 @@ function buildMessages(request: TransformTextRequest): ChatMessage[] {
   ];
 }
 
+function assertAcceptedTransformOutput(
+  kind: TransformKind,
+  text: string,
+): string {
+  const formCheck = checkTransformForm(kind, text);
+
+  if (!formCheck.accepted) {
+    throw new LlmAdapterError(
+      "validation_failed",
+      "LLM provider response did not satisfy the required tanka form.",
+      false,
+    );
+  }
+
+  return formCheck.normalizedText;
+}
+
 function normalizeSourceText(input: string): string {
   return input
     .normalize("NFC")
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 00588ad..19a9037 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -66,6 +66,36 @@ export type TransformJobStateTransition =
 
 export type TransformJobKind = "post_575" | "reply_77";
 
+export const TRANSFORM_FORM_RULES = {
+  post_575: [5, 7, 5],
+  reply_77: [7, 7],
+} as const satisfies Record<TransformJobKind, readonly number[]>;
+
+export type TransformFormCheckReason =
+  | "blank"
+  | "contains_uncheckable_characters"
+  | "segment_count_mismatch"
+  | "mora_count_mismatch";
+
+export type TransformFormCheckSegment = {
+  text: string;
+  moraCount: number;
+  expectedMoraCount: number;
+};
+
+export type TransformFormCheckError = {
+  reason: TransformFormCheckReason;
+  message: string;
+};
+
+export type TransformFormCheckResult = {
+  accepted: boolean;
+  kind: TransformJobKind;
+  normalizedText: PublicTankaText;
+  segments: TransformFormCheckSegment[];
+  errors: TransformFormCheckError[];
+};
+
 export type TransformIdempotencyScope = {
   userId: EntityId;
   kind: TransformJobKind;
@@ -133,6 +163,140 @@ export type TransformJobResponseDto = {
   job: TransformJobDto;
 };
 
+const EXPLICIT_SEGMENT_SEPARATOR_PATTERN = /[\n\r/／]+/u;
+const INLINE_SEGMENT_SEPARATOR_PATTERN = /[\s　、，,。．.！？!?]+/u;
+const IGNORED_FORM_CHARACTERS_PATTERN = /[\s　、，,。．.！？!?「」『』（）()［］\[\]【】]/gu;
+const SMALL_KANA_WITHOUT_OWN_MORA = new Set([
+  "ぁ",
+  "ぃ",
+  "ぅ",
+  "ぇ",
+  "ぉ",
+  "ゃ",
+  "ゅ",
+  "ょ",
+  "ゎ",
+  "ァ",
+  "ィ",
+  "ゥ",
+  "ェ",
+  "ォ",
+  "ャ",
+  "ュ",
+  "ョ",
+  "ヮ",
+]);
+const MORA_CHAR_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
+const CHECKABLE_TANKA_TEXT_PATTERN =
+  /^[\p{Script=Hiragana}\p{Script=Katakana}ー\s　、，,。．.！？!?「」『』（）()［］\[\]【】/／]+$/u;
+
+export function checkTransformForm(
+  kind: TransformJobKind,
+  text: TankaText,
+): TransformFormCheckResult {
+  const normalizedText = normalizeTankaText(text);
+  const expectedMoraCounts = TRANSFORM_FORM_RULES[kind];
+  const errors: TransformFormCheckError[] = [];
+
+  if (normalizedText.length === 0) {
+    errors.push({
+      reason: "blank",
+      message: "Transformed text must not be blank.",
+    });
+  }
+
+  if (
+    normalizedText.length > 0 &&
+    !CHECKABLE_TANKA_TEXT_PATTERN.test(normalizedText)
+  ) {
+    errors.push({
+      reason: "contains_uncheckable_characters",
+      message:
+        "Transformed text must use kana and supported tanka separators only.",
+    });
+  }
+
+  const segments = splitTankaSegments(normalizedText).map((segment, index) => ({
+    text: segment,
+    moraCount: countJapaneseMora(segment),
+    expectedMoraCount: expectedMoraCounts[index] ?? 0,
+  }));
+
+  if (segments.length !== expectedMoraCounts.length) {
+    errors.push({
+      reason: "segment_count_mismatch",
+      message: `Transformed text must have ${expectedMoraCounts.length} segments.`,
+    });
+  }
+
+  for (const [index, expectedMoraCount] of expectedMoraCounts.entries()) {
+    const segment = segments[index];
+
+    if (!segment || segment.moraCount !== expectedMoraCount) {
+      errors.push({
+        reason: "mora_count_mismatch",
+        message: `Segment ${index + 1} must have ${expectedMoraCount} mora.`,
+      });
+    }
+  }
+
+  return {
+    accepted: errors.length === 0,
+    kind,
+    normalizedText: segments.map((segment) => segment.text).join("\n"),
+    segments,
+    errors,
+  };
+}
+
+export function normalizeTankaText(text: TankaText): PublicTankaText {
+  return text
+    .normalize("NFKC")
+    .replaceAll(/\p{Cc}/gu, (character) =>
+      character === "\n" || character === "\t" ? character : " ",
+    )
+    .trim();
+}
+
+export function countJapaneseMora(text: TankaText): number {
+  const countableText = normalizeTankaText(text).replaceAll(
+    IGNORED_FORM_CHARACTERS_PATTERN,
+    "",
+  );
+  let moraCount = 0;
+
+  for (const character of countableText) {
+    if (!MORA_CHAR_PATTERN.test(character)) {
+      continue;
+    }
+
+    if (!SMALL_KANA_WITHOUT_OWN_MORA.has(character)) {
+      moraCount += 1;
+    }
+  }
+
+  return moraCount;
+}
+
+function splitTankaSegments(text: TankaText): string[] {
+  const normalizedText = normalizeTankaText(text);
+
+  if (normalizedText.length === 0) {
+    return [];
+  }
+
+  const separatorPattern = EXPLICIT_SEGMENT_SEPARATOR_PATTERN.test(
+    normalizedText,
+  )
+    ? EXPLICIT_SEGMENT_SEPARATOR_PATTERN
+    : INLINE_SEGMENT_SEPARATOR_PATTERN;
+
+  return normalizedText
+    .split(separatorPattern)
+    .map((segment) => segment.trim())
+    .filter((segment) => segment.length > 0);
+}
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