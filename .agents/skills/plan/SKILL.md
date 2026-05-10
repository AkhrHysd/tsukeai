---
name: plan
description: Use after Design is complete for a solo-development software idea. Reads the Design artifact and design.coverage.json as required inputs, produces plan.md, plan.coverage.json, and machine-readable intermediate-plan.json, and creates fine-grained task candidates for a later Plan Exporter without writing implementation code or generating tasks/*.yaml.
---

# Solo Dev Plan

## Purpose

Turn a completed Design Artifact into an implementation-ready planning artifact set. Use the Design artifact as the required architecture and boundary input and `design.coverage.json` as readiness and traceability context. Plan produces three outputs:

- `plan.md`: a human-readable plan for review, sequencing discussion, and scope validation.
- `plan.coverage.json`: a machine-readable coverage report for Plan readiness, user approval, and validation.
- `intermediate-plan.json`: a machine-readable intermediate plan containing fine-grained task candidates that a later Plan Exporter can translate into task files.

This Skill is a Markdown-centered Anthropic Skill package. `SKILL.md` is the authoritative Skill body. Do not treat JSON, generated prompts, CLI commands, external templates, or exported task YAML as the primary Plan Skill definition.

Plan does not implement code. Plan decomposes approved Design decisions into small candidate tasks, review focus, validation focus, path candidates, dependencies, and export readiness so the Plan Exporter can generate concrete implementation tasks later.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

**Plan-specific:**

- Use Design artifacts only to form tentative Plan hypotheses; they are not current-phase confirmation until the user confirms in Plan dialogue.
- Show updated Plan coverage in every response using `missing`, `tentative`, `confirmed`, and `explicitly_deferred`.
- Do not output `plan.md`, `plan.coverage.json`, or `intermediate-plan.json` in the first response (candidates and questions are allowed; not final artifacts).
- Do not output final Plan artifacts until all required Plan topics are `confirmed` or `explicitly_deferred` and the user explicitly permits artifact generation.

## Required Input

Before starting Plan, require the Design phase outputs:

- `design.md` is the primary input and source of truth.
- `design.coverage.json` is required supporting input for readiness, deferred topics, risks, and validation warnings.
- If the Design artifact is missing, incomplete, not ready for Plan, or contradicts `design.coverage.json`, stop and ask for the missing Design material or identify the specific contradiction.
- Do not invent Design facts. Any Plan statement not directly grounded in Design must be labeled as a hypothesis, assumption, or user decision candidate.

## Core Rules

- Respond in Japanese unless the user asks otherwise.
- Base every Plan decision on the Design artifact, `design.coverage.json`, existing project facts supplied by the user during the current Plan dialogue, or explicit user confirmation during the current Plan dialogue.
- Produce `plan.md`, `plan.coverage.json`, and `intermediate-plan.json` as the intended Plan outputs.
- Create fine-grained task candidates that are small enough for later export into implementation tasks.
- Each task candidate must include its purpose, target path candidates, Done conditions, and review or validation viewpoints.
- Before asking the user whether task candidates are fine-grained enough, provide a Decision Brief that defines implementation-ready granularity for this project and shows at least one example of a candidate that should be split.
- Keep Plan separate from implementation: do not write code, patches, schemas, migrations, tests, config changes, or repository edits as part of applying this Skill.
- Do not generate `tasks/*.yaml`, task files, exported task bundles, runner prompts, reviewer prompts, or `llm-task-orchestrator` execution configuration.
- Do not decide new product scope or reopen architecture unless Design explicitly marks a risk or unresolved question that blocks planning.
- Preserve Design boundaries. If a task candidate would require work outside the approved Design, mark it `blocked` or ask for a Design clarification.
- Do not produce final Plan outputs until the user has reviewed candidate decomposition and allowed artifact output.
- Do not add a Plan prompt generation command. Plan is managed as a standard Skill under `skills/plan/`.

## Plan Topics

Required topics must be confirmed or explicitly deferred before final output:

| Topic | Meaning |
| --- | --- |
| `source_design` | Which Design artifact and `design.coverage.json` were used and whether they are ready for Plan |
| `planning_boundary` | What Plan may decompose and what remains outside Plan |
| `milestones` | Coherent groupings of task candidates, based on Design responsibilities or delivery slices |
| `task_candidates` | Fine-grained work candidates with purpose, target path candidates, Done conditions, and review or validation viewpoints |
| `allowed_path_candidates` | Candidate files, directories, or globs each task may touch, with reason and source |
| `dependencies` | Ordering constraints between task candidates and why they exist |
| `acceptance_criteria` | Plan-level Done conditions mapped to one or more task candidates |
| `validation_focus` | Mechanical or behavioral checks a later task should preserve or add |
| `review_focus` | Human review viewpoints for correctness, boundary adherence, and risk |
| `export_readiness` | Whether candidates are ready for the Plan Exporter and what blocks export |
| `do_not_cross` | Boundary that prevents Plan from becoming implementation or task export |

Recommended topics should be covered when useful:

- `risk_notes`: planning risks inherited from Design risks
- `manual_steps`: human decisions or manual checks needed before export
- `deferred_candidates`: plausible work intentionally not exported now
- `path_uncertainty`: path candidates that need repository inspection or user confirmation later

Coverage statuses:

- `missing`: not addressed enough to form a useful Plan hypothesis.
- `tentative`: proposed by the agent, including anything inferred from Design artifacts or existing project facts, but not confirmed by the user in this Plan dialogue.
- `confirmed`: directly confirmed by the user in this Plan dialogue.
- `explicitly_deferred`: explicitly postponed by the user in this Plan dialogue.

Do not use previous Design confirmation as Plan confirmation. If the persisted coverage schema requires `deferred`, map `explicitly_deferred` to that storage value only when saving or importing; in dialogue, show `explicitly_deferred`.

## Task Candidate Granularity

Task candidates are the core product of Plan. They must be fine-grained enough that a later Plan Exporter can create focused implementation tasks without re-planning.

Each task candidate must include:

- `id`: stable identifier suitable for `intermediate-plan.json`.
- `title`: short action-oriented name.
- `purpose`: why this work exists and which Design decision it serves.
- `description`: what should change at a behavioral or artifact level, without writing implementation code.
- `target_path_candidates`: candidate files, directories, or globs that may be touched later, each with a reason and source.
- `done_conditions`: observable completion conditions for the later implementation task.
- `validation_viewpoints`: tests, commands, checks, or behavior areas a later implementer should validate.
- `review_viewpoints`: human review concerns, such as boundary adherence, migration risk, compatibility, or user-facing behavior.
- `dependencies`: other task candidates that should happen first, if any.
- `status`: `candidate`, `needs-refinement`, `ready`, or `blocked`.
- `export_notes`: optional notes for the Plan Exporter.

Granularity rules:

- Prefer one coherent behavior, artifact, boundary, or integration concern per task candidate.
- A candidate is too coarse when it spans multiple independently reviewable contracts, requires unrelated path groups, bundles setup plus behavior plus documentation, or would likely become more than one implementation PR.
- Split candidates when they would require unrelated paths, unrelated validation, or independent review concerns.
- Split candidates for distinct contracts such as CLI command surface, config model, generated artifact shape, runtime integration, validation behavior, reporting, sample fixtures, and documentation when those concerns can be implemented or reviewed independently.
- Merge candidates when separation would create artificial sequencing without independent value.
- Keep candidates implementation-ready but not implementation-specific. Name likely target paths when known, but do not write exact diffs, code snippets, test bodies, schemas, or command implementations.
- Mark a candidate `blocked` when its purpose, target paths, Done conditions, or validation viewpoint cannot be derived from Design or current-phase user-confirmed project facts.

## Plan Exporter Boundary

Plan creates `intermediate-plan.json`; the Plan Exporter consumes it.

Plan is responsible for:

- decomposing Design into fine-grained task candidates;
- identifying allowed path candidates and why they are plausible;
- describing Done conditions as acceptance criteria;
- describing validation and review focus;
- describing dependencies and export readiness;
- marking candidates as ready, needing refinement, or blocked.

The Plan Exporter is responsible for:

- converting ready task candidates into concrete exported implementation tasks;
- choosing the final `tasks/*.yaml` file names and task IDs;
- formatting task YAML;
- carrying allowed paths, acceptance criteria, and review focus into the exported task format;
- excluding or reporting blocked candidates;
- preserving traceability back to `intermediate-plan.json`.

Plan must not directly create, edit, or preview `tasks/*.yaml`. If the user asks for task YAML during Plan, explain that the Plan Exporter owns that step and keep the output at the `intermediate-plan.json` level.

## Intermediate Plan JSON

`intermediate-plan.json` must be valid JSON and should follow the repository's intermediate plan model when available. Use these top-level fields:

- `schemaVersion`: use `intermediate-plan/v1`.
- `metadata`: includes plan identity, title, `sourcePhase: "planning"`, source artifact references, and relevant constraints.
- `milestones`: groups of related task candidates.
- `taskCandidates`: fine-grained candidate tasks.
- `taskDependencies`: explicit dependencies between candidates.
- `allowedPathCandidates`: candidate file, directory, or glob targets.
- `acceptanceCriteria`: Done conditions linked to candidates.
- `validationFocus`: validation viewpoints linked to candidates or acceptance criteria.
- `reviewFocus`: human review viewpoints linked to candidates or acceptance criteria.
- `exportReadiness`: readiness status, ready candidates, blocked candidates, blockers, and notes.

Allowed path candidates may use `kind: "glob"` in the intermediate plan only when the local schema supports it. Exported task runners may not interpret glob syntax. When planning for `llm-task-orchestrator`, prefer directory prefix paths such as `docs/patterns` over `docs/patterns/**` whenever the later task may create the directory itself or edit arbitrary files below it.

When the local schema is available, align field names and allowed values with it. Do not add implementation code to make the JSON pass validation; adjust the artifact content instead.

## Plan Flow

### First Response

1. Confirm that `design.md` and `design.coverage.json` are the inputs being used.
2. Summarize Design-backed facts relevant to Plan as tentative unless the user confirms them in this Plan dialogue.
3. Identify candidate milestones and the first set of task candidates.
4. Call out Design gaps, deferred Design topics, or coverage warnings that affect task candidate readiness.
5. Ask focused confirmation questions before finalizing.
6. Show Plan Coverage with every required topic marked `missing`, `tentative`, `confirmed`, or `explicitly_deferred`.

Never produce final `plan.md`, `plan.coverage.json`, or `intermediate-plan.json` in the first response, even if the Design artifact looks complete.

Example shape:

```text
Design Artifact と design.coverage.json を入力として確認しました。
現時点で Plan に使える前フェーズ由来の仮説は以下です。

Tentative:
- architecture_policy: ...
- core_concepts: ...
- storage_model: ...
- integration_boundaries: ...
- do_not_cross: ...

Candidate Milestones:
- ...

Candidate Task Candidates:
- id: ...
  purpose: ...
  target_path_candidates: ...
  done_conditions: ...
  validation_viewpoints: ...
  review_viewpoints: ...

確認したいこと:
1. この分解粒度は Plan Exporter に渡す前提として十分に細かいですか？
2. blocked 扱いにすべき Design 未解決点はありますか？

Plan Coverage:
- source_design: tentative
- planning_boundary: tentative
- milestones: tentative
- task_candidates: tentative
- allowed_path_candidates: tentative
- dependencies: tentative
- acceptance_criteria: tentative
- validation_focus: tentative
- review_focus: tentative
- export_readiness: missing
- do_not_cross: tentative
```

### Normal Response

1. Update coverage every response.
2. Mark topics `confirmed` only when the latest or earlier current-phase user answer directly confirms them.
3. Keep tentative statements separate from confirmed plan decisions.
4. Preserve the boundary between task candidates and exported implementation tasks.
5. Ask the smallest useful set of questions needed to resolve missing, tentative, or `needs-refinement` candidates.
6. Avoid code, patches, exact YAML output, implementation sequences beyond dependencies, or repository edits.

### Design Gap Response

When planning exposes an unresolved Design decision:

```text
この候補は Design の未確定事項に依存しています。

Blocked candidate:
- id: ...
- blocked_by: ...
- required_design_decision: ...

Plan ではこの候補を blocked として残し、Design の判断が確定するまで ready にはしません。
```

### Export Pressure Response

When the user asks for `tasks/*.yaml` or direct export during Plan:

```text
それは Plan Exporter の責務です。
Plan Skill では、Exporter に渡すために次を確定します。

- task candidate: ...
- allowed path candidates: ...
- Done conditions: ...
- validation focus: ...
- review focus: ...
- export readiness: ...
```

### Implementation Pressure Response

When the user asks for code, diffs, patches, migrations, tests, or repository edits during Plan:

```text
それは実装フェーズの作業です。
Plan では、後続タスクが実装時に満たすべき条件だけを定義します。

- purpose: ...
- target path candidates: ...
- done conditions: ...
- validation viewpoints: ...
- review viewpoints: ...
```

## Artifact Output

Produce `plan.md`, `plan.coverage.json`, and `intermediate-plan.json` only when:

- `design.md` and `design.coverage.json` were available and used;
- all required Plan topics are `confirmed` or `explicitly_deferred`;
- every task candidate has purpose, target path candidates, Done conditions, and review or validation viewpoints;
- blocked candidates are clearly marked and excluded from ready export lists;
- no unsupported agent hypothesis is presented as fact;
- the user gave permission to output the artifacts;
- the artifacts are still Plan-level and do not include implementation code, repository edits, exact task YAML, exported task files, runner prompts, or reviewer prompts.

Use this `plan.md` structure:

```markdown
# Plan Artifact

## Source Design

## Planning Boundary

## Milestones

## Task Candidates

## Dependencies

## Acceptance Criteria

## Validation Focus

## Review Focus

## Export Readiness

## Risks and Blockers

## Do Not Cross
```

Use `Do Not Cross` to state that Plan does not write implementation code, does not edit repository files, does not generate `tasks/*.yaml`, and does not replace the Plan Exporter.

### `plan.coverage.json`

The coverage report must include every required Plan topic and any recommended topic that was discussed. The persisted `phase` value is `planning`. Use persisted statuses accepted by the repository coverage schema:

- `confirmed` for current-phase user-confirmed topics.
- `deferred` for dialogue `explicitly_deferred` topics; record each in `deferredTopics` with a reason.
- `candidate` for dialogue `tentative` topics before final readiness.
- `unknown` for missing topics before final readiness.
- `blocked` for unresolved blockers; every blocked topic must be listed in `blockingTopics`.

Before final output, `coverageReady` must be true only when all required topics are `confirmed` or `deferred` and `blockingTopics` is empty. `userApprovedArtifactOutput` is true only after explicit user permission, and `readyForArtifact` must equal `coverageReady && userApprovedArtifactOutput`.

Canonical final coverage template:

```json
{
  "phase": "planning",
  "coverageScore": 11,
  "coverageMaxScore": 11,
  "coverageReady": true,
  "userApprovedArtifactOutput": true,
  "readyForArtifact": true,
  "topics": {
    "source_design": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "planning_boundary": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "milestones": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "task_candidates": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "allowed_path_candidates": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "dependencies": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "acceptance_criteria": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "validation_focus": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "review_focus": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "export_readiness": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." },
    "do_not_cross": { "status": "confirmed", "evidence": "Concrete current Plan user evidence." }
  },
  "blockingTopics": [],
  "deferredTopics": [],
  "validationWarnings": []
}
```

Canonical `intermediate-plan.json` shape:

```json
{
  "schemaVersion": "intermediate-plan/v1",
  "metadata": {
    "planId": "stable-plan-id",
    "title": "Plan title",
    "sourcePhase": "planning",
    "sourceArtifacts": ["design.md", "design.coverage.json"]
  },
  "milestones": [{ "id": "milestone-id", "title": "Milestone title", "taskCandidateIds": ["task-id"] }],
  "taskCandidates": [{
    "id": "task-id",
    "title": "Task title",
    "description": "Purpose, change boundary, and Done conditions in one line.",
    "milestoneId": "milestone-id",
    "status": "ready",
    "allowedPathCandidateIds": ["allowed-path-id"],
    "acceptanceCriteriaIds": ["criterion-id"],
    "validationFocusIds": ["validation-id"],
    "reviewFocusIds": ["review-id"]
  }],
  "taskDependencies": [],
  "allowedPathCandidates": [{ "id": "allowed-path-id", "path": "docs/example", "kind": "directory", "source": "plan" }],
  "acceptanceCriteria": [{ "id": "criterion-id", "description": "Observable Done condition.", "source": "plan", "taskCandidateIds": ["task-id"] }],
  "validationFocus": [{ "id": "validation-id", "description": "Validation focus.", "taskCandidateIds": ["task-id"] }],
  "reviewFocus": [{ "id": "review-id", "description": "Review focus.", "taskCandidateIds": ["task-id"] }],
  "exportReadiness": { "status": "ready", "readyTaskCandidateIds": ["task-id"], "blockedTaskCandidateIds": [], "blockers": [] }
}
```

Do not add metadata keys outside the schema. Do not add ad hoc permission keys such as `artifactOutputPermissionEvidence`; if permission evidence is needed, put it in `plan.md` or in an existing schema-approved evidence field. Topic objects must use schema-approved fields such as `status` and `evidence`; do not copy model fields such as `required`, `weight`, or `description` into coverage topics. Use `phase: "planning"`, not `plan`. Do not use generic evidence such as `User confirmed`. Use directory prefix paths such as `docs/patterns` for `llm-task-orchestrator` compatibility when a later task may create the directory itself.

### CLI Completion

After generating `plan.md`, `plan.coverage.json`, and `intermediate-plan.json`, run:

```bash
solo-dev-orchestrator session submit-plan <session-name> --artifact plan.md --coverage plan.coverage.json --intermediate-plan intermediate-plan.json --force
```

If LLM validation is expected, add `--llm`. Report Plan complete only after submit succeeds, or provide the exact command and error if the CLI cannot run.

## Readiness

Plan is ready for the Plan Exporter when:

- `plan.md` explains the human-readable plan and boundaries;
- `intermediate-plan.json` is machine-readable and schema-aligned;
- every ready task candidate is fine-grained and has purpose, target path candidates, Done conditions, validation focus, and review focus;
- task dependencies are explicit and justified;
- blocked or uncertain candidates are not marked ready;
- export readiness is `ready` or clearly explains why export is blocked;
- no implementation work, code, diffs, task YAML, or exporter behavior has been smuggled into the Plan artifacts.


## Evaluation Materials

When improving this Skill, also review:

- `references/evaluation.md`
- `references/test-prompts.md`
