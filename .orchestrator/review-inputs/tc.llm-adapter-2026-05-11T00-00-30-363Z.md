# Review Task

Task ID: tc.llm-adapter
Title: Workers 上の LLM アダプタ

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.llm-adapter

## Description
タイムアウト・上限・Secrets。ゲートで決めた契約に従う。

## Allowed Paths
- apps/api

## Acceptance Criteria
- ADR の呼び出し契約に適合するアダプタが説明できる。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.llm-adapter/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.llm-adapter/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/index.ts
- apps/api/src/llm-adapter.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 295a7a1..325c2b6 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -7,8 +7,9 @@ import type {
   TimelineResponseDto,
 } from "@tanka-reply-sns/shared";
 import postgres from "postgres";
+import type { LlmAdapterBindings } from "./llm-adapter";
 
-type Bindings = {
+type Bindings = LlmAdapterBindings & {
   API_ALLOWED_ORIGINS?: string;
   HYPERDRIVE: Hyperdrive;
   SESSION_COOKIE_NAME?: string;

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