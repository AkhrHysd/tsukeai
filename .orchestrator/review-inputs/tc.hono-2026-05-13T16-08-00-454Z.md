# Review Task

Task ID: tc.hono
Title: apps/api の Hono on Workers 入口

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.hono

## Description
ルーティングとヘルス。REST JSON と Cookie／CORS 境界の置き場。

## Allowed Paths
- apps/api

## Acceptance Criteria
- Workers API がヘルス応答を返す。

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


> @tsukeai/web@0.0.0 test /Users/akyrhysd/work/tsukeai/.worktrees/tc.hono/apps/web
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tsukeai/web@0.0.0 smoke:read /Users/akyrhysd/work/tsukeai/.worktrees/tc.hono/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tsukeai/web@0.0.0 smoke:write /Users/akyrhysd/work/tsukeai/.worktrees/tc.hono/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 193627b..711ca1c 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -209,6 +209,12 @@ function isProtectedWrite(method: string, path: string): boolean {
   );
 }
 
+function handleHealth(c: AppContext) {
+  c.header("Cache-Control", "no-store");
+
+  return c.json(HEALTH_RESPONSE);
+}
+
 function parseTimelineLimit(value: string | undefined): number | undefined {
   if (value === undefined) {
     return DEFAULT_TIMELINE_LIMIT;
@@ -1627,13 +1633,9 @@ app.use("*", async (c, next) => {
   );
 });
 
-app.get("/health", (c) => {
-  return c.json(HEALTH_RESPONSE);
-});
+app.get("/health", handleHealth);
 
-app.get("/api/health", (c) => {
-  return c.json(HEALTH_RESPONSE);
-});
+app.get("/api/health", handleHealth);
 
 app.get("/api/db/health", async (c) => {
   let sql: ReturnType<typeof createSql> | undefined;

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