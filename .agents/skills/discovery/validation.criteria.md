# Discovery Validation Criteria

Validate Discovery output against `skills/discovery/SKILL.md` before presenting it as final.

## Error Criteria

- Required topics are not all `confirmed` or explicitly deferred by the user.
- A `missing`, `tentative`, `unknown`, `partial`, or `blocked` required topic is treated as ready.
- A recommended, non-required topic is treated as a required readiness blocker
  without explicit user instruction.
- A required topic is marked `confirmed` without evidence from the current Discovery dialogue.
- AI-only hypotheses are marked as `confirmed`.
- Final artifacts are produced without explicit user permission.
- `userApprovedArtifactOutput: true` is set without visible evidence of explicit
  artifact-output permission.
- `discovery.coverage.json` is invalid JSON or omits discussed required topics.
- Discovery output moves into Direction, Scope, Design, Plan, MVP scope, stack, architecture, repository changes, implementation tasks, or task YAML as confirmed decisions.

## Warning Criteria

- Multiple required topics are explicitly deferred.
- Recommended topics remain open but would materially affect Direction.
- `Do Not Assume` omits boundaries such as MVP, stack, or implementation scope.
