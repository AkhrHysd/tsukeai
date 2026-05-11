# Review Task

Task ID: tc.transform-arch-gate
Title: 変換アーキ ADR（Milestone 3.5）

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-arch-gate

## Description
docs/orchestration/transform-architecture.md に、同期／非同期、失敗時 UX、再試行・冪等性、コスト上限を ADR で記録。コードは書かない。

## Allowed Paths
- docs/orchestration
- docs/orchestration/transform-architecture.md

## Acceptance Criteria
- transform-architecture.md に同期性・失敗 UX・冪等・コストが ADR で記載される。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-arch-gate/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-arch-gate/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- docs/orchestration/transform-architecture.md

## Unified Diff
```diff

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