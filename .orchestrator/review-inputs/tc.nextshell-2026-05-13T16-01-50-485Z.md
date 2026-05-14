# Review Task

Task ID: tc.nextshell
Title: apps/web の Next App Router シェル

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.nextshell

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
exitCode: 0
stdout:

> tsukeai@0.0.0 test
> pnpm --filter @tsukeai/web test


> @tsukeai/web@0.0.0 test /Users/akyrhysd/work/tsukeai/.worktrees/tc.nextshell/apps/web
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tsukeai/web@0.0.0 smoke:read /Users/akyrhysd/work/tsukeai/.worktrees/tc.nextshell/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tsukeai/web@0.0.0 smoke:write /Users/akyrhysd/work/tsukeai/.worktrees/tc.nextshell/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- apps/web/next.config.ts
- apps/web/src/app/page.tsx
- apps/web/src/lib/api-base-url.ts

## Unified Diff
```diff
diff --git a/apps/web/next.config.ts b/apps/web/next.config.ts
index 2f6491c..3f8ba09 100644
--- a/apps/web/next.config.ts
+++ b/apps/web/next.config.ts
@@ -1,3 +1,4 @@
+import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
 import type { NextConfig } from "next";
 
 const nextConfig: NextConfig = {
@@ -5,3 +6,5 @@ const nextConfig: NextConfig = {
 };
 
 export default nextConfig;
+
+initOpenNextCloudflareForDev();
diff --git a/apps/web/src/app/page.tsx b/apps/web/src/app/page.tsx
index 873fc18..0be98ac 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -162,7 +162,7 @@ export default async function Home() {
     <section className="timeline-page" aria-labelledby="page-title">
       <header className="timeline-header">
         <div>
-          <h1 id="page-title">Tsukeai</h1>
+          <h1 id="page-title">公開タイムライン</h1>
         </div>
         <p className="lead">変換済みの公開句だけをサーバーで取得して表示します。</p>
       </header>
diff --git a/apps/web/src/lib/api-base-url.ts b/apps/web/src/lib/api-base-url.ts
index a23c8e1..3541915 100644
--- a/apps/web/src/lib/api-base-url.ts
+++ b/apps/web/src/lib/api-base-url.ts
@@ -1,8 +1,7 @@
 const DEFAULT_API_BASE_URL = "http://localhost:8787";
 
 export function getApiBaseUrl(): URL {
-  const value = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
-  console.error("API_BASE_URL resolved", { value });
+  const value = process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
 
   try {
     return new URL(value);

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