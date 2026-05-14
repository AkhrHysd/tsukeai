# Review Task

Task ID: tc.delete
Title: 本人削除（M6）

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.delete

## Description
公開句の削除または非表示。管理者削除は MVP 外。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 本人削除後に一覧／スレッドが一貫する。

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
index cdde45a..3759164 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -2028,15 +2028,17 @@ app.delete("/api/public-conversions/:id", async (c) => {
       const [row] = await transaction<DeletePublicConversionResult[]>`
         with target as (
           select
-            id,
-            account_id,
-            kind,
-            thread_id
-          from public_conversions
+            pc.id,
+            pc.account_id,
+            pc.kind,
+            pc.thread_id
+          from public_conversions pc
+          join threads t on t.id = pc.thread_id
           where
-            id = ${publicConversionId}::uuid
-            and is_published = true
-            and deleted_at is null
+            pc.id = ${publicConversionId}::uuid
+            and pc.is_published = true
+            and pc.deleted_at is null
+            and t.deleted_at is null
         ),
         authorized as (
           select *
@@ -2050,14 +2052,7 @@ app.delete("/api/public-conversions/:id", async (c) => {
             deleted_at = now()
           from authorized a
           where
-            (
-              pc.id = a.id
-              or (
-                a.kind = 'post'
-                and pc.thread_id = a.thread_id
-                and pc.kind = 'reply'
-              )
-            )
+            pc.id = a.id
             and pc.is_published = true
             and pc.deleted_at is null
           returning pc.id

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