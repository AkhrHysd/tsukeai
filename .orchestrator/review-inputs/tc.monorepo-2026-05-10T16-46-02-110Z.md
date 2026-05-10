# Review Task

Task ID: tc.monorepo
Title: モノレポと Biome のルート整備

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.monorepo

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
logs: $ npm test
skipped:
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T16_46_02_072Z-debug-0.log

## Changed Files
- .npmrc
- apps/
- biome.json
- package.json
- packages/
- pnpm-workspace.yaml
- turbo.json

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