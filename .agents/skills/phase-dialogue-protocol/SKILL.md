---
name: phase-dialogue-protocol
description: Shared foundation for all solo-dev-orchestrator phase Skills (Discovery, Direction, Scope, Design, Plan). Defines coverage-driven dialogue, required topic statuses, artifact gating, and response pattern. Install next to phase Skills so CLI and agents without repository AGENTS.md still receive the common protocol.
---

# Phase Dialogue Protocol (standard Skill)

This Skill is the **canonical machine-readable definition** of the phase dialogue rules also summarized for repository contributors in the root `AGENTS.md`. Target projects copy standard Skills from `solo-dev-orchestrator` into `.agents/skills/`; **always co-install `phase-dialogue-protocol`** with any phase Skill so runners that only load Skills (not the repo root) still enforce the same protocol.

No phase is an artifact generator only: every phase agent is a **coverage-driven dialogue agent**.

An agent may propose hypotheses from previous-phase artifacts, but **must not** mark required topics `confirmed` without direct user confirmation in the **current** phase dialogue.

Each phase updates coverage incrementally. After required topics are `confirmed` or `explicitly_deferred`, the agent **must obtain explicit user permission** before emitting the final phase artifact.

## Applicable phases

The same protocol applies to **Discovery, Direction, Scope, Design, and Plan**. Each phase Skill adds only phase-specific topics, inputs, boundaries, and artifact names.

**Discovery note:** Discovery uses extra statuses (`unknown`, `partial`, `blocked`) and often persists `deferred` where dialogue uses `explicitly_deferred`; follow that phase Skill and `coverage.model.json`. The principles below still apply.

## Core principles

- Drive dialogue until phase coverage is sufficient for that phase Skill.
- Use prior-phase artifacts only to propose hypotheses; any such inference stays **`tentative`** until confirmed in the **current** phase.
- Never mark a required topic **`confirmed`** without direct user confirmation in the **current** phase dialogue.
- Do not use a fixed minimum number of dialogue rounds. Continue until every required topic has concrete current-phase user evidence or is explicitly deferred.
- Short approvals such as `OK`, `yes`, or `お願いします` confirm only the specific topics or options that the agent explicitly listed immediately before the approval. Do not use broad approval to confirm unstated or bundled topics.
- Before asking the user to confirm a meaningful choice, provide a compact **Decision Brief** so the user can learn enough to judge. This is required for technology, architecture, scope cuts, planning granularity, validation strategy, alternatives, or any topic where a `yes/no` answer would otherwise be uninformed.
- Mark **`explicitly_deferred`** only when the user explicitly chooses to defer that topic.
- Show updated coverage in **every** response so required topics are visible as confirmed, tentative, missing, or explicitly deferred (or that phase’s equivalent vocabulary). Include counts such as `Coverage: 6/10 confirmed, 2 tentative, 2 missing, 0 explicitly_deferred`.
- Do **not** emit the final phase artifact until **every** required topic is `confirmed` or `explicitly_deferred` (or `deferred` where that phase allows it per its Skill).
- Do **not** emit the final phase artifact without **explicit user permission**, even when coverage is complete.
- Before requesting permission to output final artifacts, show a `Final Coverage Review` listing every required topic, its status, and the concrete user evidence or explicit deferral evidence.
- Ask for artifact output permission as a separate explicit question after the `Final Coverage Review`. Do not treat prior topic confirmation, "OK" to a summary, or "continue" as artifact-output permission unless the immediately preceding question explicitly asked to output the final artifacts.
- Record artifact-output permission evidence in the artifact, or in coverage only through fields that the phase schema explicitly allows. Never add ad hoc coverage JSON keys such as `artifactOutputPermissionEvidence`. A bare flag such as `userApprovedArtifactOutput: true` is not enough without visible evidence of the user's permission.
- Keep required topics and non-required topics separate in coverage and readiness. Recommended, optional, learning, context, or nice-to-have topics may be tracked, but they must not block `coverageReady` unless the phase Skill marks them required or the user explicitly turns them into blockers. Do not say "all topics are confirmed" when only required topics are ready; say "all required topics are confirmed or explicitly deferred."
- After writing final artifacts, run the phase CLI validation/import flow when the CLI is available. Prefer `solo-dev-orchestrator session submit-<phase> ...` because it performs preflight validation, import, and session validation together. Report completion only after the command succeeds, or report the exact command/error the user must run when the CLI cannot be executed.

## Required topic status meanings

Use consistently across phases (storage may map synonyms, e.g. `explicitly_deferred` → `deferred` in JSON):

| Status | Meaning |
| --- | --- |
| `missing` | Not enough to form a useful hypothesis yet. |
| `tentative` | Agent hypothesis, including from a prior artifact; **not** confirmed in this phase. |
| `confirmed` | User explicitly confirmed in **this** phase dialogue, with concrete evidence recorded in coverage. |
| `explicitly_deferred` | User explicitly chose to defer in **this** phase dialogue. |

Previous-phase artifacts are **context**, not confirmation. They reduce re-explanation; they do **not** silently satisfy current-phase required topics.

## Response pattern

Every phase response should:

1. State the current hypothesis or question.
2. Separate confirmed facts from tentative inferences.
3. Provide a Decision Brief before non-trivial confirmations:
   - `meaning`: what the topic decides;
   - `why_it_matters`: what later phase, implementation, operation, or user value it affects;
   - `options`: common options or the proposed default;
   - `tradeoffs`: benefits, costs, risks, and what each option postpones;
   - `recommendation`: the agent's tentative recommendation and why, clearly labeled as tentative.
4. Ask for user confirmation or the missing information needed next.
5. Show updated coverage for required topics.
6. Wait for explicit permission before emitting the **final** artifact.

Final artifact is allowed only when **both** hold:

1. All required topics are `confirmed` or `explicitly_deferred` (or phase-specific equivalent per that Skill).
2. The user explicitly permits final artifact generation after seeing final coverage readiness.

When storing coverage, keep these concepts distinct:

- `coverageReady`: readiness of required topics only.
- `userApprovedArtifactOutput`: explicit permission to emit final artifacts.
- `readyForArtifact`: the conjunction of coverage readiness and output permission.

If a phase uses these flags, never set `userApprovedArtifactOutput` from inference. Preserve the user statement that granted permission in the artifact or in an existing schema-approved evidence field. Coverage JSON schemas are strict; do not invent new metadata keys.

Coverage topic objects are also schema-bound. Do not copy planning/model fields
such as `required`, `weight`, `description`, `label`, or `notes` into persisted
coverage topic entries unless the phase schema explicitly allows them. In the
standard phase coverage schemas, topic entries are generally limited to
schema-approved status/evidence fields.

Final phase completion is allowed only when the artifact files exist and either:

1. `solo-dev-orchestrator session submit-<phase>` succeeded, including LLM validation when requested or configured; or
2. the agent clearly reports that CLI validation/import could not be run and provides the exact follow-up command.

## Learning and Primary Sources

For solo-development products, learning and skill acquisition may be part of the user's implicit goal. When a phase includes technology choices, standards, accessibility, testing, or operational tradeoffs:

- Prefer primary sources such as official documentation, standards, specifications, or project-owned docs.
- Briefly explain decision criteria and tradeoffs before asking the user to choose. Do not reduce meaningful decisions to unexplained `YES/NO` prompts.
- Attach learning support to the dialogue, not only to final artifacts. If the user must choose among alternatives, first explain the concepts in enough depth for the user to make an informed choice.
- For Direction and Scope, explain alternatives and cuts at the product-decision level. For Design, explain architecture and technology boundaries at the policy level. For Plan, explain what "implementation-ready granularity" means before asking whether task candidates are fine-grained enough.
- Keep long educational notes out of the main artifact body; place them in `decision_rationale`, `learning_notes`, or `references` when the phase artifact supports those sections.
- Treat current or version-sensitive technical facts as unstable and verify them before relying on them.

## Relationship to phase Skills

Phase Skills (e.g. `scope`, `design`) **must** remain consistent with this Skill. They add:

- Required inputs and artifact paths (`scope.md`, `design.md`, etc.).
- Phase-specific required topic tables and “do not cross” boundaries.
- First-response rules (e.g. do not output `design.md` in the first turn).

If a phase Skill ever conflicts with this Skill, **reconcile by updating the phase Skill**; this Skill holds the shared dialogue contract.
