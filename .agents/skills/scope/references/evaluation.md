# Scope Evaluation Criteria

Use this checklist when reviewing Scope Skill behavior.

## Conversation Behavior

- The response is in Japanese unless otherwise requested.
- The first response proposes candidate Scope hypotheses and questions, and does **not** emit `scope.md`.
- Each response shows `Scope Coverage` with `confirmed`, `tentative`, `missing`, and `explicitly_deferred` required topics.
- The agent continues asking while required topics are `missing` or `tentative`.
- The agent asks for explicit artifact-output permission after coverage is complete.
- MVP / Deferred / Rejected confirmations are preceded by a Decision Brief that explains cut criteria, tradeoffs, and scope-expansion risk.

## Topic Integrity

- Direction-derived statements remain `tentative` until user confirmation in the current Scope dialogue.
- `confirmed` required topics are backed by evidence from the current Scope dialogue, not by the existence of `direction.md`.
- `explicitly_deferred` topics are backed by an explicit user choice to defer.
- Deferred Scope items include both `why_not_now` and `reevaluation_condition`.
- Rejected items are not used as a parking lot; direction-aligned future work is Deferred, not Rejected.
- `mvp_scope` confirmation is not accepted when the user only said `yes` to an unexplained candidate list; the dialogue must show why the boundary is smaller than plausible alternatives.

## Boundary Control

- The agent does not move into Design or Plan (architecture, stack, repository structure, code, task breakdown, estimates, tests, or `tasks/*.yaml`).
- If a scope change pressure appears during Scope, the agent classifies it (Must/Should/Could/Won't) before accepting it into MVP.

## Validation Criteria (for validators)

- Validators must not trust self-reported coverage or topic statuses without current-phase user evidence.
- A polished `scope.md` fails validation if it includes Design/Plan contamination or if required topics lack confirmation evidence.
- Validators reject `userApprovedArtifactOutput: true` when no explicit artifact-output permission evidence is visible.
- Validators reject optional or recommended topics being treated as readiness blockers unless Scope marks them required or the user explicitly makes them blockers.

## Artifact Quality

- `scope.md` follows the required headings in `SKILL.md`.
- `scope.coverage.json` is produced with valid persisted statuses, evidence, readiness flags, and deferred/blocking topic records.
- Deferred Scope items include both `why_not_now` and `reevaluation_condition`; deferred coverage entries include `reason` and `reevaluationCondition`.
- Cut rationale and expansion risks reflect the learning discussion, not only final bucket labels.
- Final Scope artifacts are produced only after coverage is complete and user permission is explicit.
- Explicit artifact-output permission evidence is visible in the artifact or coverage material.
- The final response reports successful `solo-dev-orchestrator session submit-scope ...` execution, or gives the exact command and blocker if CLI validation/import could not run.
- Coverage display includes numeric counts and a Final Coverage Review before artifact output permission is requested.
