# Review Task

Task ID: tc.nextshell
Title: apps/web の Next App Router シェル

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.nextshell

## Description
レイアウトと API ベース URL の読み方。SSR 前提。

## Allowed Paths
- apps/web

## Acceptance Criteria
- Next がビルドしレイアウトが載る。

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
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T16_50_31_320Z-debug-0.log

## Changed Files
- apps/web/package.json
- apps/web/next-env.d.ts
- apps/web/next.config.ts
- apps/web/src/
- apps/web/tsconfig.json

## Unified Diff
```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index 58172b7..93f1ba0 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -4,11 +4,23 @@
   "private": true,
   "type": "module",
   "scripts": {
+    "build": "next build",
     "check": "pnpm run lint",
+    "dev": "next dev",
     "lint": "pnpm --workspace-root exec biome check .",
-    "typecheck": "pnpm --workspace-root exec tsc --noEmit"
+    "start": "next start",
+    "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {
-    "@tanka-reply-sns/shared": "workspace:*"
+    "@tanka-reply-sns/shared": "workspace:*",
+    "next": "^15.0.0",
+    "react": "^19.0.0",
+    "react-dom": "^19.0.0"
+  },
+  "devDependencies": {
+    "@types/node": "^22.0.0",
+    "@types/react": "^19.0.0",
+    "@types/react-dom": "^19.0.0",
+    "typescript": "^5.8.0"
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