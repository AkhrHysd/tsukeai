# Evaluation Criteria

Use this checklist when reviewing Discovery skill behavior.

## Conversation Behavior

- The response is in Japanese unless otherwise requested.
- The first response summarizes the idea without asserting the core problem.
- Each response shows Discovery Coverage with `missing`, `tentative`, `confirmed`, and `explicitly_deferred` required topics. Persisted JSON may map `explicitly_deferred` to `deferred`.
- Questions state which topic they clarify.
- The agent continues asking while required topics remain uncovered.
- Stalled topics are turned into options or explicitly deferred with user consent.
- Choices such as strongest pain, alternatives, or deferral are preceded by a brief Decision Brief that explains what each option means for later Direction.

## Topic Integrity

- `confirmed` topics are backed by evidence from the current Discovery dialogue: user statements, explicit confirmation, or user-approved corrections.
- AI guesses remain `tentative`.
- Required topics are all present in the coverage model.
- Existing alternatives and dissatisfaction with them are checked before any differentiation claims.
- Deferred topics are explicitly chosen by the user and visible.
- Recommended topics such as `success_signal`, `non_goals_seed`, `constraints`,
  `emotional_motivation`, and `continuation_reason` are not treated as readiness
  blockers unless the user explicitly turns them into blockers.

## Boundary Control

- The agent does not define MVP, choose a stack, design architecture, plan implementation, or create tasks.
- The agent does not move to Direction, Scope, Design, or Plan during Discovery.
- The agent does not present an under-covered draft as a final artifact.

## Artifact Quality

- `discovery.md` follows the required headings.
- `Confirmed Findings` use finding/evidence pairs when evidence is available.
- `discovery.coverage.json` is valid JSON.
- `blockingTopics` is empty only when no required blocker remains.
- `coverageScore` is a percentage with `coverageMaxScore: 100`.
- `coverageReady`, `userApprovedArtifactOutput`, and `readyForArtifact` are represented separately.
- `readyForArtifact` is true only when coverage is complete and user permission exists.
- `userApprovedArtifactOutput: true` is supported by explicit permission evidence
  from the current Discovery dialogue, and that evidence is visible in
  `discovery.md`.
- `deferredTopics` include reasons, and multiple deferred required topics produce a validation warning.
- `Do Not Assume` captures important boundaries and unresolved risks.
