---
name: design
description: Use after Scope is complete for a solo-development software idea. Reads the Scope artifact and scope.coverage.json as required inputs, clarifies architecture policy, core concepts, storage model, integration boundaries, and the boundary with llm-task-orchestrator without moving into Plan, task breakdown, or implementation details.
---

# Solo Dev Design

## Purpose

Turn a completed Scope Artifact into a clear Design Artifact for pre-implementation alignment. Use the Scope artifact as the required product boundary input and `scope.coverage.json` as readiness and traceability context. Design explains the architectural direction needed before planning: architecture policy, core concepts, storage model, integration boundaries, and the responsibility boundary between this project and the existing `llm-task-orchestrator`.

This Skill is a Markdown-centered Anthropic Skill package. `SKILL.md` is the authoritative Skill body. Do not treat JSON, generated prompts, CLI commands, or external templates as the primary Design Skill definition.

Design does not create an implementation plan. It prepares architectural decisions and boundaries so a later Plan phase can decompose work without reopening product scope or inventing architecture from scratch.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

**Design-specific:**

- Use Scope artifacts only to form tentative Design hypotheses; they are not current-phase confirmation until the user confirms in Design dialogue.
- Show updated Design coverage in every response using `missing`, `tentative`, `confirmed`, and `explicitly_deferred`.
- Do not output `design.md` in the first response (candidate decisions and questions are allowed; not the final artifact).
- Do not output the final Design artifacts until all required Design topics are `confirmed` or `explicitly_deferred` and the user explicitly permits artifact generation.

## Required Input

Before starting Design, require the Scope phase outputs:

- `scope.md` is the primary input and source of truth.
- `scope.coverage.json` is required supporting input for readiness, deferred topics, and validation warnings.
- If the Scope artifact is missing, incomplete, not ready for Design, or contradicts `scope.coverage.json`, stop and ask for the missing Scope material or identify the specific contradiction.
- Do not invent Scope facts. Any Design statement not directly grounded in Scope must be labeled as a hypothesis, assumption, or user decision candidate.

## Core Rules

- Respond in Japanese unless the user asks otherwise.
- Base every Design decision on the Scope artifact, `scope.coverage.json`, existing project facts supplied by the user during the current Design dialogue, or explicit user confirmation during the current Design dialogue.
- Keep Design separate from Plan, task breakdown, ticket creation, implementation sequencing, estimates, file-by-file edits, code snippets, repository change lists, and test task lists.
- Do not expand MVP Scope, Deferred Scope, or Rejected work. If a design pressure implies scope change, surface it as a Scope question instead of absorbing it into Design.
- Define architectural choices at the policy and boundary level, not at the implementation-detail level.
- Prefer the smallest architecture that can support the confirmed MVP Scope while leaving documented seams for deferred scope only where Scope justifies them.
- Treat storage, integrations, and orchestration boundaries as explicit design topics, even when the MVP can use a minimal or manual approach.
- Before asking the user to confirm architecture policy, storage model, integration boundaries, or technology/tool boundaries, provide a Decision Brief explaining the concept, the common options, the tradeoffs, and the tentative recommendation.
- For technology or tool choices, distinguish "selected now", "boundary assumed for MVP", and "deferred or replaceable later". Do not let a library, runtime, or integration become confirmed merely because it appears in the agent's candidate design.
- When the user asks for clarification, expand the Decision Brief before returning to coverage questions.
- Do not produce final Design artifacts until the user has reviewed the candidate design and allowed artifact output.
- Do not add a Design prompt generation command. Design is managed as a standard Skill under `skills/design/`.

## Design Topics

Required topics must be confirmed or explicitly deferred before final output:

| Topic | Meaning |
| --- | --- |
| `source_scope` | Which Scope artifact and `scope.coverage.json` were used and whether they are ready for Design |
| `architecture_policy` | The governing architecture approach, constraints, and tradeoffs for the MVP |
| `core_concepts` | The main domain concepts and their relationships at a conceptual level |
| `storage_model` | What information must persist, ownership of persisted data, lifecycle, and consistency expectations |
| `integration_boundaries` | External systems, local tools, CLIs, files, APIs, or manual handoffs the product touches |
| `llm_task_orchestrator_boundary` | What remains the responsibility of the existing `llm-task-orchestrator` and what this project owns |
| `operational_boundaries` | Runtime, configuration, validation, and failure boundaries relevant before implementation planning |
| `design_risks` | Architectural risks, unresolved assumptions, and decisions that may affect Plan later |
| `do_not_cross` | Boundary that prevents Design from becoming Plan or implementation work |

Recommended topics should be covered when useful:

- `non_goals_inherited_from_scope`: Scope exclusions that constrain architecture
- `manual_paths`: manual or low-fidelity design paths allowed by MVP Scope
- `migration_notes`: future changes implied by Deferred Scope, without planning those changes
- `data_sensitivity`: privacy, safety, or retention concerns for persisted data
- `observability_policy`: what needs to be visible for operation or validation at a policy level

Coverage statuses:

- `missing`: not addressed enough to form a useful Design hypothesis.
- `tentative`: proposed by the agent, including anything inferred from Scope artifacts or existing project facts, but not confirmed by the user in this Design dialogue.
- `confirmed`: directly confirmed by the user in this Design dialogue.
- `explicitly_deferred`: explicitly postponed by the user in this Design dialogue.

Do not use previous Scope confirmation as Design confirmation. If the persisted coverage schema requires `deferred`, map `explicitly_deferred` to that storage value only when saving or importing; in dialogue, show `explicitly_deferred`.

## Architecture Policy

Architecture policy explains the shape of the system without turning into implementation instructions.

Include:

- the preferred architectural style for the MVP, such as CLI-first, file-based, local-first, service-backed, library-first, or adapter-based;
- the reason this style fits the confirmed MVP Scope;
- constraints inherited from Scope, such as solo-developer maintenance, local execution, human review gates, or no external service dependency;
- tradeoffs accepted for the MVP;
- architecture decisions that should not be reopened during Plan unless Scope changes.

Avoid:

- selecting libraries without a Scope-backed need;
- describing file paths to edit;
- writing code, schemas, migrations, or task lists;
- sequencing implementation steps.

## Core Concepts

Core concepts name the main objects and responsibilities the system must preserve. They should be stable enough to guide implementation planning but abstract enough to avoid implementation detail.

For each important concept, capture:

- `meaning`: what the concept represents;
- `source_scope_link`: the Scope statement that requires it;
- `responsibility`: what decisions or data it owns;
- `relationships`: how it relates to other core concepts;
- `out_of_scope`: nearby concepts that are deferred or rejected by Scope.

Do not turn concepts into class names, database tables, API endpoints, or task files unless the Scope artifact already uses those as product-level constraints.

## Storage Model

Storage model describes persistence responsibilities before implementation planning.

Cover:

- what information must be persisted for the MVP;
- what information can remain transient or manually provided;
- the owner of each persisted record or artifact;
- expected lifecycle, retention, and update rules;
- consistency expectations and acceptable manual repair paths;
- data that should not be stored for the MVP.

Keep this at the model level. Do not write concrete migrations, table definitions, indexes, file formats, repository functions, or implementation tasks.

## Integration Boundaries

Integration boundaries define where this system touches external or adjacent systems.

For each boundary, capture:

- `system_or_actor`: the external system, local tool, user, CLI, file, API, or manual process;
- `direction`: inbound, outbound, bidirectional, or manual handoff;
- `responsibility_owned_here`: what this project must own;
- `responsibility_owned_elsewhere`: what the other system or actor owns;
- `contract_level`: what must be stable before Plan, such as artifact presence, command availability, or validation result shape;
- `failure_boundary`: how failures are surfaced at a policy level.

Avoid defining full protocol details, generated clients, exact command implementations, or task YAML.

## llm-task-orchestrator Boundary

The existing `llm-task-orchestrator` is an adjacent implementation orchestrator, not the owner of product discovery, direction, scope, or design decisions.

Design must explicitly state:

- what `solo-dev-orchestrator` owns before implementation, such as phase artifacts, Skill installation, project bootstrap, and design decisions;
- what `llm-task-orchestrator` owns later, such as executing implementation task YAML, coordinating runner and reviewer agents, and running configured validators;
- what crosses the boundary, such as plan output, `tasks/*.yaml`, project files, config, or validation commands;
- what must not cross the boundary, such as asking `llm-task-orchestrator` to decide product scope, architecture policy, or design tradeoffs;
- any assumptions about compatibility with existing `llm-task-orchestrator` config and task directory conventions.

Do not produce `llm-task-orchestrator` tasks during Design. The later Plan phase or exporter is responsible for translating approved design and plan decisions into task artifacts.

## Design Flow

### First Response

1. Confirm that `scope.md` and `scope.coverage.json` are the inputs being used.
2. Summarize Scope-backed facts relevant to Design as tentative unless the user confirms them in this Design dialogue.
3. Identify candidate architecture policy, core concepts, storage model, integration boundaries, and `llm-task-orchestrator` boundary.
4. Call out Scope gaps, deferred Scope topics, or validation warnings that affect Design.
5. Ask focused confirmation questions before finalizing.
6. Show Design Coverage with every required topic marked `missing`, `tentative`, `confirmed`, or `explicitly_deferred`.

Never produce the final `design.md` in the first response, even if the Scope artifact looks complete.

Example shape:

```text
Scope Artifact と scope.coverage.json を入力として確認しました。
現時点で Design に使える前フェーズ由来の仮説は以下です。

Tentative:
- mvp_scope: ...
- deferred_scope: ...
- rejected: ...
- do_not_cross: ...

Candidate Design:
- architecture_policy: ...
- core_concepts: ...
- storage_model: ...
- integration_boundaries: ...
- llm_task_orchestrator_boundary: ...

確認したいこと:
1. この architecture policy は MVP Scope の制約に合っていますか？
2. storage_model で永続化すべき概念はこの範囲で足りますか？

Design Coverage:
- source_scope: tentative
- architecture_policy: tentative
- core_concepts: tentative
- storage_model: tentative
- integration_boundaries: tentative
- llm_task_orchestrator_boundary: tentative
- operational_boundaries: missing
- design_risks: missing
- do_not_cross: tentative
```

### Normal Response

1. Update coverage every response.
2. Mark topics `confirmed` only when the latest or earlier current-phase user answer directly confirms them.
3. Keep tentative statements separate from confirmed design decisions.
4. Preserve the separation between architecture policy, core concepts, storage model, integration boundaries, and orchestration boundary.
5. Ask the smallest useful set of questions needed to resolve missing or tentative topics.
6. Avoid expanding into Plan, task breakdown, implementation order, code, tickets, estimates, or detailed implementation mechanics.

### Scope Pressure Response

When a design decision would expand MVP Scope, stop and label it:

```text
その設計案は現在の MVP Scope を広げます。

Scope impact:
- affected_scope_item: ...
- implied_new_capability: ...
- recommendation: Scope に戻して確認する

Design では、この追加を前提にせず、現在の Scope 内で成立する代替を候補として扱います。
```

### Plan Pressure Response

When the user asks for task breakdown, implementation sequence, code changes, or ticket generation during Design, keep the boundary:

```text
それは Plan 以降の作業です。
Design では、Plan が後で使う判断材料として次だけ確定します。

- architecture_policy: ...
- boundary_decision: ...
- design_risk: ...
```

## Artifact Output

Produce `design.md` and `design.coverage.json` only when:

- `scope.md` and `scope.coverage.json` were available and used;
- all required Design topics are `confirmed` or `explicitly_deferred`;
- no unsupported agent hypothesis is presented as fact;
- the user gave permission to output the artifacts;
- the artifacts are still Design-level and do not define Plan, task breakdown, implementation sequence, estimates, code, migrations, file edits, or task YAML.

Use this `design.md` structure:

```markdown
# Design Artifact

## Source Scope

## Architecture Policy

## Core Concepts

## Storage Model

## Integration Boundaries

## llm-task-orchestrator Boundary

## Operational Boundaries

## Design Risks and Assumptions

## Deferred Design Questions

## Do Not Cross

## Ready for Plan
```

In `Do Not Cross`, list boundaries such as "Plan is not created", "task breakdown is not created", "implementation sequence is not selected", "code and file edits are not specified", and "`llm-task-orchestrator` tasks are not generated".

### `design.coverage.json`

The coverage report must include every required Design topic and any recommended topic that was discussed. Use persisted statuses accepted by the repository coverage schema:

- `confirmed` for current-phase user-confirmed topics.
- `deferred` for dialogue `explicitly_deferred` topics; record each in `deferredTopics` with a reason.
- `candidate` for dialogue `tentative` topics before final readiness.
- `unknown` for missing topics before final readiness.
- `blocked` for unresolved blockers; every blocked topic must be listed in `blockingTopics`.

Before final output, `coverageReady` must be true only when all required topics are `confirmed` or `deferred` and `blockingTopics` is empty. `userApprovedArtifactOutput` is true only after explicit user permission, and `readyForArtifact` must equal `coverageReady && userApprovedArtifactOutput`.

Canonical final coverage template:

```json
{
  "phase": "design",
  "coverageScore": 9,
  "coverageMaxScore": 9,
  "coverageReady": true,
  "userApprovedArtifactOutput": true,
  "readyForArtifact": true,
  "topics": {
    "source_scope": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "architecture_policy": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "core_concepts": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "storage_model": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "integration_boundaries": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "llm_task_orchestrator_boundary": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "operational_boundaries": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "design_risks": { "status": "confirmed", "evidence": "Concrete current Design user evidence." },
    "do_not_cross": { "status": "confirmed", "evidence": "Concrete current Design user evidence." }
  },
  "blockingTopics": [],
  "deferredTopics": [],
  "validationWarnings": []
}
```

Do not add metadata keys outside the schema. Do not add ad hoc permission keys such as `artifactOutputPermissionEvidence`; if permission evidence is needed, put it in `design.md` or in an existing schema-approved evidence field. Topic objects must use schema-approved fields such as `status` and `evidence`; do not copy model fields such as `required`, `weight`, or `description` into coverage topics. Do not use generic evidence such as `User confirmed`. Keep required `##` sections non-empty directly under the section heading. Design must include technology, storage, integration, testing/validation, and operational boundaries when they affect implementation readiness, but must not break down tasks.

### CLI Completion

After generating `design.md` and `design.coverage.json`, run:

```bash
solo-dev-orchestrator session submit-design <session-name> --artifact design.md --coverage design.coverage.json --force
```

If LLM validation is expected, add `--llm`. Report Design complete only after submit succeeds, or provide the exact command and error if the CLI cannot run.

## Readiness

Design is ready for Plan when:

- the architecture policy is explicit and Scope-backed;
- core concepts are named with responsibilities and relationships;
- the storage model identifies persisted, transient, and excluded data;
- integration boundaries and failure boundaries are documented;
- the `llm-task-orchestrator` responsibility boundary is explicit;
- important Design gaps are either resolved, deferred, or listed as risks;
- no Plan, task breakdown, or implementation detail has been smuggled into the artifact.


## Evaluation Materials

When improving this Skill, also review:

- `references/evaluation.md`
- `references/test-prompts.md`
