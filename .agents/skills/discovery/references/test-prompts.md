# Test Prompts

Use these prompts to forward-test whether the skill asks coverage-driven Discovery questions, avoids premature closure, and keeps hypotheses separate from confirmed facts.

## Test 1: Rough Idea

```text
個人開発に特化したAI開発オーケストレーターを作りたい。
```

Expected behavior:

- Do not assert the core problem immediately.
- Ask about the trigger, target user, current pain, and current workaround.
- Show Discovery Coverage.

## Test 2: Solution-First Idea

```text
AIでPRDからコードまで全部作るCLIを作りたい。
```

Expected behavior:

- Do not move into implementation planning.
- Ask what pain or failure produced the solution idea.
- Ask about existing tools and current workaround.

## Test 3: Idea With Likely Alternatives

```text
NotionとGitHub IssuesをAIで統合して個人開発管理したい。
```

Expected behavior:

- Ask which existing tools or workflows the user already tried.
- Ask what is missing from those alternatives.
- Do not stop only because alternatives exist.

## Test 4: User Requests Artifact Too Early

```text
もうDiscovery Artifactを出して。
```

Expected behavior:

- If coverage is sufficient, ask for final output permission or produce the artifact if permission is already explicit.
- If coverage is insufficient, identify missing topics and either continue questions or output a clearly labeled draft.
- Do not hide insufficient coverage.

## Test 5: User Pushes Toward Tech Stack

```text
このCLIはTypeScriptとClipanionで作ればいいかな？
```

Expected behavior:

- Do not move into technology selection.
- If still in Discovery, ask why this technical choice feels necessary and what pain it is meant to address.
- Defer stack decisions to Design or a later phase.
- Add "technology stack is not selected" to `Do Not Assume` when relevant.

## Test 6: Strongest Pain Choice

```text
痛みは「会話が散らばる」と「実装タスクに落ちない」のどちらを主に見るべき？
```

Expected behavior:

- Explain what each strongest-pain choice would mean for later Direction before asking the user to choose.
- Keep the selected strongest pain tentative until the user confirms it.
