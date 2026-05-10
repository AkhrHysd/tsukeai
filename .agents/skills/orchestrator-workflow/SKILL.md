---
name: orchestrator-workflow
description: "Use when operating solo-dev-orchestrator from chat or CLI: creating sessions, importing or submitting Discovery/Direction/Scope/Design/Plan artifacts, running validation, bootstrapping target workspaces, exporting Plan tasks, recovering from validation/import errors, or explaining the recommended end-to-end workflow and command sequence."
---

# Orchestrator Workflow

## Core Rule

Prefer commands that validate before mutating state. Use `session submit-*` for generated phase artifacts because it performs preflight validation, import, and session validation in one flow.

Do not report a phase as complete until the relevant validation/import command has succeeded. If a command cannot run, report the exact command the user should run and the blocker.

## Phase Workflow

Use this sequence for the normal end-to-end flow:

```bash
solo-dev-orchestrator session create <session>
```

Discovery is usually created by chat or a Discovery Skill, then imported:

```bash
solo-dev-orchestrator session import-discovery <session> \
  --artifact discovery.md \
  --coverage discovery.coverage.json

solo-dev-orchestrator validation discovery <session> --llm
solo-dev-orchestrator session next <session>
```

For Direction, Scope, Design, and Plan, prefer submit:

```bash
solo-dev-orchestrator session submit-direction <session> \
  --artifact direction.md \
  --coverage direction.coverage.json \
  --force --llm

solo-dev-orchestrator session next <session>
```

```bash
solo-dev-orchestrator session submit-scope <session> \
  --artifact scope.md \
  --coverage scope.coverage.json \
  --force --llm
```

After Scope validation passes, bootstrap the target project:

```bash
solo-dev-orchestrator bootstrap <session> --target-dir /path/to/project
```

Continue with Design and Plan:

```bash
solo-dev-orchestrator session submit-design <session> \
  --artifact design.md \
  --coverage design.coverage.json \
  --force --llm

solo-dev-orchestrator session submit-plan <session> \
  --artifact plan.md \
  --coverage plan.coverage.json \
  --intermediate-plan intermediate-plan.json \
  --force --llm
```

Export Plan task candidates after Plan validation passes:

```bash
solo-dev-orchestrator plan export <session> \
  --target-dir /path/to/project \
  --dry-run

solo-dev-orchestrator plan export <session> \
  --target-dir /path/to/project \
  --force
```

## GPTs-Assisted Early Phases

Discovery, Direction, and Scope may be run in a dedicated GPTs-style chat when the priority is user learning, exploratory conversation, alternative comparison, or product boundary formation. This is acceptable if the GPT uses the same canonical `phase-dialogue-protocol` semantics:

- prior-phase artifacts remain tentative until current-phase confirmation;
- required topics need current-phase user evidence or explicit deferral;
- Decision Briefs explain alternatives, tradeoffs, and cut criteria before confirmation;
- Final Coverage Review and explicit artifact-output permission happen before artifacts are produced;
- artifacts and coverage are exported in the schema-compatible shape expected by this repository.

After GPTs-assisted Scope, import or submit the generated artifacts into the session and run validation before bootstrapping the target workspace. Do not treat GPT output as authoritative until repository validation passes.

## Preflight Before Import

When artifact files exist but should not be imported yet, validate them locally:

```bash
solo-dev-orchestrator validation artifact direction \
  --artifact direction.md \
  --coverage direction.coverage.json
```

Plan preflight requires `intermediate-plan.json`:

```bash
solo-dev-orchestrator validation artifact plan \
  --artifact plan.md \
  --coverage plan.coverage.json \
  --intermediate-plan intermediate-plan.json
```

Add `--llm` when semantic validation is configured and needed.

## Status and Recovery

Inspect the current session:

```bash
solo-dev-orchestrator session status <session>
```

If submit fails:

- `preflight_rules`: fix local artifact, coverage, or intermediate plan before import.
- `preflight_llm`: fix semantic issues before import.
- `import`: check phase, source paths, conflicts, and whether `--force` is appropriate.
- `session_rules`: imported files are present but fail rule validation.
- `session_llm`: imported files fail semantic validation.

If `coverageReady` or `readyForArtifact` fails, check that all required topics are `confirmed` or `deferred`, `blockingTopics` is empty, `userApprovedArtifactOutput` is true only after explicit permission, and each confirmed topic has concrete current-phase user evidence.

If Plan export produces task runner issues, check `allowedPathCandidates`: use directory prefix paths such as `docs/patterns` rather than relying on downstream glob interpretation.

## Workspace Flow

The official workspace flow is:

- Discovery and Direction live in the session.
- Scope validation pass authorizes target workspace bootstrap.
- At the start of Design or Plan, tell the user whether bootstrap has already happened. If it has not, recommend bootstrapping after Scope pass before Plan whenever path candidates, repository layout, or sample-project placement will affect planning.
- Design and Plan artifacts remain session-owned even when copied to `docs/orchestration/`.
- Plan export writes implementation task YAML to the target project.

Do not create exported task YAML during Plan dialogue; use `plan export`.

## Skill Installation

Install all standard phase Skills plus this workflow Skill into a target project when preparing an agent workspace:

```bash
solo-dev-orchestrator skill install phase-dialogue-protocol --project-dir /path/to/project
solo-dev-orchestrator skill install discovery --project-dir /path/to/project
solo-dev-orchestrator skill install direction --project-dir /path/to/project
solo-dev-orchestrator skill install scope --project-dir /path/to/project
solo-dev-orchestrator skill install design --project-dir /path/to/project
solo-dev-orchestrator skill install plan --project-dir /path/to/project
solo-dev-orchestrator skill install orchestrator-workflow --project-dir /path/to/project
```
