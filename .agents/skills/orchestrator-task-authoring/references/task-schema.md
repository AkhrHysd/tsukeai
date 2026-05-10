# Task Schema Reference

この skill は `schemas/task.schema.json` に合わせて task YAML を作る。新規 task を作るときに最低限必要なのは次の field。

```yaml
id: task-001
title: README にサンプル実行マーカーを追記する
description: README.md の末尾に sample run marker を1行だけ追記する。既存内容は壊さず、他ファイルは変更しないこと。
dependsOn: []
allowedPaths:
  - README.md
acceptanceCriteria:
  - README.md だけが変更される
  - 末尾に sample run marker が1行追加される
context:
  summary: runner / reviewer に渡したい背景があれば書く
  refs:
    - docs/architecture.md
status: ready
retryCount: 0
maxRunRetries: 1
maxReviewRetries: 1
```

## Required Fields

- `id`: 一意な task ID。通常は `task-001`, `task-002` の連番
- `title`: 短い要約
- `description`: runner がそのまま実装へ使える具体的な指示
- `dependsOn`: 依存 task ID の配列
- `allowedPaths`: 変更許可パス
- `acceptanceCriteria`: 完了条件
- `context`: 任意。`summary` と repo root 相対の `refs` を runner / reviewer に渡す
- `status`: schema の列挙値から選ぶ
- `retryCount`: 新規 task は通常 `0`
- `maxRunRetries`: 明示指定がなければ `1`
- `maxReviewRetries`: 明示指定がなければ `1`
- `validationPolicy`: task 単位で validator stage を skip したい場合だけ使う

## Status Guidance

- `ready`: 依存なし、またはすでに依存解決済みの task
- `queued`: 依存 task 完了待ちの task を通常この状態で置く
- `blocked`: 既存 task を明示的に依存未解決として表したいとき
- `running` / `validation_failed` / `review_pending` / `review_rejected` / `accepted` / `done` / `failed`
  - 実行中や実行結果を表す runtime status
  - 新規 task 草案では通常使わない

## Runtime Fields

次の field は schema 上は許可されるが、通常は orchestrator が実行時に埋める。新規 task 作成では依頼されない限り出力しない。

- `workspacePath`
- `currentBranch`
- `lastValidation`
- `lastReview`
- `lastRetryReason`

## Validation Policy

TDD の赤フェーズのように、task の意図として一時的な failing test を許容したい場合だけ `validationPolicy.skipStages` を使う。

```yaml
validationPolicy:
  skipStages:
    - test
```

制約:

- 指定できるのは `format`, `lint`, `typecheck`, `test`
- `paths` は skip できない
- 通常 task では不要に使わない
- 実装 task で green まで持っていく段階では外す

## Authoring Rules

- `allowedPaths` は狭く保つ
- 背景や全体設計が必要な task では `context.summary` か `context.refs` を明示する
- `context.refs` は repo root 相対の通常ファイルだけを指定し、glob や repo 外参照は使わない
- `acceptanceCriteria` は diff やレビューで確認可能な文にする
- task は 1 つの成果に絞る
- reviewer が意味判定しやすいように、曖昧な表現より具体的な差分条件を優先する
- runner に commit / push / task status 更新をさせる指示は `description` に書かない

## Examples

### 依存なし

```yaml
id: task-003
title: package.json に lint script を追加する
description: package.json に lint script を1つ追加し、既存 script は壊さないこと。
dependsOn: []
allowedPaths:
  - package.json
acceptanceCriteria:
  - package.json だけが変更される
  - scripts.lint が追加される
status: ready
retryCount: 0
maxRunRetries: 1
maxReviewRetries: 1
```

### 依存あり

```yaml
id: task-004
title: lint script を README に追記する
description: task-003 が追加した lint script を前提に、README.md に実行例を1段落追記する。
dependsOn:
  - task-003
allowedPaths:
  - README.md
acceptanceCriteria:
  - README.md だけが変更される
  - lint script の実行例が追記される
status: queued
retryCount: 0
maxRunRetries: 1
maxReviewRetries: 1
```

### TDD の赤フェーズ

```yaml
id: task-005
title: retry-task の失敗ケーステストを先に追加する
description: src/application/retry-task.ts の review_rejected 分岐に対する failing test を先に追加する。実装はまだ変更しないこと。
dependsOn: []
allowedPaths:
  - src/application
acceptanceCriteria:
  - retry-task の review_rejected 分岐を検証するテストが追加される
  - 実装コードは変更されない
status: ready
retryCount: 0
maxRunRetries: 1
maxReviewRetries: 1
validationPolicy:
  skipStages:
    - test
```
