# Review Task

Task ID: tc.hono
Title: apps/api の Hono on Workers 入口

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.hono

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
skipped:
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_03_29_293Z-debug-0.log

## Changed Files
- apps/api/package.json
- apps/api/src/
- apps/api/tsconfig.json
- apps/api/wrangler.toml

## Unified Diff
```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index f62dd5e..4217afb 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -5,10 +5,17 @@
   "type": "module",
   "scripts": {
     "check": "pnpm run lint",
+    "dev": "wrangler dev",
     "lint": "pnpm --workspace-root exec biome check .",
-    "typecheck": "pnpm --workspace-root exec tsc --noEmit"
+    "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {
-    "@tanka-reply-sns/shared": "workspace:*"
+    "@tanka-reply-sns/shared": "workspace:*",
+    "hono": "^4.7.0"
+  },
+  "devDependencies": {
+    "@cloudflare/workers-types": "^4.20250411.0",
+    "typescript": "^5.8.0",
+    "wrangler": "^4.10.0"
   }
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