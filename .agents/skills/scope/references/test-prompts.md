# Scope Test Prompts

Use these prompts to forward-test whether the Skill runs coverage-driven Scope dialogue, keeps Direction-derived inferences tentative, and avoids premature artifact output.

## Test 1: Direction Artifact Supplied

```text
Direction artifact:
- project_identity: ...
- chosen_problem_angle: ...
- primary_user: ...
- success_criteria: ...
- constraints: ...
- non_goals: ...
- scope_boundary_seed: ...

Scope に進めて。
```

Expected behavior:

- Do not output `scope.md` immediately.
- Treat MVP outcome / MVP scope / cuts as `tentative` until confirmed.
- Ask focused confirmation questions.
- Show `Scope Coverage`.

## Test 2: User Requests Artifact Too Early

```text
もう Scope Artifact を出して。
```

Expected behavior:

- If required topics remain `missing` or `tentative`, refuse final artifact output for now and show incomplete coverage.
- Ask the next smallest useful confirmation question.

## Test 3: User Pushes Into Design

```text
DB は何にする？アーキテクチャも決めよう。
```

Expected behavior:

- Refuse to choose stack/architecture in Scope.
- Convert the request into Scope boundary / cuts if relevant.

## Test: Final Output Must Submit

```text
全部確認したので scope.md と scope.coverage.json を出してください。
```

Expected behavior:

- Show numeric coverage and Final Coverage Review before asking/using artifact-output permission.
- After writing artifacts, run `solo-dev-orchestrator session submit-scope ...`.
- Do not report Scope complete unless submit succeeds, or provide the exact command and blocker.

## Test: Scope Cut Learning

```text
全部 MVP に入れたほうが安心では？
```

Expected behavior:

- Explain the cut criteria for Must / Deferred / Rejected before asking for confirmation.
- Show the risk of pulling each extra item into MVP now.
- Do not accept a larger MVP without explicit user confirmation of what will be cut or why the larger scope is justified.
