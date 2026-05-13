# Review Artifact

## Implementation Evidence

レビュー開始時点のスナップショットはセッションの **`review-context.json`**（`session start-review tanka-reply-sns --target-dir /Users/akyrhysd/work/tsukeai --tasks-dir /Users/akyrhysd/work/tsukeai/tasks` で生成）に記録されている。

- **ターゲットリポジトリ**: `/Users/akyrhysd/work/tsukeai`
- **タスク証跡**: `tasks/*.yaml` 20 件分の内容が `review-context.json` の `tasks.files` に埋め込まれている（例: `tc.e2e-write.yaml`, `tc.neon.yaml`, `tc.transform-arch-gate.yaml` など）。
- **git**: 当該スナップショットでは **`git status` / `git diff` が空**だった。以降の差分はリポジトリで通常の `git status` / `git diff` を参照する。
- **追加メモ**: 実装ギャップの一覧は **`/Users/akyrhysd/work/tsukeai/docs/orchestration/implementation-gaps-post-review.md`** にユーザー記載分を反映した。

## Plan and Task Alignment

- **Plan / intermediate-plan** で想定していた変換アーキゲート（`tc.transform-arch-gate`）や契約・投稿／返信フローは、タスク証跡上 **多くが accept かつ done** で、大枠は追従している。
- **乖離**: `tc.e2e-write` は **lastReview が reject**（Playwright 等の実 E2E ではなく静的検査に近い smoke のみ）。Plan で掲げた「書き込みクリティカルパスの検証」と一致していない。
- **乖離**: `tc.neon` は **lastReview が reject**（Hyperdrive のプレースホルダ ID がコミットに残る等、再現性の問題）。
- **検証ログの歪み**: 複数タスクで **`npm test` が Missing script** ながら `passed: true` と記録されている例があり、Plan が期待する検証強度とタスク実行ログが一致しない。

## Design Assumption Gaps

- **認証・プロダクト境界**: Design では GT 未ログイン閲覧・投稿はログイン必須としていたが、実装ギャップとして **ログイン／サインアップ未実装**、かつ **未ログイン投稿を残しつつ厳制限**という方針が後から浮上。Design の認証ストーリーが不足していた。
- **UI / IA**: **画面設計・ヘッダーナビ**が浅く、Design の「方式・境界」止まりで **画面レベルの合意**が足りなかった。
- **表記・LLM 出力**: **漢字表記・漢字化の有無を LLM に委ねる**要件が Design に明示されておらず、実装後にギャップとして発覚。
- **エラー／非同期 UX**: **API／生成エラー、ローディング、ボタン非活性**が Design の運用境界に十分落ちていなかった。

## Missing Plan Work

- **E2E**: `tc.e2e-write` が実ブラウザ経路を検証していない。**Plan / タスクに「静的 smoke だけでは不可」と明記し、validator を Playwright 前提に寄せる**必要がある。
- **Neon / Hyperdrive**: **コミット可能な形の接続手順**とプレースホルダ排除が Plan タスクに弱かった。
- **ルート test スクリプト**: モノレポ全体の **`npm test` 契約**が Plan になく、検証がタスクごとにバラついている。
- **実装ギャップのタスク化**: `implementation-gaps-post-review.md` の項目が **まだ intermediate-plan のタスク候補に分解されていない**。

## Implementation Learnings

- **変換 ADR ゲート**（Milestone 3.5）は有効で、未確定のまま変換実装を進めない方針は実装とも整合しやすかった。
- **レビュー用スナップショット**は有用だが、**git が空の時点で start-review** すると差分が証跡に残らない。**差分があるタイミングで再実行**する運用がよい。
- **タスク YAML に lastReview が残る**ため、人間レビューと機械検証のギャップを後から追いやすい。

## Next Design Topics

- 未ログイン投稿を許容する場合の **制限モデル**（レート・回数・デバイス単位等）と、ログイン済みとの **差別化ポリシー**を Design に書く。
- **ログイン・サインアップ**の方式（パスキー志向等）と、未ログイン経路との関係。
- **画面設計・情報設計**（主要画面、エラー／ローディング状態、ヘッダー IA）。
- **LLM 出力仕様**（5-7-5 の読みと **漢字化の有無**、表記ルール、失敗時のユーザー文言の責務分界）。
- **エラー表示・フェッチ UX**（共通方針を Design の運用／UI 境界に含める）。

## Next Plan Requirements

- **タスク粒度**: E2E・Neon・検証コマンドを **accept 条件と validator に直結**させる（曖昧な smoke 禁止を明文化）。
- **新規タスク候補**: 実装ギャップ文書の各節を **独立タスク**に分解し、依存（画面設計 → UI 実装 → E2E）を intermediate-plan に載せる。
- **再レビュー**: `session start-review` を **実装差分が出た後**に再実行し、`review-context.json` を更新する運用。

## Artifact Output Permission

ユーザーはチャットで **「レビューフェーズを実行してください」** と依頼し、本 Review 成果物（`review.md`、`review.coverage.json`、`design-plan-revision-brief.md`）の生成・提出を求めた（2026-05-12）。
