---
name: orchestrator-config-authoring
description: Draft or revise orchestrator.config.json for llm-task-orchestrator when a user needs an initial repo-local config, safer runner or reviewer settings, validator stage setup, or environment-variable override guidance.
---

# Orchestrator Config Authoring

この skill は `orchestrator.config.json` を作成・更新するときに使う。対象 repo で task 実行を始めるための初期設定、`runner` と `reviewer` のコマンド調整、validator stage の有効化や skip 方針の整理が対象で、CLI 実装に存在しないキーは追加しない。

## 使う場面

- 対象 repo に最初の `orchestrator.config.json` を置きたい
- `runner` を `codex` や `node` に切り替えたい
- `reviewer` の引数を調整したい
- `validator` の `lint` / `typecheck` / `test` を repo の実情に合わせたい
- env override 前提の設定説明を作りたい

## 作業手順

1. 対象 repo の `orchestrator.config.json` があれば最初に読む。
2. 無ければ `references/config-reference.md` を基準に最小構成から組み立てる。
3. `tasksDir` が標準の `tasks` でよいか確認する。
4. `runner` は実装を行うので、書き込み可能なコマンドと引数にする。
5. `reviewer` はレビュー専用として構成し、修正用の意図を混ぜない。
6. `validator` は対象 repo に存在するコマンドだけを設定し、不明なら未設定のまま skip できる形にする。
7. env override を説明する場合は、設定ファイルより環境変数が優先されることを明記する。

## 出力ルール

- 出力は `orchestrator.config.json` の JSON を優先する。
- 例を出すときは、対象 repo に無い前提の validator stage をむやみに埋めない。
- `runner.args` と `reviewer.args` は JSON 配列にする。
- `validator` の各 stage は `{ "command": string, "args"?: string[] }` の配列にする。
- 省略可能な項目は、不要なら書かない。
- env override を書く場合だけ、`ORCHESTRATOR_*` 名を補足する。

## 最小構成の考え方

- `tasksDir` は通常省略してもよいが、説明用サンプルでは明示してよい
- `runner.command` が最重要
- `reviewer.command` は通常 `codex`
- `validator` は未設定なら skip されるので、初期導入では空でもよい
- 書き込みが必要な runner には read-only 前提の説明をしない

## 参照先

- field 一覧、デフォルト値、env override は `references/config-reference.md`
- 実際の読込順と default は `src/cli/context.ts`
- 利用例は `README.md`

## 注意点

- CLI 実装に無いキーを増やさない
- `runner` と `reviewer` の責務を混同しない
- validator コマンドは対象 repo に存在しないなら無理に埋めない
- `ORCHESTRATOR_REPO_ROOT` は config ファイルの中ではなく環境変数で与える
- `*_ARGS` や `*_COMMANDS` は env override では JSON 文字列になるが、config ファイル内では通常の JSON 配列で書く

## 最終確認

出力前に次を確認する。

- JSON として妥当
- `runner`, `reviewer`, `validator` の shape が CLI 実装と一致している
- 対象 repo に無い lint/test 前提を勝手に追加していない
- env override を説明するとき、config と env の表現形式を混同していない
