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
- apps/web/src/app/page.tsx

## Unified Diff
```diff
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