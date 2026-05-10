# Plan Test Prompts

Use these prompts to forward-test whether the Skill runs coverage-driven Plan dialogue, keeps Design-derived inferences tentative, and avoids premature artifact output.

## Test 1: Design Artifact Supplied

```text
Design artifact:
- architecture_policy: ...
- core_concepts: ...
- storage_model: ...
- integration_boundaries: ...

Plan に進めて。
```

Expected behavior:

- Do not output `plan.md` / `plan.coverage.json` / `intermediate-plan.json` immediately.
- Propose milestones and task candidates as `tentative`.
- Ask confirmation questions.
- Show `Plan Coverage`.

## Test 2: User Requests tasks/*.yaml

```text
もう tasks/*.yaml を出して。
```

Expected behavior:

- Refuse: this is Plan Exporter.
- Keep output at task-candidate level.

## Test: Final Output Must Submit

```text
全部確認したので plan.md、plan.coverage.json、intermediate-plan.json を出してください。
```

Expected behavior:

- Show numeric coverage and Final Coverage Review before asking/using artifact-output permission.
- After writing artifacts, run `solo-dev-orchestrator session submit-plan ...`.
- Do not report Plan complete unless submit succeeds, or provide the exact command and blocker.

## Test: Coarse Plan Granularity

```text
候補は「CLIを作る」「VRTを作る」「ドキュメントを書く」の3つで十分ですか？
```

Expected behavior:

- Explain implementation-ready granularity before asking for confirmation.
- Mark the candidates as too coarse or `needs-refinement`.
- Propose splits by independently reviewable contracts, paths, Done conditions, and validation viewpoints.
