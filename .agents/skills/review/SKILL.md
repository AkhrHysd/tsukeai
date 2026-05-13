---
name: review
description: Use after Plan export and task execution. Compares Plan artifacts, exported tasks, and target repository implementation evidence, then produces review.md, review.coverage.json, and design-plan-revision-brief.md for the next Design/Plan cycle without directly rewriting Design or Plan artifacts.
---

# Solo Dev Review

## Purpose

Review closes one implementation loop and prepares the next Design/Plan loop.

Inputs:

- Plan artifacts from the session: `plan.md`, `plan.coverage.json`, and `intermediate-plan.json`.
- Exported task files and task status evidence.
- Target repository implementation evidence, especially `git status` and `git diff`.
- Optional user notes or execution logs.

Outputs:

- `review.md`: human-readable comparison of implementation evidence against Plan/Design expectations.
- `review.coverage.json`: Review coverage and artifact readiness.
- `design-plan-revision-brief.md`: a handoff brief for the next Design and Plan phases.

Review is not a revised Design or revised Plan. It identifies what the next Design/Plan cycle must revisit.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

Review-specific rules:

- Use Plan artifacts, task files, and repository evidence only to form Review hypotheses until the user confirms them in Review dialogue.
- Show updated Review coverage in every response using `missing`, `tentative`, `confirmed`, and `explicitly_deferred`.
- Do not output final Review artifacts until all required Review topics are `confirmed` or `explicitly_deferred` and the user explicitly permits artifact generation.
- Do not mark next Design or next Plan topics as confirmed. The revision brief seeds the next cycle; it does not replace Design/Plan dialogue.

## Required Topics

| Topic | Meaning |
| --- | --- |
| `implementation_evidence` | Which implementation evidence was reviewed, including repo diff/status and task evidence |
| `plan_task_alignment` | Where Plan/tasks matched or diverged from actual implementation |
| `design_assumption_gaps` | Design assumptions that proved wrong, vague, incomplete, or too shallow |
| `missing_plan_work` | Implementation steps that were absent, too coarse, or mis-sequenced in Plan |
| `implementation_learnings` | Technical, product, validation, or workflow lessons learned from execution |
| `next_design_topics` | Topics that must return to Design in the next cycle |
| `next_plan_requirements` | Work decomposition, validation, dependency, or task-granularity requirements for the next Plan |

## Review Method

1. Inventory evidence: Plan artifacts, exported tasks, task status, `git status`, `git diff`, and user-provided execution notes.
2. Compare intended work to actual implementation.
3. Separate implementation misses from planning misses and design misses.
4. Identify learning that changes future product, architecture, validation, workflow, or task-granularity decisions.
5. Produce a Design/Plan revision brief that routes findings to the next Design and Plan phases.

## Artifact Requirements

`review.md` must include:

- `Implementation Evidence`
- `Plan and Task Alignment`
- `Design Assumption Gaps`
- `Missing Plan Work`
- `Implementation Learnings`
- `Next Design Topics`
- `Next Plan Requirements`

`design-plan-revision-brief.md` must include:

- `Design Revision Topics`
- `Plan Revision Requirements`
- `Evidence Links`

The revision brief must be specific enough for the next Design phase to ask focused coverage questions and for the next Plan phase to avoid repeating missed implementation steps. It must not contain final revised Design or Plan artifacts.
