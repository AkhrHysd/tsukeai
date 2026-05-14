# Review Task

Task ID: tc.monorepo
Title: モノレポと Biome のルート整備

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.monorepo

## Description
pnpm workspaces・Turborepo・Biome 単一。apps と packages の依存方向を Design どおり一方向に固定する。

## Allowed Paths
- .

## Acceptance Criteria
- ルートで Biome が実行できワークスペースが解決する。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- package.json
- pnpm-workspace.yaml
- scripts/

## Unified Diff
```diff
diff --git a/package.json b/package.json
index e809d28..5584491 100644
--- a/package.json
+++ b/package.json
@@ -3,14 +3,19 @@
   "version": "0.0.0",
   "private": true,
   "packageManager": "pnpm@10.28.2",
+  "workspaces": [
+    "apps/*",
+    "packages/*"
+  ],
   "engines": {
     "node": ">=22"
   },
   "scripts": {
     "biome": "biome check .",
+    "check:deps": "node scripts/check-workspace-dependency-direction.mjs",
     "format": "biome format --write .",
     "lint": "biome lint .",
-    "check": "turbo run check",
+    "check": "pnpm run biome && pnpm run check:deps && turbo run check",
     "test": "pnpm --filter @tsukeai/web test"
   },
   "devDependencies": {
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
index 3ff5faa..f9700bd 100644
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@ -1,3 +1,4 @@
 packages:
+  - "."
   - "apps/*"
   - "packages/*"

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