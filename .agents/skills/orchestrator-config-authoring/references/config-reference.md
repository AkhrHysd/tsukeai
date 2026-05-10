# Orchestrator Config Reference

`orchestrator.config.json` は対象 repo 直下に置く。CLI はまずこのファイルを読み、必要なら `ORCHESTRATOR_*` 環境変数で上書きする。

優先順位:

1. CLI のデフォルト値
2. `orchestrator.config.json`
3. `ORCHESTRATOR_*` 環境変数

## サポートされる shape

```json
{
  "tasksDir": "tasks",
  "runner": {
    "command": "codex",
    "args": ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check"],
    "cwd": "."
  },
  "reviewer": {
    "command": "codex",
    "args": ["exec", "--skip-git-repo-check"],
    "cwd": "."
  },
  "validator": {
    "format": [
      { "command": "npm", "args": ["run", "format:check"] }
    ],
    "lint": [
      { "command": "npm", "args": ["run", "lint"] }
    ],
    "typecheck": [
      { "command": "npm", "args": ["run", "typecheck"] }
    ],
    "test": [
      { "command": "npm", "args": ["test"] }
    ]
  }
}
```

## Field Summary

- `tasksDir`
  - task YAML を置くディレクトリ
  - 省略時は `tasks`
- `runner.command`
  - 実装用コマンド
  - 省略時は `llm`
- `runner.args`
  - 文字列配列
- `runner.cwd`
  - 省略可
- `reviewer.command`
  - reviewer 用コマンド
  - 省略時は `codex`
- `reviewer.args`
  - 文字列配列
  - 省略時は `["exec"]`
- `reviewer.cwd`
  - 省略可
- `validator.format`, `validator.lint`, `validator.typecheck`, `validator.test`
  - `{ "command": string, "args"?: string[] }` の配列
  - 未設定なら skip

## Validator Guidance

- 対象 repo に `package.json` や script が無い段階では、validator stage を無理に入れなくてよい
- 実装上、未設定 stage は skip される
- 既知のコマンドだけを設定する

## Safe Starter Examples

### 最小構成

```json
{
  "runner": {
    "command": "codex",
    "args": ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check"]
  },
  "reviewer": {
    "command": "codex",
    "args": ["exec", "--skip-git-repo-check"]
  }
}
```

### Node ベースの簡易疎通

```json
{
  "runner": {
    "command": "node",
    "args": ["-e", "const fs=require(\"fs\");fs.appendFileSync(\"README.md\",\"\\n<!-- sample run marker -->\\n\");"]
  },
  "reviewer": {
    "command": "node",
    "args": ["-e", "process.stdout.write(JSON.stringify({decision:\"accept\",summary:\"ok\",requiredFixes:[],riskNotes:[],scopeViolations:[]}))"]
  }
}
```

## Agent CLI Examples

以下は 2026-04-17 時点の公式 CLI ドキュメントを前提にした例。`runner` は stdin から prompt を受けて workspace を編集できることが重要で、`reviewer` はさらに JSON を安定して返せる必要がある。

### Codex

```json
{
  "runner": {
    "command": "codex",
    "args": ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check"]
  },
  "reviewer": {
    "command": "codex",
    "args": ["exec", "--skip-git-repo-check"]
  }
}
```

### Claude Code

Claude Code は `claude -p` で非対話実行でき、stdin のパイプ入力にも対応する。reviewer に使う場合は `--output-format json` を前提に、review 用 prompt から JSON 以外を出さないようにする。

```json
{
  "runner": {
    "command": "claude",
    "args": ["-p", "--dangerously-skip-permissions"]
  },
  "reviewer": {
    "command": "claude",
    "args": ["-p", "--output-format", "json"]
  }
}
```

### Cursor CLI

Cursor CLI は `cursor-agent -p` の headless 実行が使え、変更を適用するには `--force` が必要な構成がある。reviewer に使う場合は text や json 出力を選べるが、JSON shape をこの orchestrator の reviewer 契約に合わせる追加の prompt 調整が必要。

```json
{
  "runner": {
    "command": "cursor-agent",
    "args": ["-p", "--force", "--output-format", "text"]
  }
}
```

### OpenCode

OpenCode は `opencode run` で非対話実行できる。主に runner 向けの例として扱い、reviewer に流用する場合は JSON を厳密に返すよう別途検証する。

```json
{
  "runner": {
    "command": "opencode",
    "args": ["run"]
  }
}
```

## Reviewer Compatibility Notes

- もっともそのまま使いやすいのは `codex`
- `claude` は print mode と JSON 出力があるため reviewer 候補になる
- `cursor-agent` と `opencode` は runner 用の例としては有効だが、reviewer として使うなら JSON shape の安定性を別途確認する
- reviewer が JSON 以外を混ぜると orchestrator 側の parse に失敗する

## Environment Variable Override

config ファイル内では JSON の通常表現を使うが、環境変数では一部を JSON 文字列で渡す。

- `ORCHESTRATOR_REPO_ROOT`
- `ORCHESTRATOR_TASKS_DIR`
- `ORCHESTRATOR_RUNNER_COMMAND`
- `ORCHESTRATOR_RUNNER_ARGS`
- `ORCHESTRATOR_RUNNER_CWD`
- `ORCHESTRATOR_REVIEWER_COMMAND`
- `ORCHESTRATOR_REVIEWER_ARGS`
- `ORCHESTRATOR_REVIEWER_CWD`
- `ORCHESTRATOR_VALIDATOR_FORMAT_COMMANDS`
- `ORCHESTRATOR_VALIDATOR_LINT_COMMANDS`
- `ORCHESTRATOR_VALIDATOR_TYPECHECK_COMMANDS`
- `ORCHESTRATOR_VALIDATOR_TEST_COMMANDS`

例:

```bash
export ORCHESTRATOR_REPO_ROOT=/path/to/repo
export ORCHESTRATOR_RUNNER_COMMAND=codex
export ORCHESTRATOR_RUNNER_ARGS='["exec","--sandbox","workspace-write","--skip-git-repo-check"]'
```

## Common Pitfalls

- config ファイルなのに `runner.args` を文字列で書く
- env override なのに `ORCHESTRATOR_RUNNER_ARGS` を JSON 文字列にしない
- `runner` を read-only sandbox にしてしまう
- 対象 repo に存在しない validator コマンドを最初から必須にする
- `ORCHESTRATOR_REPO_ROOT` を config ファイル内へ書こうとする
