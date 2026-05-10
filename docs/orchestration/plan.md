# Plan Artifact

## Source Design

この Plan は、セッション `tanka-reply-sns` の **`design.md`** および **`design.coverage.json`** を唯一の上流の方式・境界入力とする。Neon（東京）＋ Hyperdrive、Hono on Cloudflare Workers、Next.js App Router（SSR）、REST（JSON）、モノレポ（pnpm workspaces／Turborepo）、Biome 単一、GT 未ログイン閲覧、投稿／返信はログイン必須、本人削除（M6）、通報／管理者削除は MVP 外、といった Design の確定事項を前提に分解する。認証方式は **`authentication.md`** で **パスワード + 任意のパスキー（WebAuthn） + 任意の TOTP、SMS 不採用**として記録済み。

実装リポジトリの Bootstrap 先は **`/Users/akyrhysd/work/tanka-reply-sns`** とする（ユーザーが Bootstrap を実行済み）。

## Planning Boundary

Plan は **タスク候補・依存・パス候補・Done 条件・検証／レビュー観点・Exporter 準備**までを扱う。**ソースコード本体・パッチ・マイグレーション全文・Exporter によるタスク定義ファイルの生成・llm-task-orchestrator の実行設定の具体的な中身**は対象外とし、Plan Exporter が後続で YAML に落とす。

変換パイプラインの **アーキテクチャは Design で未確定**だったため、Plan では **Milestone 3.5 のゲート**で決定し、ゲート完了まで書き込み系の実装候補は **blocked** とする（楽観分割を避ける）。

## Milestones

1. **Foundation** — モノレポ骨格、Biome、`packages/shared` の出口方針。
2. **Data & API core** — Workers 上の Hono、Neon／Hyperdrive、最小スキーマ運用、公開読み取りのタイムライン JSON。
3. **Auth boundary** — 認証方式の決定ゲート（`tc.authgate`）、セッション／Cookie と書き込み境界（`tc.session`）。
4. **3.5 Transform architecture gate** — **`docs/orchestration/transform-architecture.md`** に **ADR 形式**で、同期／非同期、失敗時 UX、再試行・冪等性、コスト上限を含む変換アーキを記録する（`tc.transform-arch-gate`）。**実装コードは書かない。**
5. **GT read UI** — Next の App Router シェル、GT の SSR（公開 API と整合）。
6. **Writes, contracts, delete, smoke** — LLM アダプタ、変換契約、投稿／返信フロー、プロンプト／安全、FormCheck、本人削除、E2E。うち **ゲート未完了の候補は blocked**。

## Task Candidates

機械可読な一覧・依存・パス・Done 条件の参照は **`intermediate-plan.json`** を正とする。

方針の要点:

- **Milestone 5（旧）の一括バンドルは採用しない。** 投稿／返信パイプラインは **変換アーキ確定後**に分割した候補へ落とす。
- **`tc.transform-arch-gate`** が完了するまで、`tc.llm-adapter`・`tc.transform-contract`・変換フロー・プロンプト安全・本人削除・書き込み E2E は **blocked**（Exporter 上も blocked 一覧に載せる）。
- **`tc.formcheck`** はアーキと部分的に独立しうるが、規則の確度により **needs-refinement**。
- **`tc.e2e-read`**（GT 閲覧スモーク）はゲートと独立しやすく **candidate**。

## Dependencies

**`intermediate-plan.json`** の `taskDependencies` に記載する。解釈は **from が後続タスク、to が先行タスク**（後続は先行の完了を前提とする）。

おおまかな筋:

- 共有契約とモノレポ → API コア → 公開タイムライン読み取り。
- 認証方式決定（`authentication.md`） → セッション境界。
- **スキーマとセッションが揃ったうえで `tc.transform-arch-gate`**（3.5）。その後に変換契約・LLM アダプタ・各変換フロー。
- GT SSR は公開 API と Next シェルに依存。
- 書き込み E2E は変換経路と削除が整理されるまで blocked。

## Acceptance Criteria

Plan レベルの Done は **`intermediate-plan.json`** の `acceptanceCriteria` に ID 付きで列挙する。リポジトリ全体として、少なくとも次を満たすことを目標とする（タスクへの割付は JSON 側）。

- ルートで Biome による Lint／Format が方針どおり実行できる。
- 公開タイムライン JSON が未認証で取得できる。
- 認証方式が文書化され、書き込みはセッション必須の境界が説明できる。
- **`docs/orchestration/transform-architecture.md`** に、合意した変換アーキ（同期性・失敗 UX・冪等・コスト）が ADR として記録されている。
- ゲート完了後にのみ、変換フロー系タスクを ready へ昇格できる。
- クリティカルパスについて Playwright スモークが通る（LLM 実呼び出しに CI を依存させない）。

## Validation Focus

- **静的検査**: Biome、型チェック、共有 REST 契約の Vitest 等（Design Testing Strategy）。
- **振る舞い**: 公開 API 契約、FormCheck の非 LLM 検証、E2E スモーク。
- **運用**: CI で素データをログに残さない、Secrets をリポジトリに含めない。

詳細な紐付けは **`intermediate-plan.json`** の `validationFocus` と各タスクの `validationFocusIds`。

## Review Focus

- **認証・認可**: セッション境界、本人削除（M6）、ゲート前に不可逆な実装コミットをしないこと。
- **プライバシー**: 長文・返信素の短期保持とログ抑止。
- **変換アーキ**: 未確定のまま実装タスクを ready にしないこと。
- **Scope／Design 遵守**: Deferred にない機能を混入しないこと。

詳細は **`intermediate-plan.json`** の `reviewFocus` と各タスクの `reviewFocusIds`。

## Export Readiness

書き込み系・変換系の多数の候補は **`blocked`**。**`tc.transform-arch-gate`** 完了後に `tc.transform-contract`・`tc.llm-adapter` から順に **needs-refinement → ready** へ昇格させる。Exporter は **not-ready** を前提とし、ブロッカーを `exportReadiness.blockers` に明示する。

## Do Not Cross

Plan として **実装コード・パッチ・Exporter によるタスク定義の生成・リポジトリへの直接編集**は行わない。DDL 全文やワークフロー YAML の完成稿は Plan の外とする。

## Artifact Output Permission

ユーザーは Final Coverage Review として、「セッション tanka-reply-sns の plan.md（Acceptance Criteria／Validation Focus／Review Focus／Export Readiness／Do Not Cross を含む）、plan.coverage.json、intermediate-plan.json の内容に異議はなく、このセットで確定してよい。submit-plan の LLM validation に回してよい」と明示した（2026-05-10）。

あわせて **`docs/orchestration/transform-architecture.md` を ADR とする**ことについては別途 **Yes** と回答済み（2026-05-10）。
