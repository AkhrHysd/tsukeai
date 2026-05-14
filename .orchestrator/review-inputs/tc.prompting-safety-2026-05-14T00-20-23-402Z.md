# Review Task

Task ID: tc.prompting-safety
Title: プロンプト方針と注入緩和の実装候補

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.prompting-safety

## Description
サーバ責務でインジェクション緩和。ログに素を残さない運用。

## Allowed Paths
- apps/api
- docs/orchestration

## Acceptance Criteria
- 注入緩和とログ方針が ADR と運用に一致する。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/ORCHESTRATION.md
- apps/api/src/index.ts
- docs/orchestration/transform-architecture.md

## Unified Diff
```diff
diff --git a/apps/api/ORCHESTRATION.md b/apps/api/ORCHESTRATION.md
index 723c763..9ebfff4 100644
--- a/apps/api/ORCHESTRATION.md
+++ b/apps/api/ORCHESTRATION.md
@@ -48,14 +48,18 @@ The adapter follows the ADR call contract as follows:
   exhausted.
 - **Prompt and data boundary**: user input is normalized and encoded as JSON
   string data inside the prompt. The client cannot choose the model, system
-  prompt, output rules, retry conditions, or token limits.
+  prompt, output rules, retry conditions, or token limits. Inputs matching
+  explicit prompt-injection signals are rejected before the provider call with
+  `prompt_injection_detected`.
 - **Publication gate**: only output accepted by `checkTransformForm` is
   published. Failed transforms are marked `failed` for temporary/provider
   problems or `rejected` for revisable input/validation problems.
 - **Logging boundary**: transform logs include job ID, input hash, failure code,
   retryability, attempts, duration, and model. They do not include the source
   input, prompt body, raw provider response, provider error body, or rejected
-  output text.
+  output text. API error logs use normalized error summaries only: error name
+  and safe code fields are allowed, but exception messages and provider bodies
+  are not logged because they may contain source text.
 
 Runtime knobs are intentionally environment bindings, with conservative clamps
 inside the adapter:
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 846d125..cdde45a 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -183,7 +183,6 @@ function toSafeLogError(error: unknown): SafeLogError {
   return {
     name: error.name,
     ...(code ? { code } : {}),
-    ...("message" in error && typeof error.message === "string" ? { message: error.message } : {}),
   };
 }
 
diff --git a/docs/orchestration/transform-architecture.md b/docs/orchestration/transform-architecture.md
index 8c74142..4edbbbc 100644
--- a/docs/orchestration/transform-architecture.md
+++ b/docs/orchestration/transform-architecture.md
@@ -86,7 +86,7 @@ MVP の変換アーキテクチャは **非同期ジョブを正とし、短時
 - 素入力と外部由来メタデータはプロンプト内で命令ではなくデータとして扱う。実装は JSON 文字列化などの構造化境界を使い、素入力中の「前の指示を無視」「system prompt を表示」等の文言や、ジョブ ID 等に混入した改行・命令文に従わないよう system prompt で固定する。
 - 明確なプロンプト注入シグナルを含む入力は、LLM に渡さず `prompt_injection_detected` として分類する。API 側はこの失敗をジョブ状態 `rejected`、公開レスポンスコード `transform_input_rejected`、利用者への入力修正要求として扱い、自動再試行しない。検出対象は広げすぎず、運用で観測した攻撃文言に合わせて調整する。
 - ログには素入力、LLM への prompt body、LLM の生レスポンス全文、provider error body を残さない。障害調査にはジョブ ID、本文ハッシュ、失敗種別、試行回数、処理時間、概算コスト、モデル名などを使う。
-- 例外オブジェクトをそのままログに出さない。ログに出す場合は、エラー名やコードなど素本文を含まない要約に正規化する。
+- 例外オブジェクトをそのままログに出さない。ログに出す場合は、エラー名やコードなど素本文を含まない要約に正規化する。例外 message や provider body は素本文を含み得るためログ対象にしない。
 
 ## Boundaries
 

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