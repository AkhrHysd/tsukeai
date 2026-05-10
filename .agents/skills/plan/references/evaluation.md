# Plan Evaluation Criteria

Use this checklist when reviewing Plan Skill behavior.

## Conversation Behavior

- The response is in Japanese unless otherwise requested.
- The first response proposes milestones and task candidates, and does **not** emit `plan.md`, `plan.coverage.json`, or `intermediate-plan.json`.
- Each response shows `Plan Coverage` with `confirmed`, `tentative`, `missing`, and `explicitly_deferred` required topics.
- The agent continues asking while required topics are `missing` or `tentative`.
- The agent asks for explicit artifact-output permission after coverage is complete.
- Before asking whether task candidates are fine-grained enough, the agent explains implementation-ready granularity and shows at least one candidate that should be split when applicable.

## Task Candidate Integrity

- Task candidates are fine-grained and include purpose, target path candidates, Done conditions, validation viewpoints, and review viewpoints.
- Candidates that span multiple independently reviewable contracts, unrelated path groups, setup plus behavior plus docs, or likely multiple implementation PRs are split or marked `needs-refinement`.
- Candidates that depend on unresolved Design decisions are marked `blocked` (not silently assumed).
- Dependencies are explicit and justified.
- `task_candidates` confirmation is not accepted from a bare `yes` to a coarse list when the dialogue did not teach or apply the granularity criteria.

## Boundary Control

- The agent does not write implementation code, patches, tests, migrations, or repository edits.
- The agent does not generate `tasks/*.yaml` (Plan Exporter responsibility).

## Validation Criteria (for validators)

- Validators must not trust self-reported coverage or topic statuses without current-phase user evidence.
- A polished Plan output fails validation if it includes implementation work or exported task YAML.
- Validators reject `userApprovedArtifactOutput: true` when no explicit artifact-output permission evidence is visible.
- Validators reject optional or recommended topics being treated as readiness blockers unless Plan marks them required or the user explicitly makes them blockers.

## Artifact Quality

- `plan.md` follows the required headings in `SKILL.md`.
- `plan.coverage.json` is produced with persisted `phase: "planning"`, valid persisted statuses, evidence, readiness flags, and deferred/blocking topic records.
- `intermediate-plan.json` is valid JSON and schema-aligned.
- Final Plan artifacts are produced only after coverage is complete and user permission is explicit.
- Explicit artifact-output permission evidence is visible in the artifact or coverage material.
- The final response reports successful `solo-dev-orchestrator session submit-plan ...` execution, or gives the exact command and blocker if CLI validation/import could not run.
- Coverage display includes numeric counts and a Final Coverage Review before artifact output permission is requested.
