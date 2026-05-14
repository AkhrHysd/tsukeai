# Review Task

Task ID: tc.formcheck
Title: FormCheck（非 LLM）

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.formcheck

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
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 3759164..4477a98 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -905,11 +905,18 @@ async function publishTransformJob(
   attempts: number,
   durationMs: number,
 ): Promise<TransformJobRow | undefined> {
+  const acceptedPublicText = assertPublishableTransformText(
+    job.kind,
+    publicText,
+    attempts,
+    model,
+  );
+
   if (job.kind === "reply_77") {
-    return publishReplyTransformJob(sql, job, publicText, model, attempts, durationMs);
+    return publishReplyTransformJob(sql, job, acceptedPublicText, model, attempts, durationMs);
   }
 
-  return publishPostTransformJob(sql, job, publicText, model, attempts, durationMs);
+  return publishPostTransformJob(sql, job, acceptedPublicText, model, attempts, durationMs);
 }
 
 async function markTransformJobFailed(
@@ -1203,6 +1210,27 @@ function parsePublicTextInput(
   };
 }
 
+function assertPublishableTransformText(
+  kind: TransformJobKind,
+  publicText: string,
+  attempts: number,
+  model: string,
+): string {
+  const formCheck = checkTransformForm(kind, publicText);
+
+  if (!formCheck.accepted) {
+    throw new LlmAdapterError(
+      "validation_failed",
+      `Transform result did not satisfy the required public form. kind=${kind}`,
+      false,
+      attempts,
+      model,
+    );
+  }
+
+  return formCheck.normalizedText;
+}
+
 async function publishPublicTextPost(
   sql: ReturnType<typeof createSql>,
   accountId: string,

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