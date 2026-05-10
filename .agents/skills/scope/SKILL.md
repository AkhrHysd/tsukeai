---
name: scope
description: Use after Direction is complete for a solo-development software idea. Reads the Direction artifact and direction.coverage.json as required inputs, separates initial MVP Scope from Deferred Scope and Rejected work, and documents scope cuts, reasons, and expansion risks without moving into Design or Plan.
---

# Solo Dev Scope

## Purpose

Turn a completed Direction Artifact into a clear Scope Artifact for the initial MVP. Use the Direction artifact as the required product decision input and `direction.coverage.json` as readiness and traceability context. Scope decides what belongs in the first MVP, what is deferred, what is rejected, and why those cuts protect the chosen direction.

This Skill is a Markdown-centered Anthropic Skill package. `SKILL.md` is the authoritative Skill body. Do not treat JSON, generated prompts, CLI commands, or external templates as the primary Scope Skill definition.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

**Scope-specific:**

- Use Direction artifacts only to form tentative Scope hypotheses; they are not current-phase confirmation until the user confirms in Scope dialogue.
- Show updated Scope coverage in every response using `missing`, `tentative`, `confirmed`, and `explicitly_deferred`.
- Do not output `scope.md` in the first response (candidate scope and questions are allowed; not the final artifact).
- Do not output the final Scope artifacts until all required Scope topics are `confirmed` or `explicitly_deferred` and the user explicitly permits artifact generation.

## Required Input

Before starting Scope, require the Direction phase outputs:

- `direction.md` is the primary input and source of truth.
- `direction.coverage.json` is required supporting input for readiness, deferred topics, and validation warnings.
- If the Direction artifact is missing, incomplete, not ready for Scope, or contradicts `direction.coverage.json`, stop and ask for the missing Direction material or identify the specific contradiction.
- Do not invent Direction facts. Any Scope statement not directly grounded in Direction must be labeled as a hypothesis, assumption, or user decision candidate.

## Core Rules

- Respond in Japanese unless the user asks otherwise.
- Base every Scope decision on the Direction artifact, `direction.coverage.json`, or explicit user confirmation during the current Scope dialogue.
- Keep Scope separate from Design, Plan, implementation tasks, repository structure, technology stack, estimates, screens, data models, APIs, and detailed UX flows.
- Define the initial MVP by outcome and capability boundaries, not by UI design or engineering task breakdown.
- Clearly separate `MVP Scope`, `Deferred Scope`, and `Rejected`.
- Explain every meaningful cut with the reason it is not in the initial MVP.
- Before asking the user to confirm MVP / Deferred / Rejected buckets, provide a compact Decision Brief that teaches the cut criteria: what is required for the first outcome, what can wait, what should be rejected, and what risk appears if the item is pulled into the MVP now.
- Do not ask whether a candidate MVP scope is "OK" until the user has seen the cut rationale, the tradeoff, and at least one plausible alternative boundary when alternatives exist.
- Identify scope expansion risks and the trigger that would cause them.
- Do not produce final Scope artifacts until the user has reviewed the candidate scope and allowed artifact output.
- Do not add a Scope prompt generation command. Scope is managed as a standard Skill under `skills/scope/`.

## MoSCoW Handling

Use Must, Should, Could, and Won't only for scope classification, not for implementation sequencing:

| Class | Meaning in Scope |
| --- | --- |
| `Must` | Required for the initial MVP to deliver the Direction's chosen outcome to the first target user. Must items belong in `MVP Scope` unless they are blocked by a documented contradiction. |
| `Should` | Valuable and direction-aligned, but not required for the first MVP outcome. Should items normally belong in `Deferred Scope` unless the user explicitly narrows the MVP further. |
| `Could` | Optional enhancement, experiment, or convenience that may support later versions. Could items belong in `Deferred Scope` with a low urgency unless they should be rejected. |
| `Won't` | Out of scope for this direction or intentionally not pursued. Won't items belong in `Rejected`, not `Deferred Scope`, unless the user explicitly wants future reevaluation. |

Do not use MoSCoW to smuggle Design or Plan content into Scope. For example, "Must have OAuth with provider X", "Should use React", or "Could add a database table" is too implementation-specific unless Direction explicitly made that constraint part of the product boundary.

## Scope Buckets

### MVP Scope

MVP Scope contains only the smallest coherent capability set needed to test or deliver the Direction's desired outcome for the first target user.

Each MVP item must include:

- `classification`: usually `Must`; occasionally a deliberately included `Should` with a reason.
- `direction_link`: the Direction topic or statement it supports.
- `user_value`: what the target user can accomplish.
- `boundary`: what this item includes and what it explicitly does not include.
- `acceptance_signal`: observable evidence that the scope item is present at a product level, without defining tests or tasks.

### Deferred Scope

Deferred Scope contains direction-aligned work that is intentionally not part of the initial MVP.

Each Deferred item must include:

- `classification`: usually `Should` or `Could`.
- `why_not_now`: the reason it is not in the initial MVP, such as unclear value, lower urgency, higher build cost, dependency on validation, or risk of distracting from the chosen outcome.
- `reevaluation_condition`: the concrete condition that would justify reconsidering it, such as user feedback, repeated manual workaround, validated demand, MVP success signal, or a constraint changing.
- `direction_link`: the Direction statement it may support later.
- `risk_if_pulled_in_now`: the likely scope expansion or focus risk if included immediately.

### Rejected

Rejected contains work that should not be pursued for this Direction.

Each Rejected item must include:

- `classification`: usually `Won't`.
- `reason`: why it conflicts with the Direction, first target user, MVP boundary, constraints, or non-goals.
- `source`: whether it came from Direction non-goals, an alternative direction, user confirmation, or an agent hypothesis that the user rejected.
- `reopen_rule`: normally `do_not_reopen_without_new_direction`; use a narrower rule only when the user explicitly wants a future exception.

Rejected is not a parking lot. If the item is direction-aligned and may be useful later, place it in Deferred Scope instead.

## Scope Topics

Required topics must be confirmed or explicitly deferred before final output:

| Topic | Meaning |
| --- | --- |
| `source_direction` | Which Direction artifact and `direction.coverage.json` were used and whether they are ready for Scope |
| `mvp_outcome` | The outcome the first MVP must deliver, grounded in Direction |
| `first_target_user` | The user segment or concrete user context inherited from Direction |
| `mvp_scope` | Must-level capability boundaries included in the initial MVP |
| `deferred_scope` | Direction-aligned Should/Could work postponed with reasons and reevaluation conditions |
| `rejected` | Won't items or out-of-direction work not pursued |
| `cut_rationale` | Why the boundary is smaller than plausible alternatives |
| `scope_expansion_risks` | Risks that could cause MVP scope to grow and how to recognize them |
| `do_not_cross` | Boundary that prevents Scope from becoming Design or Plan |

Recommended topics should be covered when useful:

- `assumptions`: scope assumptions that need later validation
- `dependencies`: external or user-side prerequisites that affect scope boundaries
- `success_signal`: observable sign that MVP Scope is enough
- `manual_or_low_fidelity_paths`: temporary non-scalable paths acceptable for MVP Scope
- `future_review_points`: when Deferred Scope should be reviewed

Coverage statuses:

- `missing`: not addressed enough to form a useful Scope hypothesis.
- `tentative`: proposed by the agent, including anything inferred from Direction artifacts, but not confirmed by the user in this Scope dialogue.
- `confirmed`: directly confirmed by the user in this Scope dialogue.
- `explicitly_deferred`: explicitly postponed by the user in this Scope dialogue.

Do not use previous Direction confirmation as Scope confirmation. If the persisted coverage schema requires `deferred`, map `explicitly_deferred` to that storage value only when saving or importing; in dialogue, show `explicitly_deferred`.

## Scope Flow

### First Response

1. Confirm that `direction.md` and `direction.coverage.json` are the inputs being used.
2. Summarize Direction-backed facts relevant to Scope as tentative unless the user confirms them in this Scope dialogue.
3. Identify the smallest plausible MVP Scope as tentative.
4. Separate candidate Deferred Scope and Rejected items.
5. Call out any Direction gaps, deferred Direction topics, or warnings that affect scoping.
6. Ask focused confirmation questions before finalizing.
7. Show Scope Coverage with every required topic marked `missing`, `tentative`, `confirmed`, or `explicitly_deferred`.

Never produce the final `scope.md` in the first response, even if the Direction artifact looks complete.

Example shape:

```text
Direction Artifact と direction.coverage.json を入力として確認しました。
現時点で Scope に使える前フェーズ由来の仮説は以下です。

Tentative:
- first_target_user: ...
- desired_outcome: ...
- non_goals: ...
- scope_boundary_seed: ...

Candidate MVP Scope:
- Must: ...

Candidate Deferred Scope:
- Should: ...
  why_not_now: ...
  reevaluation_condition: ...

Candidate Rejected:
- Won't: ...

確認したいこと:
1. この Must だけで初期MVPの outcome を確認できますか？
2. Deferred に回すべき Should/Could はほかにありますか？

Scope Coverage:
- source_direction: tentative
- mvp_outcome: tentative
- first_target_user: tentative
- mvp_scope: tentative
- deferred_scope: tentative
- rejected: tentative
- cut_rationale: tentative
- scope_expansion_risks: missing
- do_not_cross: tentative
```

### Normal Response

1. Update coverage every response.
2. Mark topics `confirmed` only when the latest or earlier current-phase user answer directly confirms them.
3. Keep tentative statements separate from confirmed scope decisions.
4. Preserve the separation between MVP Scope, Deferred Scope, and Rejected.
5. Ask the smallest useful set of questions needed to resolve missing or tentative topics.
6. Avoid expanding into screens, flows, architecture, tasks, ticket lists, estimates, or implementation order.

### Scope Pressure Response

When the user proposes adding work to MVP Scope, classify it before accepting it:

```text
その追加は Direction には沿っていますが、初期MVPの desired_outcome には必須ではありません。

Recommendation:
- classification: Should
- bucket: Deferred Scope
- why_not_now: ...
- reevaluation_condition: ...
- risk_if_pulled_in_now: ...

それでも Must として入れる場合、MVP Scope から何を削りますか？
```

## Artifact Output

Produce `scope.md` and `scope.coverage.json` only when:

- `direction.md` and `direction.coverage.json` were available and used;
- all required Scope topics are `confirmed` or `explicitly_deferred`;
- no unsupported agent hypothesis is presented as fact;
- MVP Scope, Deferred Scope, and Rejected are clearly separated;
- every Deferred Scope item has `why_not_now` and `reevaluation_condition`;
- the user gave permission to output the artifacts;
- the artifacts are still Scope-level and do not define Design, Plan, stack, tasks, or implementation details.

Use this `scope.md` structure:

```markdown
# Scope Artifact

## Source Direction

## MVP Outcome

## First Target User

## MVP Scope

## Deferred Scope

## Rejected

## Cut Rationale

## Scope Expansion Risks

## Assumptions and Dependencies

## Success Signals

## Do Not Cross

## Ready for Design
```

In `Do Not Cross`, list boundaries such as "screen design is not defined", "technical architecture is not selected", "implementation tasks are not created", "estimates are not produced", and "Plan has not started".

`Ready for Design` means the MVP boundary is clear enough for a later Design phase. It does not authorize the Scope Skill to create Design output.

### `scope.coverage.json`

The coverage report must include every required Scope topic and any recommended topic that was discussed. Use persisted statuses accepted by the repository coverage schema:

- `confirmed` for current-phase user-confirmed topics.
- `deferred` for dialogue `explicitly_deferred` topics; record each in `deferredTopics` with `reason` and `reevaluationCondition`.
- `candidate` for dialogue `tentative` topics before final readiness.
- `unknown` for missing topics before final readiness.
- `blocked` for unresolved blockers; every blocked topic must be listed in `blockingTopics`.

Before final output, `coverageReady` must be true only when all required topics are `confirmed` or `deferred` and `blockingTopics` is empty. `userApprovedArtifactOutput` is true only after explicit user permission, and `readyForArtifact` must equal `coverageReady && userApprovedArtifactOutput`.

Canonical final coverage template:

```json
{
  "phase": "scope",
  "coverageScore": 9,
  "coverageMaxScore": 9,
  "coverageReady": true,
  "userApprovedArtifactOutput": true,
  "readyForArtifact": true,
  "topics": {
    "source_direction": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "mvp_outcome": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "first_target_user": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "mvp_scope": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "deferred_scope": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "rejected": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "cut_rationale": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "scope_expansion_risks": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." },
    "do_not_cross": { "status": "confirmed", "evidence": "Concrete current Scope user evidence." }
  },
  "blockingTopics": [],
  "deferredTopics": [],
  "validationWarnings": []
}
```

Do not add metadata keys outside the schema. Do not add ad hoc permission keys such as `artifactOutputPermissionEvidence`; if permission evidence is needed, put it in `scope.md` or in an existing schema-approved evidence field. Topic objects must use schema-approved fields such as `status` and `evidence`; do not copy model fields such as `required`, `weight`, or `description` into coverage topics. `deferredTopics` is for coverage topics with `status: "deferred"`; it is not the Deferred Scope backlog list. Do not use generic evidence such as `User confirmed`. Keep required `##` sections non-empty directly under the section heading.

### CLI Completion

After generating `scope.md` and `scope.coverage.json`, run:

```bash
solo-dev-orchestrator session submit-scope <session-name> --artifact scope.md --coverage scope.coverage.json --force
```

If LLM validation is expected, add `--llm`. Report Scope complete only after submit succeeds, or provide the exact command and error if the CLI cannot run.

## Readiness

Scope is ready for Design when:

- the MVP outcome is explicit and grounded in Direction;
- MVP Scope contains only Must-level boundaries needed for the first target user;
- Deferred Scope records why each item is not done now and when to reevaluate it;
- Rejected items are not mixed with future possibilities;
- scope expansion risks are documented;
- no Design or Plan details are required to understand the product boundary.


## Evaluation Materials

When improving this Skill, also review:

- `references/evaluation.md`
- `references/test-prompts.md`
