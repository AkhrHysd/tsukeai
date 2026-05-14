# Review Task

Task ID: tc.transform-arch-gate
Title: 変換アーキ ADR（Milestone 3.5）

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.transform-arch-gate

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
logs: test: skipped by task validationPolicy

## Changed Files
- docs/orchestration/transform-architecture.md

## Unified Diff
```diff
diff --git a/docs/orchestration/transform-architecture.md b/docs/orchestration/transform-architecture.md
index bc925cb..8c74142 100644
--- a/docs/orchestration/transform-architecture.md
+++ b/docs/orchestration/transform-architecture.md
@@ -27,6 +27,48 @@ MVP の変換アーキテクチャは **非同期ジョブを正とし、短時
 
 ジョブ状態は少なくとも `queued`、`processing`、`succeeded`、`failed`、`rejected` を持つ。`failed` は一時障害やタイムアウト後の失敗、`rejected` は検証失敗や入力制約違反など再試行しても同じ結果になりやすい失敗を表す。
 
+## Architecture Decision Records
+
+### ADR-001: Transform execution is asynchronous with a short synchronous wait
+
+**Status**: Accepted.
+
+**Context**: 変換は外部 LLM に依存し、応答時間、レート制限、一時障害がユーザー操作の待ち時間に直接影響する。完全同期にすると Workers のタイムアウトや外部依存の揺らぎが投稿作成 UX と公開整合性に入り込む。一方で、短時間で完了する通常ケースでは、送信直後に公開結果が返る体験を保ちたい。
+
+**Decision**: 変換は非同期ジョブを正とし、API はジョブ作成後に短時間だけ完了を待つ。待機中に `succeeded` へ到達した場合は公開結果を返し、完了しない場合は `queued` または `processing` のジョブ状態を返す。クライアントは返却されたジョブ ID で状態を再取得する。
+
+**Consequences**: 送信直後の公開は保証しないが、LLM 遅延と一時障害をユーザー操作から切り離せる。UI はジョブ状態表示と再取得を持つ必要がある。
+
+### ADR-002: Failed transforms do not publish and use recoverable user actions
+
+**Status**: Accepted.
+
+**Context**: 変換失敗時に素入力、未検証の LLM 出力、途中結果を公開すると、5-7-5 / 7-7 の形式保証と非公開入力の境界が崩れる。利用者には失敗を理解できる案内が必要だが、prompt、provider error、内部判定の詳細は公開しない。
+
+**Decision**: 変換失敗、タイムアウト、上限超過、検証失敗では公開レコードを作らない。ユーザー向けエラーは `retry_later` または `revise_input` に寄せ、再送信できる失敗と入力修正が必要な失敗を区別する。変換基盤が落ちていても、既存の公開句一覧やスレッド閲覧は可能な限り維持する。
+
+**Consequences**: 失敗時も公開データの整合性と入力非公開の境界を保てる。利用者には失敗理由の詳細ではなく、次に取れる行動を返す必要がある。
+
+### ADR-003: Retries are bounded and all create operations are idempotent
+
+**Status**: Accepted.
+
+**Context**: ブラウザ再送、ネットワーク再試行、ジョブ実行部の再実行により、同じ入力から重複投稿・重複返信が作られる可能性がある。外部 LLM の一時障害には再試行が有効だが、入力制約違反や検証失敗を繰り返すとコストと待ち時間だけが増える。
+
+**Decision**: 一時的な LLM/API 失敗だけをサーバ側で上限付きに再試行する。形式検証失敗、認可失敗、入力制約違反、プロンプト注入検出、コスト上限超過は自動再試行しない。投稿・返信作成は `user_id`、対象種別、対象親 ID、入力本文のハッシュ、クライアント発行の冪等キーを含む論理キーで冪等化する。同じ論理キーの再送は同じジョブ、または同じ公開結果 ID を返す。
+
+**Consequences**: ユーザー操作やジョブ実行の再送で重複公開されにくくなる。実装は冪等キーの保存、状態遷移の排他制御、終端状態の再利用を守る必要がある。
+
+### ADR-004: Transform cost is capped before job creation and during execution
+
+**Status**: Accepted.
+
+**Context**: LLM 呼び出しは従量課金であり、リクエスト集中、悪意ある連続送信、実装バグによるループ再試行で予期しない費用が発生する。MVP では具体的なプロバイダや単価を固定しないが、上限を置く運用契約は変換実装前に決める必要がある。
+
+**Decision**: アカウント／セッション単位の時間窓上限、同時実行上限、LLM 呼び出し回数上限、入力長上限を設ける。上限に達した場合は新規ジョブを作らず、実行中に上限到達を検出した場合は追加試行を止めて明示的な上限超過エラーにする。観測には概算コスト、試行回数、モデル名、処理時間を残すが、素入力や prompt body は残さない。
+
+**Consequences**: 予期しない費用増加を抑えられる一方で、正当な利用者にも待機や後続再試行を求める場合がある。上限値そのものは実装・運用タスクで環境ごとに調整する。
+
 ### Shared Transform Contract
 
 変換ジョブの共有契約は `packages/shared/src/index.ts` を正本とする。API、Web、将来のジョブ実行部は、状態名・冪等キー・公開エラー・観測項目をこの契約から参照する。

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