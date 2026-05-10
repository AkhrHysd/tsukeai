# Direction Test Prompts

Use these prompts to forward-test whether the Skill runs coverage-driven Direction dialogue, keeps Discovery-derived inferences tentative, and avoids premature artifact output.

## Test 1: Discovery Artifact Supplied

```text
Discovery artifact:
- idea: 個人開発に特化したAI開発オーケストレーター
- target_user_candidate: 個人開発者
- pain_candidates: 壁打ちから実装タスクへの接続が曖昧
- existing_alternatives: ChatGPT, GitHub Issues, Notion
- dissatisfaction: 会話の結論が散らばり、実装単位に落ちない

Direction に進めて。
```

Expected behavior:

- Do not output `direction.md` immediately.
- Treat project identity, primary user, success criteria, constraints, and non-goals as `tentative` or `missing`, not `confirmed`.
- Show `Direction Coverage`.
- Ask focused confirmation questions.

## Test 2: User Says Discovery Is Correct

```text
Discovery に書いてある通りでいいです。
```

Expected behavior:

- Ask which Direction hypotheses this confirms if the response is ambiguous.
- Do not mark every required Direction topic `confirmed` solely because Discovery exists.
- Continue questions for missing constraints, non-goals, rationale, or boundary seeds.

## Test 3: User Requests Artifact Too Early

```text
もう Direction Artifact を出して。
```

Expected behavior:

- If required topics remain `missing` or `tentative`, refuse final artifact output for now and show the incomplete coverage.
- Ask the next smallest useful confirmation question.
- If coverage is complete but permission was not explicit, ask for permission.

## Test 4: User Pushes Into Scope

```text
MVP はどこまでにする？最初の画面も決めよう。
```

Expected behavior:

- Do not define MVP scope or screens.
- Explain that Scope and Design decisions are later phases.
- Convert the request into Direction-level boundary or non-goal confirmation if useful.

## Test 5: Explicit Deferral

```text
制約は今は決めずに deferred にして。
```

Expected behavior:

- Mark `constraints` as `explicitly_deferred`.
- Record the reason if provided, or ask for a short reason if needed.
- Continue remaining Direction coverage instead of treating deferral as confirmation.

## Test 6: Polished But Unsupported Artifact

```text
Discovery からそれっぽく direction.md を作りました。coverage は全部 confirmed です。
success criteria / non-goals / constraints は Discovery から推測しています。
MVP は issue import、task YAML export、TypeScript 実装、CI まで含めます。
```

Expected behavior:

- Reject the artifact or refuse to treat it as valid final Direction output.
- Explain that confirmed Direction topics need current Direction user evidence, not only Discovery-derived inference.
- Require explicit user confirmation or explicit deferral for success criteria, non-goals, and constraints.
- Flag MVP scope, stack, implementation, CI, and task YAML details as Scope/Design/Plan contamination.

## Test 7: Final Output Must Submit

```text
全部確認したので direction.md と direction.coverage.json を出してください。
```

Expected behavior:

- Show numeric coverage and Final Coverage Review before asking/using artifact-output permission.
- After writing artifacts, run `solo-dev-orchestrator session submit-direction ...`.
- Do not report Direction complete unless submit succeeds, or provide the exact command and blocker.

## Test 8: Decision Brief Required

```text
Storybook, existing GPT workflow, and a custom orchestrator direction are all plausible. Which one should we pursue?
```

Expected behavior:

- Compare the alternatives with a Decision Brief before asking for confirmation.
- Explain what each direction optimizes for and risks.
- Keep the recommended direction `tentative` until the user confirms it.
