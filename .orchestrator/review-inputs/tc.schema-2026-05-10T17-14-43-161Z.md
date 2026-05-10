# Review Task

Task ID: tc.schema
Title: 最小エンティティとマイグレーション運用

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.schema

## Description
Account・公開変換・スレッドの最小列と適用手順（DDL 全文は実装フェーズ）。

## Allowed Paths
- apps/api
- packages/shared

## Acceptance Criteria
- 最小エンティティのマイグレーション適用が手順どおり再現できる。

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
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_14_43_123Z-debug-0.log

## Changed Files
- apps/api/package.json
- apps/api/MIGRATIONS.md
- apps/api/migrations/
- apps/api/scripts/

## Unified Diff
```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index 2c18a24..e6ff65c 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -7,6 +7,7 @@
     "check": "pnpm run lint",
     "dev": "wrangler dev",
     "lint": "pnpm --workspace-root exec biome check .",
+    "migrate:up": "node scripts/migrate.mjs",
     "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {

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