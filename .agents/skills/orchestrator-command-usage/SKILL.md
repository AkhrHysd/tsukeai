---
name: orchestrator-command-usage
description: Guide safe use of llm-task-orchestrator CLI commands when a user wants to run tasks continuously, recover from failures, decide when to continue/reset/accept/cleanup, or know when human confirmation is required.
---

# Orchestrator Command Usage

この skill は `llm-task-orchestrator` の CLI を実運用するときに使う。task の連続実行、失敗時の復旧、`task-continue` / `task-accept` / `task-reset` / `cleanup` の使い分け、ユーザー確認が必要なケースを扱う。

## 使う場面

- `llm-task-orchestrator` のコマンドをどの順番で使うか説明したい
- `ready` task を順番に処理し続けたい
- `task-run` / `task-run-next` が失敗した後の次アクションを判断したい
- `validation_failed`、`review_rejected`、`review_pending`、`accepted`、`failed` の意味を運用視点で整理したい
- workspace や base branch の状態を見て、継続・reset・accept・cleanup を選びたい
- 自動で進めずユーザー確認を挟むべき場面を判断したい

## 基本方針

- v0.1 は逐次実行のみ。複数 task を同時に走らせない。
- 実行前に `task-list` と必要な `task-status <taskId>` を確認する。
- `task-run-next` は ready task を 1 件だけ処理する。連続処理したい場合も、各回の終了状態を見て次を判断する。
- `task-run <taskId>` は特定 task の処理・再開に使う。
- エラー時は、まず `task-status <taskId>` と必要に応じて対象 repo の `git status --short` を確認する。
- runner / reviewer / repo-manager の責務を混同しない。runner に task 状態判断をさせず、reviewer に修正をさせず、repo-manager に acceptance 判断をさせない。

## 代表フロー

1. 対象 repo root で `llm-task-orchestrator task-list` を実行する。
2. 個別確認が必要なら `llm-task-orchestrator task-status <taskId>` を実行する。
3. 次の ready を 1 件だけ進めるなら `llm-task-orchestrator task-run-next` を使う。
4. 特定 task を進めるなら `llm-task-orchestrator task-run <taskId>` を使う。
5. 終了後に `task-status <taskId>` を確認する。
6. `done` なら次の task へ進んでよい。`failed` や runtime 情報が残る場合は、状態別の復旧手順に従う。

## 連続実行の進め方

- 自動ループを提案するときも、v0.1 の制約として「1 件ずつ実行し、結果を確認してから次へ進む」前提にする。
- `task-run-next` の出力だけで判断せず、必要なら `task-list` で残りの `ready` / `blocked` / `queued` を確認する。
- `done` になった task の依存先が `ready` に解放されることがあるため、各回の後に一覧を見る。
- 同じ task が失敗した場合は、次の task へ進まず、その task の復旧を優先する。
- 並列実行、watch 実行、Web UI、GitHub Actions 連携は v0.1 では提案しない。

## 状態別の対応

- `ready`: `task-run <taskId>` または `task-run-next` で実行できる。
- `queued` / `blocked`: 依存 task の完了待ち。手動で進める前に依存関係を確認する。
- `running`: 前回実行が中断した可能性がある。workspace と実体の有無を確認してから再実行または reset を判断する。
- `validation_failed`: 通常は同じ task を `task-run <taskId>` で再実行する。retry 上限で `failed` なら `task-reset <taskId>` 後に再実行する。
- `review_pending`: workspace が残っていれば `task-run <taskId>` で reviewer から再開する。
- `review_rejected`: retry 可能なら `task-run <taskId>` で runner に修正させる。
- `accepted`: commit / cherry-pick / push / cleanup など後段で失敗した可能性がある。原因解消後に `task-run <taskId>` を再実行する。
- `failed`: `lastOrchestratorError` と直近の失敗理由を確認し、validation 上限なら reset、review reject 上限なら continue または accept を選ぶ。
- `done`: 完了。次の task に進んでよい。

## エラー時の確認順

1. `llm-task-orchestrator task-status <taskId>` で `status`、`workspacePath`、`currentBranch`、`lastReviewInputPath`、`lastOrchestratorError` を見る。
2. base branch 側の未退避変更が疑われる場合は、対象 repo root で `git status --short` を見る。
3. reviewer 判断の根拠が必要なら `lastReviewInputPath` の markdown を読む。
4. `workspacePath` がある場合は、実体の worktree が存在するか確認する。
5. 状態別の復旧コマンドを選ぶ。

## 復旧コマンドの使い分け

- `task-run <taskId>`: 通常の再実行・再開。`validation_failed`、`review_pending`、retry 可能な `review_rejected`、後段失敗後の `accepted` に使う。
- `task-continue <taskId>`: review reject 上限で `failed` になったが、同じ workspace の修正を続けたいときに使う。
- `task-accept <taskId>`: review reject 上限で `failed` になったが、人間が現在差分を受け入れると判断したときだけ使う。
- `task-reset <taskId>`: workspace を捨てて task を `ready` または `blocked` に戻す。validation retry 上限、壊れた workspace、古い runtime 残骸の整理に使う。
- `cleanup`: `workspacePath` が残っている task の workspace を掃除する。進行中の差分を失う可能性があるため、対象状態を確認してから使う。

## ユーザー確認が必要なケース

- `task-accept <taskId>` を実行する前。review reject を上書きして現在差分を受け入れる判断は人間に確認する。
- `task-reset <taskId>` で既存 workspace の差分を捨てる可能性があるとき。
- `cleanup` で workspace を削除する可能性があるとき。
- base branch の未 commit 変更を commit / stash / discard する必要があるとき。
- `ORCHESTRATOR_REPO_ROOT` や対象 repo が曖昧なとき。
- `task-run-next` を繰り返し実行して複数 task を連続処理する前に、止めどころや対象範囲が不明なとき。
- task YAML、config、validator コマンドを変更しないと先へ進めないとき。

## ユーザー確認なしで進めやすいケース

- `task-list`、`task-status`、`--help` のような読み取り中心の確認。
- 明示された task の `task-run <taskId>`。
- `ready` task を 1 件だけ進める明示指示がある場合の `task-run-next`。
- retry 可能な `validation_failed` / `review_rejected` を、同じ task で `task-run <taskId>` により再実行する場合。

## 参照先

- 詳細 runbook は `references/command-runbook.md`
- コマンド仕様は `docs/CLI-MANUAL.md`
- セットアップ、設定例、トラブル時の補足は `README.md`
- 状態遷移と責務境界は `docs/architecture.md`

## 最終確認

コマンド案を出す前に次を確認する。

- 対象 repo root が明確
- task ID が明確
- 現在 status に対して選んだコマンドが妥当
- destructive または acceptance 判断を含む操作ではユーザー確認を挟んでいる
- v0.1 の範囲外である並列実行や自動タスク分解を提案していない
