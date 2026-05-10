# Direction Evaluation Criteria

Use this checklist when reviewing Direction Skill behavior.

## Conversation Behavior

- The response is in Japanese unless otherwise requested.
- The first response uses the Discovery artifact to propose hypotheses, not to emit `direction.md`.
- Each response shows `Direction Coverage` with `confirmed`, `tentative`, `missing`, and `explicitly_deferred` required topics.
- The agent continues asking while required topics are `missing` or `tentative`.
- The agent asks for explicit artifact-output permission after coverage is complete.
- Meaningful Direction choices are preceded by a Decision Brief that explains alternatives, tradeoffs, and the tentative recommendation before asking for confirmation.

## Topic Integrity

- Discovery-derived project identity, primary user, success criteria, constraints, non-goals, and other Direction topics remain `tentative` until current-phase user confirmation.
- `confirmed` topics are backed by evidence from the current Direction dialogue: explicit user confirmation, a user-authored statement, or a user-approved correction.
- `confirmed` evidence is not accepted when it only says Discovery contained the topic, the agent inferred it, or the artifact wording sounds plausible.
- `explicitly_deferred` topics are backed by an explicit user choice to defer.
- Agent guesses are never marked `confirmed`.
- AI hypotheses, synthesized summaries, and Discovery-derived inferences are rejected when they are presented as confirmed Direction decisions.
- Success criteria, non-goals, and constraints require user confirmation or explicit user deferral before final artifact output.
- All required Direction topics from `SKILL.md` are represented in coverage.
- `decision_rationale` is not accepted when it is only a bare user `yes` to an unexplained recommendation; the dialogue must show enough alternative comparison for informed confirmation.

## Boundary Control

- The agent does not move into Scope, Design, Plan, MVP definition, stack selection, repository structure, implementation tasks, task YAML, or estimates.
- Minor forward-looking notes are warned only when clearly marked as out of scope; concrete Scope, Design, or Plan commitments are rejected.
- The agent does not proceed to Scope, Design, or Plan during Direction.
- The agent does not present an under-covered draft as a final Direction artifact.

## Validation Criteria

- LLM validation input includes Direction validation criteria, not only artifact content and coverage JSON.
- The criteria tell the validator not to trust self-reported `coverageReady`, `readyForArtifact`, or topic statuses without evidence.
- The criteria require confirmed required topics to have current Direction user evidence.
- The criteria reject Discovery-only or AI-authored evidence being treated as confirmation.
- The criteria require success criteria, non-goals, and constraints to be confirmed by the user or explicitly deferred.
- The criteria reject `userApprovedArtifactOutput: true` when no explicit artifact-output permission evidence is visible.
- The criteria reject optional or recommended topics being treated as readiness blockers unless Direction marks them required or the user explicitly makes them blockers.
- The criteria warn or reject Scope, Design, and Plan contamination, including MVP scope, feature lists, screens, architecture, technology stack, implementation tasks, estimates, and exported task YAML.
- A polished but unsupported `direction.md` must fail validation when it lacks user-confirmation evidence or includes later-phase commitments.

## Artifact Quality

- `direction.md` follows the required headings in `SKILL.md`.
- `direction.coverage.json` is produced with valid persisted statuses, evidence, readiness flags, and deferred/blocking topic records.
- The artifact is Direction-level and avoids feature lists, screens, architecture, tasks, and stack choices.
- Decision rationale records the alternatives and tradeoffs discussed in dialogue, not only the selected direction.
- Deferred topics are visible with reasons.
- `Do Not Assume` captures boundaries such as MVP, feature scope, technology stack, and implementation tasks not being selected.
- The artifact is produced only after coverage is complete and user permission is explicit.
- Explicit artifact-output permission evidence is visible in the artifact or coverage material.
- The final response reports successful `solo-dev-orchestrator session submit-direction ...` execution, or gives the exact command and blocker if CLI validation/import could not run.
- Coverage display includes numeric counts and a Final Coverage Review before artifact output permission is requested.
