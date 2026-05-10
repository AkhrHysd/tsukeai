# Review Task

Task ID: tc.e2e-read
Title: Playwright 読み取りスモーク

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-read

## Description
GT クリティカルパス。LLM 実呼び出しに CI を依存させない。

## Allowed Paths
- apps/web
- .

## Acceptance Criteria
- 読み取りスモークがパスする。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-read/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-read/apps/web
> node scripts/read-smoke.mjs

Deterministic read smoke passed.
stderr:
(empty)

## Changed Files
- apps/web/package.json
- apps/web/src/app/page.tsx
- package.json
- apps/web/scripts/

## Unified Diff
```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index e1ab484..fd39088 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -8,7 +8,9 @@
     "check": "pnpm run build",
     "dev": "next dev",
     "lint": "pnpm --workspace-root exec biome check .",
+    "smoke:read": "node scripts/read-smoke.mjs",
     "start": "next start",
+    "test": "pnpm run smoke:read",
     "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {
diff --git a/apps/web/src/app/page.tsx b/apps/web/src/app/page.tsx
index 3fbc36d..94a8faf 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -61,9 +61,9 @@ export default async function Home() {
           まだ公開句はありません。
         </p>
       ) : (
-        <div className="timeline-list" aria-label="公開タイムライン">
+        <div className="timeline-list" role="list" aria-label="公開タイムライン">
           {timelineResult.timeline.items.map((item) => (
-            <article className="post-card" key={item.post.id}>
+            <article className="post-card" key={item.post.id} role="listitem">
               <div className="post-card__header">
                 <strong>{item.post.author.displayName}</strong>
                 {item.post.author.handle ? (
diff --git a/package.json b/package.json
index 3eeed1c..3990406 100644
--- a/package.json
+++ b/package.json
@@ -10,7 +10,8 @@
     "biome": "biome check .",
     "format": "biome format --write .",
     "lint": "biome lint .",
-    "check": "turbo run check"
+    "check": "turbo run check",
+    "test": "pnpm --filter @tanka-reply-sns/web test"
   },
   "devDependencies": {
     "@biomejs/biome": "^2.2.0",

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