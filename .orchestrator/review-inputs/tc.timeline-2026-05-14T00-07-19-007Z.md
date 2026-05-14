# Review Task

Task ID: tc.timeline
Title: 公開タイムライン GET API

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.timeline

## Description
未ログインで取得可能な JSON。キャッシュはプライバシーと整合する範囲のみ。

## Allowed Paths
- apps/api
- packages/shared

## Acceptance Criteria
- 未認証でタイムライン JSON が取得できる。

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
index 31b4b19..846d125 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1839,6 +1839,8 @@ app.get("/api/transform-jobs/:id", async (c) => {
 });
 
 app.get("/api/timeline", async (c) => {
+  c.header("Cache-Control", PUBLIC_TIMELINE_CACHE_CONTROL);
+
   const limit = parseTimelineLimit(c.req.query("limit"));
 
   if (limit === undefined) {
@@ -1968,8 +1970,6 @@ app.get("/api/timeline", async (c) => {
         pr.reply_id asc
     `;
 
-    c.header("Cache-Control", PUBLIC_TIMELINE_CACHE_CONTROL);
-
     return c.json(toTimelineResponse(rows));
   } catch (error) {
     console.error("Timeline query failed", toSafeLogError(error));

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