---
name: orchestrator-task-authoring
description: Draft or revise YAML task files for llm-task-orchestrator when a user needs new task definitions, task decomposition into schema-valid units, or edits to existing task metadata under the orchestrator task schema.
---

# Orchestrator Task Authoring

この skill は `llm-task-orchestrator` の task YAML を作成・更新するときに使う。新しい task の草案、既存 task の依存関係調整、`allowedPaths` や `acceptanceCriteria` の見直しが対象で、schema にない拡張フィールドは追加しない。

## 使う場面

- `tasks/*.yaml` を新規作成したい
- 大きい作業を複数 task に分けたい
- 既存 task の `dependsOn`、`allowedPaths`、`acceptanceCriteria` を修正したい
- schema に合う YAML へ整形したい

## 作業手順

1. まず対象 repo に `schemas/task.schema.json` があれば参照する。
2. `schemas/task.schema.json` が無ければ、既存の `tasks/*.yaml` を優先して参照する。
3. schema も既存 task も薄い場合は、この skill 同梱の `references/task-schema.md` を基準にする。
4. task は 1 つの狭い成果に絞り、`allowedPaths` と `acceptanceCriteria` を具体化する。
5. 新規 task を書くときは runtime 情報を入れず、初期状態だけを設定する。
6. 既存 task を更新するときも、依頼されていない runtime 状態や review/validation 結果は触らない。

## 出力ルール

- YAML だけを出す。説明が必要なら YAML の前後に短く添えるが、本文中に混ぜない。
- `id` は `task-001` のような連番を基本にし、既存番号と衝突させない。
- `title` は短く、`description` は runner がそのまま実装に使える粒度で書く。
- `dependsOn` は task ID 配列で表現し、依存がなければ `[]`。
- `allowedPaths` は実際に触ってよい最小集合に絞る。
- `acceptanceCriteria` は reviewer と validator が判定できる文にする。
- task 固有の背景や設計参照が必要なら、任意の `context.summary` / `context.refs` を使う。
- `context.refs` は repo root 相対の通常ファイルだけを指定し、glob や repo 外参照は使わない。
- `retryCount` は新規 task なら `0`。
- `maxRunRetries` と `maxReviewRetries` は明示指示がなければ `1`。
- TDD の赤フェーズを task として切り出す場合だけ `validationPolicy.skipStages` を使い、通常 task では不要に入れない。

## 初期 status の決め方

- 依存がなければ通常は `ready`
- 依存があれば通常は `queued`
- 既存依存の未解決を明示したい場合だけ `blocked`
- `running` 以降の runtime status は、既存 task の状態修正を依頼されない限り新規作成で使わない

## 参照先

- repo に `schemas/task.schema.json` があれば最優先で参照する
- 既存の `tasks/*.yaml` は repo ローカルの実例として参照する
- schema と field 一覧、runtime 専用 field、出力例の fallback は `references/task-schema.md`
- システム全体の責務境界と state machine は `docs/architecture.md`

## 注意点

- runner/reviewer/repo-manager の責務を task 本文に混ぜない
- acceptanceCriteria に commit/push や task 状態更新を書かない
- schema に存在しない独自キーは追加しない
- 依頼が「実行結果の反映」ではなく「task の草案作成」なら、`workspacePath`、`currentBranch`、`lastValidation`、`lastReview`、`lastRetryReason` は出力しない
- `validationPolicy.skipStages` は `format`, `lint`, `typecheck`, `test` だけに使い、`paths` は指定しない

## 最終確認

出力前に次を確認する。

- required field が全部ある
- status が schema 上の有効値
- `allowedPaths` と `acceptanceCriteria` が task の範囲と一致している
- runtime 専用 field を不要に含めていない
