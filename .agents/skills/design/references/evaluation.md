# Design Evaluation Criteria

Use this checklist when reviewing Design Skill behavior.

## Conversation Behavior

- The response is in Japanese unless otherwise requested.
- The first response proposes candidate design decisions and questions, and does **not** emit `design.md`.
- Each response shows `Design Coverage` with `confirmed`, `tentative`, `missing`, and `explicitly_deferred` required topics.
- The agent continues asking while required topics are `missing` or `tentative`.
- The agent asks for explicit artifact-output permission after coverage is complete.
- Architecture policy, storage, integration, and technology/tool boundary confirmations are preceded by a Decision Brief that explains concepts, options, tradeoffs, and tentative recommendations.

## Topic Integrity

- Scope-derived statements remain `tentative` until user confirmation in the current Design dialogue.
- `confirmed` topics are backed by current-phase user evidence.
- Integration boundaries include responsibility split and failure boundary at policy level.
- Storage model stays at model/policy level (no migrations, tables, indexes, file formats, or code).
- `llm_task_orchestrator_boundary` is explicit and prevents outsourcing product decisions.
- Technology/tool choices are not accepted as confirmed merely because they appear in the candidate design; the dialogue distinguishes selected-now choices from MVP assumptions and deferred/replacable choices.

## Boundary Control

- The agent does not move into Plan or implementation details (task breakdown, exact file edits, code, estimates, `tasks/*.yaml`).
- If design pressure implies scope change, surface it as a Scope question instead of absorbing it into Design.

## Validation Criteria (for validators)

- Validators must not trust self-reported coverage or topic statuses without current-phase user evidence.
- A polished `design.md` fails validation if it contains Plan/task breakdown/implementation contamination.
- Validators reject `userApprovedArtifactOutput: true` when no explicit artifact-output permission evidence is visible.
- Validators reject optional or recommended topics being treated as readiness blockers unless Design marks them required or the user explicitly makes them blockers.

## Artifact Quality

- `design.md` follows the required headings in `SKILL.md`.
- `design.coverage.json` is produced with valid persisted statuses, evidence, readiness flags, and deferred/blocking topic records.
- `design.md` captures the rationale for confirmed architecture and integration choices at policy level, including the tradeoffs discussed with the user.
- Final Design artifacts are produced only after coverage is complete and user permission is explicit.
- Explicit artifact-output permission evidence is visible in the artifact or coverage material.
- The final response reports successful `solo-dev-orchestrator session submit-design ...` execution, or gives the exact command and blocker if CLI validation/import could not run.
- Coverage display includes numeric counts and a Final Coverage Review before artifact output permission is requested.
