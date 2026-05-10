# llm-task-orchestrator コマンド運用 Runbook

この runbook は `llm-task-orchestrator` の CLI を安全に使うための実務手順です。設計の正は `docs/architecture.md`、コマンド仕様の正は `docs/CLI-MANUAL.md` です。

## 前提

- v0.1 は逐次実行のみです。並列実行はしません。
- task store は対象 repo の `tasks/*.yaml` が標準です。
- 対象 repo root は `ORCHESTRATOR_REPO_ROOT` があればそれ、なければ現在の cwd です。
- `task-run` と `task-run-next` の進捗と runner 出力は stderr に出ます。
- 成功時の終了コードは 0、CLI 例外時は 1 です。

## 最初に見るもの

```bash
llm-task-orchestrator task-list
llm-task-orchestrator task-status <taskId>
```

`task-status` では特に次を見ます。

- `status`
- `retryCount`
- `dependsOn`
- `allowedPaths`
- `workspacePath`
- `currentBranch`
- `lastReviewInputPath`
- `lastOrchestratorError`

## 通常実行

ready task を 1 件だけ進めます。

```bash
llm-task-orchestrator task-run-next
```

task ID を指定して進めます。

```bash
llm-task-orchestrator task-run <taskId>
```

連続して進める場合は、1 回ごとに以下を確認します。

```bash
llm-task-orchestrator task-list
llm-task-orchestrator task-status <taskId>
```

`done` なら次へ進めます。`failed`、`validation_failed`、`review_rejected`、`review_pending`、`accepted` で止まった場合は、状態別手順を使います。

## 状態別手順

### ready

実行可能です。

```bash
llm-task-orchestrator task-run <taskId>
```

### queued / blocked

依存 task の完了待ちです。`dependsOn` を確認します。task YAML を手で変える必要がある場合は、ユーザーに確認します。

### running

前回プロセスが中断した可能性があります。`workspacePath` と worktree 実体を確認します。実体があり再開できそうなら `task-run <taskId>`、壊れていれば `task-reset <taskId>` を検討します。reset で差分を捨てる可能性がある場合はユーザー確認が必要です。

### validation_failed

retry 上限に達していなければ、同じ task を再実行します。

```bash
llm-task-orchestrator task-run <taskId>
```

上限到達で `failed` になっている場合は、原因を見てから reset します。

```bash
llm-task-orchestrator task-reset <taskId>
llm-task-orchestrator task-run <taskId>
```

validator のコマンド自体が誤っている場合は、`orchestrator.config.json` の修正が必要です。設定変更はユーザーに確認します。

### review_pending

workspace が残っていれば reviewer から再開できます。

```bash
llm-task-orchestrator task-run <taskId>
```

`lastReviewInputPath` があれば、reviewer に渡った diff と task 内容を確認できます。

### review_rejected

retry 上限に達していなければ、同じ workspace で runner に修正させます。

```bash
llm-task-orchestrator task-run <taskId>
```

上限到達で `failed` になっている場合は、次のどちらかを人間が選びます。

```bash
llm-task-orchestrator task-continue <taskId>
llm-task-orchestrator task-accept <taskId>
```

`task-continue` は同じ workspace で修正を続けます。`task-accept` は reviewer の reject を踏まえたうえで現在差分を受け入れます。`task-accept` は必ずユーザー確認後に使います。

### accepted

review accept 後、commit / cherry-pick / push / dependent task 解放 / cleanup のどこかで失敗した可能性があります。`lastOrchestratorError` を読み、base branch の状態を確認してから再実行します。

```bash
git status --short
llm-task-orchestrator task-run <taskId>
```

base branch 側に未退避変更がある場合、commit / stash / discard の判断はユーザーに確認します。

### failed

まず `task-status` で `lastOrchestratorError` と runtime 情報を見ます。

- validation retry 上限なら `task-reset <taskId>` 後に再実行します。
- review reject 上限なら `task-continue <taskId>` または `task-accept <taskId>` を選びます。
- workspace が壊れている場合は、差分を捨ててよいか確認してから `task-reset <taskId>` を使います。

### done

完了です。`task-list` で依存先が `ready` に変わっているか確認し、次の task に進みます。

## cleanup

workspace が残っている task を掃除します。

```bash
llm-task-orchestrator cleanup
```

`cleanup` は状態と workspace の差分を確認してから使います。進行中の差分や調査に必要な worktree を消す可能性がある場合は、ユーザー確認が必要です。

## よくある判断

### 何度も `task-run-next` してよいか

1 件ごとの結果確認が前提です。`task-run-next` は ready task を 1 件だけ処理します。複数 task を連続処理するときも、各回の後に `task-list` を確認し、失敗中の task があれば先に復旧します。

### `task-run` と `task-continue` の違い

`task-run` は通常の実行・再開です。retry 可能な失敗にはまず `task-run` を使います。`task-continue` は review reject 上限で `failed` になった task を、同じ workspace でさらに 1 回進めるための明示操作です。

### `task-reset` と `cleanup` の違い

`task-reset` は特定 task の状態を実行前相当に戻す復旧操作です。`cleanup` は残った workspace を掃除し、task 定義から runtime workspace 情報を消します。どちらも差分を失う可能性がある場合は確認が必要です。

### reviewer の判断理由を見たい

```bash
llm-task-orchestrator task-status <taskId>
```

`lastReviewInputPath` の markdown を読みます。ここには reviewer に渡した変更ファイル一覧と unified diff を含むプロンプトが保存されています。

## ユーザー確認チェックリスト

次の操作は確認なしに進めません。

- reject 済み差分を `task-accept` で受け入れる
- worktree 差分を捨てる可能性がある `task-reset`
- workspace 削除を伴う可能性がある `cleanup`
- base branch の未 commit 変更を commit / stash / discard する
- 対象 repo root や task ID が曖昧なまま実行する
- task YAML や `orchestrator.config.json` を変更して復旧する

## コマンド選択早見表

| 状況 | まず使うコマンド |
|------|------------------|
| 全体を見る | `task-list` |
| 1 task の詳細を見る | `task-status <taskId>` |
| 次の ready を 1 件処理する | `task-run-next` |
| 指定 task を処理・再開する | `task-run <taskId>` |
| validation retry 上限後にやり直す | `task-reset <taskId>` then `task-run <taskId>` |
| review reject 上限後に修正継続 | `task-continue <taskId>` |
| review reject 上限後に手動受け入れ | `task-accept <taskId>` |
| 残留 workspace を掃除する | `cleanup` |
