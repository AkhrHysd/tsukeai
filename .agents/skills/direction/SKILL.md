---
name: direction
description: Use after Discovery is complete for a solo-development software idea. Runs coverage-driven Direction dialogue from Discovery outputs, keeps prior-phase inferences tentative until current-phase user confirmation, avoids Scope/Design/Plan decisions, and produces direction.md plus direction.coverage.json only after coverage and user permission are complete.
---

# Solo Dev Direction

## Purpose

Turn a completed Discovery Artifact into a clear Direction Artifact for the next Scope phase through coverage-driven dialogue. Use the Discovery artifact as required input for hypotheses, not as automatic confirmation. Direction clarifies the project identity, problem angle, primary user, success criteria, constraints, non-goals, and boundaries that should guide later scoping.

This Skill is a Markdown-centered Anthropic Skill package. `SKILL.md` is the authoritative Skill body. Do not treat JSON, generated prompts, CLI commands, or external templates as the primary Direction Skill definition.

## Required Input

Before starting Direction, require the Discovery phase outputs:

- `discovery.md` is the primary input.
- `discovery.coverage.json` is required supporting input for readiness, deferred topics, and validation warnings.
- If the Discovery artifact is missing, incomplete, not ready for Direction, or contradicts `discovery.coverage.json`, stop and ask for the missing Discovery material or identify the specific contradiction.
- Do not invent Discovery facts. Any Direction statement inferred from Discovery must be labeled `tentative` until the user confirms it in the current Direction dialogue.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

**Direction-specific:**

- Discovery artifacts are hypotheses only until confirmed in Direction dialogue; they cannot silently satisfy Direction required topics.
- Every response must show updated Direction Coverage (`confirmed`, `tentative`, `missing`, `explicitly_deferred`).
- Keep asking focused questions while any required topic is `missing` or `tentative`.
- Do not produce `direction.md` in the first response.
- Do not produce the final Direction artifacts until all required topics are `confirmed` or `explicitly_deferred` and the user explicitly permits artifact output.

## Core Rules

- Respond in Japanese unless the user asks otherwise.
- Base Direction hypotheses on the Discovery artifact, but base confirmed Direction decisions only on explicit user confirmation during Direction.
- Keep Direction separate from Scope, Design, Plan, MVP definition, repository structure, technology stack, implementation tasks, estimates, file paths, and task breakdown.
- Do not produce Direction artifacts until the user has reviewed the candidate direction, Direction Coverage is complete, and the user has allowed artifact output.
- Prefer one coherent direction over a list of unrelated possibilities, but preserve rejected alternatives and reasons.
- Make tradeoffs explicit: what this direction prioritizes, what it postpones, and what it deliberately excludes.
- Before asking the user to choose a direction, provide a short Decision Brief comparing plausible alternatives at the product-decision level. Include what each alternative optimizes for, what it risks, and why the recommended direction is only a tentative recommendation until the user confirms it.
- Do not ask for bare `YES/NO` confirmation of `decision_rationale` or `scope_boundary_seed` without first explaining the relevant alternatives and tradeoffs.
- If Discovery has deferred topics that affect Direction, surface them as risks or ask whether they should remain deferred.
- Do not add a Direction prompt generation command. Direction is managed as a standard Skill under `skills/direction/`.

## Direction Topics

Required topics must be `confirmed` or `explicitly_deferred` before final output:

| Topic | Meaning |
| --- | --- |
| `source_discovery` | Which Discovery artifact was used and whether it is ready for Direction |
| `project_identity` | The concise identity of the project or product direction |
| `chosen_problem_angle` | The specific problem angle to pursue first |
| `primary_user` | The first user segment or concrete user context |
| `success_criteria` | The user-visible outcome or signal this direction should make true |
| `value_hypothesis` | Why this direction should matter to the target user |
| `constraints` | Time, technical, operational, maintenance, or policy constraints that shape Direction |
| `non_goals` | What this direction explicitly does not pursue yet |
| `decision_rationale` | Why this direction was chosen over alternatives |
| `scope_boundary_seed` | Initial boundaries for the next Scope phase |

Recommended topics should be covered when useful:

- `risks`: uncertainties that could change the direction
- `assumptions_to_validate`: assumptions that need later validation
- `alternative_directions`: plausible options not chosen now

Topic statuses:

- `missing`: the topic has not been addressed enough to form a useful hypothesis.
- `tentative`: the agent has a hypothesis, including one derived from Discovery, but the user has not confirmed it in the current Direction dialogue.
- `confirmed`: the user explicitly confirmed the topic in the current Direction dialogue.
- `explicitly_deferred`: the user explicitly chose to defer the topic.

Do not use "Discovery says so" as the reason for `confirmed`. Discovery-backed statements are still `tentative` until the current Direction user confirms them.

## Direction Coverage

Every response must include a compact `Direction Coverage` section. Group required topics by status and include the next needed confirmation or question.

Example:

```text
Direction Coverage:
- confirmed: source_discovery
- tentative: project_identity, chosen_problem_angle, primary_user, success_criteria
- missing: constraints, non_goals, decision_rationale, scope_boundary_seed
- explicitly_deferred: none
```

Coverage is complete only when every required topic is `confirmed` or `explicitly_deferred`. If coverage is incomplete, continue the dialogue instead of emitting `direction.md`.

## Direction Flow

### First Response

1. Confirm that the Discovery artifact is the input being used.
2. Summarize only the Discovery-backed facts relevant to Direction and label them as `tentative`.
3. Identify the strongest candidate direction and label it as `tentative`.
4. List any Discovery gaps or deferred topics that could affect Direction.
5. Show Direction Coverage.
6. Ask focused confirmation questions before finalizing.

Example shape:

```text
Discovery Artifact を入力として確認しました。
現時点で Direction の仮説に使える Discovery 由来情報は以下です。まだこの Direction フェーズでは confirmed ではありません。

Tentative:
- primary_user: ...
- strongest_pain: ...
- dissatisfaction_with_alternatives: ...

Tentative Direction:
- project_identity: ...
- chosen_problem_angle: ...
- success_criteria: ...

Direction Coverage:
- confirmed: source_discovery
- tentative: project_identity, chosen_problem_angle, primary_user, success_criteria
- missing: value_hypothesis, constraints, non_goals, decision_rationale, scope_boundary_seed
- explicitly_deferred: none

確認したいこと:
1. この problem angle を最初に追う方針でよいですか？
2. non-goals として明示的に外したいものはありますか？
```

### Normal Response

1. Update `confirmed` only for topics the user explicitly confirmed in the current Direction dialogue.
2. Keep Discovery-derived or agent-proposed statements as `tentative` until confirmed.
3. Ask the smallest useful set of questions needed to resolve `missing` or `tentative` required topics.
4. Avoid expanding into feature scope, screens, architecture, implementation tasks, or estimates.
5. Show Direction Coverage in every response.

### Alternatives Response

When multiple directions are plausible, compare them by the Discovery-backed pain, target user, expected outcome, and risk:

```text
候補は3つあります。

A. ...
- Discovery evidence: ...
- Tradeoff: ...

B. ...
- Discovery evidence: ...
- Tradeoff: ...

C. ...
- Discovery evidence: ...
- Tradeoff: ...

最初の Direction としては A が最も Discovery に沿っています。
この方針で確定しますか？
```

## Artifact Output

Produce `direction.md` and `direction.coverage.json` only when:

- `discovery.md` and `discovery.coverage.json` were available and used;
- all required Direction topics are `confirmed` or `explicitly_deferred`;
- no unsupported agent hypothesis is presented as fact;
- the user gave permission to output the artifacts;
- the artifacts are still Direction-level and do not define Scope, Design, Plan, stack, or tasks.

Use this `direction.md` structure:

```markdown
# Direction Artifact

## Source Discovery

## Chosen Direction

## Primary User

## Success Criteria

## Value Hypothesis

## Constraints

## Decision Rationale

## Non-Goals

## Scope Boundary Seeds

## Success Signals

## Risks and Assumptions

## Alternative Directions Considered

## Deferred Topics

## Do Not Assume

## Ready for Scope
```

In `Do Not Assume`, list boundaries such as "MVP is not defined", "feature scope is not selected", "technology stack is not selected", and "implementation tasks are not created".

If the user asks to proceed to Scope, Design, or Plan before Direction coverage is complete and artifact output is permitted, explain the missing Direction topics and continue Direction questions.

### `direction.coverage.json`

The coverage report must include every required Direction topic and any recommended topic that was discussed. Use persisted statuses accepted by the repository coverage schema:

- `confirmed` for current-phase user-confirmed topics.
- `deferred` for dialogue `explicitly_deferred` topics; record each in `deferredTopics` with a reason.
- `candidate` for dialogue `tentative` topics before final readiness.
- `unknown` for missing topics before final readiness.
- `blocked` for unresolved blockers; every blocked topic must be listed in `blockingTopics`.

Before final output, `coverageReady` must be true only when all required persisted topics are `confirmed` or `deferred` and `blockingTopics` is empty. `userApprovedArtifactOutput` is true only after explicit user permission, and `readyForArtifact` must equal `coverageReady && userApprovedArtifactOutput`.

For schema compatibility, include at least the repository-required persisted topic keys: `source_discovery`, `chosen_problem_angle`, `first_target_user`, `desired_outcome`, `value_hypothesis`, `non_goals`, `decision_rationale`, and `scope_boundary_seed`. When the dialogue uses `primary_user`, store it as `first_target_user`; when it uses `success_criteria`, store it as `desired_outcome`. Include `project_identity`, `constraints`, and other discussed Direction topics as additional topic entries with evidence.

Canonical final coverage template:

```json
{
  "phase": "direction",
  "coverageScore": 8,
  "coverageMaxScore": 8,
  "coverageReady": true,
  "userApprovedArtifactOutput": true,
  "readyForArtifact": true,
  "topics": {
    "source_discovery": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "chosen_problem_angle": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "first_target_user": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "desired_outcome": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "value_hypothesis": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "non_goals": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "decision_rationale": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." },
    "scope_boundary_seed": { "status": "confirmed", "evidence": "Concrete current Direction user evidence." }
  },
  "blockingTopics": [],
  "deferredTopics": [],
  "validationWarnings": []
}
```

Do not add metadata keys outside the schema. Do not add ad hoc permission keys such as `artifactOutputPermissionEvidence`; if permission evidence is needed, put it in `direction.md` or in an existing schema-approved evidence field. Topic objects must use schema-approved fields such as `status` and `evidence`; do not copy model fields such as `required`, `weight`, or `description` into coverage topics. Do not use generic evidence such as `User confirmed`; cite or specifically summarize the user's current Direction answer. Keep required `##` sections in `direction.md`; do not make a required section appear empty by putting all content under nested headings.

### CLI Completion

After generating `direction.md` and `direction.coverage.json`, run:

```bash
solo-dev-orchestrator session submit-direction <session-name> --artifact direction.md --coverage direction.coverage.json --force
```

If LLM validation is expected, add `--llm`. Report Direction complete only after submit succeeds, or provide the exact command and error if the CLI cannot run.

## Readiness

Direction is ready for Scope when:

- the chosen problem angle is explicit;
- the primary user is clear enough for scoping;
- the success criteria are stated without jumping to a feature list;
- constraints, non-goals, and scope boundary seeds are documented or explicitly deferred;
- important Discovery gaps are either resolved, deferred, or listed as risks.

## Evaluation Materials

When improving this Skill, also review:

- `references/evaluation.md`
- `references/test-prompts.md`
