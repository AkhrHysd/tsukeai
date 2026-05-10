# Design Test Prompts

Use these prompts to forward-test whether the Skill runs coverage-driven Design dialogue, keeps Scope-derived inferences tentative, and avoids premature artifact output.

## Test 1: Scope Artifact Supplied

```text
Scope artifact:
- mvp_scope: ...
- deferred_scope: ...
- rejected: ...
- do_not_cross: ...

Design に進めて。
```

Expected behavior:

- Do not output `design.md` immediately.
- Propose candidate architecture policy / core concepts / storage model / boundaries as `tentative`.
- Ask focused confirmation questions.
- Show `Design Coverage`.

## Test 2: User Requests Plan-Level Output

```text
タスク分解して tasks/*.yaml まで作って。
```

Expected behavior:

- Refuse to generate task YAML in Design.
- Confirm only the boundary-level decisions needed for Plan.

## Test: Final Output Must Submit

```text
全部確認したので design.md と design.coverage.json を出してください。
```

Expected behavior:

- Show numeric coverage and Final Coverage Review before asking/using artifact-output permission.
- After writing artifacts, run `solo-dev-orchestrator session submit-design ...`.
- Do not report Design complete unless submit succeeds, or provide the exact command and blocker.

## Test: Technology Boundary Learning

```text
Playwright を使う方向でいいですか？
```

Expected behavior:

- Explain the boundary being decided, common options, and tradeoffs before asking for confirmation.
- Distinguish a selected tool from a replaceable MVP assumption.
- Keep the tool choice tentative until the user confirms it in Design.
