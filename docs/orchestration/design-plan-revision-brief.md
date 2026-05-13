# Design / Plan Revision Brief

## Design Revision Topics

- **認証と匿名投稿**: ログイン／サインアップ未実装を踏まえ、**未ログイン投稿を残す場合の厳制限**（レート・回数等）とログイン済みとの差を Design の Authentication / Policy に追記する。
- **画面設計**: 主要画面一覧、状態遷移（ローディング・エラー・空）、**ヘッダー IA**（ルート直リンクの解消）を Design の UI 境界として扱う節を追加する。
- **LLM 出力と表記**: **5-7-5 の読み**に対し、**漢字化する／しないを LLM が制御**する要件を Design の LLM／表示方針に明文化する。
- **エラーと非同期**: **API エラー・生成エラー**のユーザー向け扱い、**フェッチ中ローディング・送信時ボタン非活性**を Design の UX 境界に含める。

## Plan Revision Requirements

- **検証とタスク YAML**: `tc.e2e-write` を **Playwright（または同等）で実ブラウザ経路を検証**するタスクに再定義し、静的文字列検査のみの smoke を禁止する旨を acceptance と validator に書く。
- **Neon / Hyperdrive**: プレースホルダをコミットしない **再現手順**（生成設定・deploy 時注入）をタスク化し、**lastReview reject を解消**する条件を明記する。
- **ルート test**: ルート `package.json` の **`test` スクリプト**と、API 変更時は **`apps/api` の typecheck/test** が走るようタスクの検証コマンドを揃える。
- **ギャップの分解**: `implementation-gaps-post-review.md` の各項目を **intermediate-plan の新規 task candidate** に落とし、画面設計タスクを先行依存に置く。

## Evidence Links

- セッション **`review-context.json`**: `~/.solo-dev-orchestrator/sessions/tanka-reply-sns/review-context.json`（`git`・`tasks` 埋め込み）。
- **実装ギャップ**: `/Users/akyrhysd/work/tsukeai/docs/orchestration/implementation-gaps-post-review.md`
- **タスク YAML 例（reject）**: `tasks/tc.e2e-write.yaml`, `tasks/tc.neon.yaml` under `/Users/akyrhysd/work/tsukeai/tasks/`
