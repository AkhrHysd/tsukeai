---
name: discovery
description: Use when a user wants to explore a rough solo-development software idea before MVP, design, or implementation planning. Guides coverage-driven Discovery through dialogue, separates confirmed facts from hypotheses, and produces discovery.md plus discovery.coverage.json.
---

# Solo Dev Discovery

## Purpose

Guide a rough solo-development idea into a Discovery Artifact for the next Direction phase. Keep the user's decisions owned by the user: ask until coverage is sufficient, distinguish confirmed facts from hypotheses, and do not close Discovery only because a fixed number of turns passed.

This Skill is a file-based skill package centered on `SKILL.md`. JSON is not the Skill body; use JSON only for machine-readable Discovery outputs or supporting metadata such as coverage models, manifests, and `discovery.coverage.json`.

## Phase Dialogue Protocol

Apply the **`phase-dialogue-protocol`** standard Skill first (`skills/phase-dialogue-protocol/SKILL.md` in this repository; co-install it under `.agents/skills/` next to this Skill when packaging for CLI or target projects).

**Discovery-specific:** This phase uses additional topic statuses (`unknown`, `partial`, `blocked`) and often persists `deferred` where dialogue uses `explicitly_deferred`; follow `coverage.model.json` and the Core Rules below. Required topics must reach `confirmed` or `deferred` before final artifacts, with explicit user permission to emit `discovery.md` / `discovery.coverage.json`.

## Core Rules

- Respond in Japanese unless the user asks otherwise.
- Do not define the core problem from the first user message.
- Treat AI interpretations as `tentative` until the user confirms them.
- Mark a topic `confirmed` only when the user explicitly agrees, the user's own words directly support the summary, or the user says the understanding is acceptable.
- Show concise Discovery Coverage in every Discovery response.
- Keep asking while important required topics are `unknown`, `partial`, `tentative`, or `blocked`.
- When asking the user to choose the strongest pain, compare alternatives, or decide whether to defer a topic, provide a brief Decision Brief that explains the options and what each choice would mean for later Direction.
- When conversation stalls, present concrete options and allow `deferred`; do not jump to Direction, Scope, Design, Plan, MVP, stack, repository structure, or tasks.
- Before producing final artifacts, verify that the user permits artifact output.

## Coverage Topics

Required topics must be `confirmed` or `deferred` before a final artifact:

| Topic | Meaning |
| --- | --- |
| `idea_summary` | What the user wants to make |
| `trigger_context` | Direct trigger that produced the idea |
| `target_user_candidate` | Who the idea is for; the user themself is acceptable initially |
| `pain_candidates` | Candidate pains inside the idea |
| `strongest_pain` | Currently most important pain |
| `current_workaround` | How the user handles it now |
| `existing_alternatives` | Existing similar or substitute options |
| `dissatisfaction_with_alternatives` | What those options fail to satisfy |

Recommended topics should be asked when useful, but can remain open:

- `success_signal`: signs that the problem is solved
- `non_goals_seed`: early seeds for what not to do
- `constraints`: time, technical, operational, or maintenance constraints
- `emotional_motivation`: why the user is drawn to the idea
- `continuation_reason`: what could keep the user building it

Recommended topics are not readiness blockers. If they remain `unknown`,
`partial`, or `tentative`, do not claim that all topics are complete; say only
that all **required** Discovery topics are `confirmed` or `deferred`. Omit
undiscussed recommended topics from `discovery.coverage.json`, or include them
as non-blocking open questions in `discovery.md`.

Topic statuses:

- `unknown`: not asked yet
- `partial`: some information exists but is insufficient
- `tentative`: AI has a hypothesis without user confirmation
- `confirmed`: supported by user statement or explicit confirmation
- `blocked`: unresolved and blocks the next phase
- `deferred`: intentionally postponed for now

## Discovery Flow

### First Response

1. Briefly summarize the user's idea.
2. Say that the core problem is not yet confirmed.
3. Show initial coverage with `Confirmed`, `Tentative`, and `Unclear`.
4. Ask focused questions. For each question, state the topic it is meant to clarify.

Example shape:

```text
現時点では「...を作りたい」というアイデアとして受け取りました。
ただし、核心課題はまだ断定しません。

Discovery Coverage: 15%

Confirmed:
- idea_summary: ...

Tentative:
- target_user_candidate: ...

Unclear:
- trigger_context
- strongest_pain
- current_workaround
- existing_alternatives

確認したいこと:
1. trigger_context を埋めるため: ...
2. pain_candidates を分けるため: ...
```

### Normal Response

1. Update only topics supported by the latest user answer.
2. Show coverage as a percentage plus topic groups.
3. Label hypotheses explicitly as hypotheses.
4. Ask the next smallest useful set of questions for uncovered required topics.
5. Avoid summarizing into an artifact unless coverage and user permission allow it.

### Stalled Response

If the user cannot answer or the dialogue is looping, provide options:

```text
ここはまだ決めきれていません。
現時点では3つの見方があります。

A. 自分専用ツールとして進める
B. 他の個人開発者にも使える道具として進める
C. まず実験プロトタイプとして進める

どれが近いですか？
または、この topic は deferred にしますか？
```

## Coverage Scoring

Use a simple, transparent score. Count topic weights, then divide by total weight.

- Required topics: 10 points each.
- Recommended topics: 4 points each.
- `confirmed`: full points.
- `deferred`: acceptable for readiness, but half points for coverage score.
- `partial`: half points.
- `tentative`, `unknown`, `blocked`: 0 points.

Report `coverageScore` as an integer percentage from 0 to `coverageMaxScore: 100`. Keep raw point calculations internal unless the user asks for them.

Record every deferred topic with a reason. If multiple required topics are `deferred`, add a validation warning and explicitly ask the user whether Direction should proceed with those gaps.

Use three readiness flags:

- `coverageReady`: true only when all required topics are `confirmed` or `deferred` and `blockingTopics` is empty.
- `userApprovedArtifactOutput`: true only when the user has explicitly allowed artifact output.
- `readyForArtifact`: true only when both `coverageReady` and `userApprovedArtifactOutput` are true.

Before setting `userApprovedArtifactOutput: true`, show a Final Coverage Review
and ask explicitly whether to output the final Discovery artifacts. Preserve
that permission evidence in `discovery.md` under `## Ready for Direction`.
Do not preserve permission evidence by adding new top-level keys to
`discovery.coverage.json`; the coverage schema is strict.

## Artifact Output

Create final artifacts only when:

- all required topics are `confirmed` or `deferred`;
- `blockingTopics` is empty;
- no AI-only hypothesis is marked `confirmed`;
- the user gave permission to output the artifact;
- the material is enough for Direction.

If the user asks for artifacts before readiness, either keep asking or output a clearly labeled draft. Do not present an under-covered draft as final.

### `discovery.md`

Use this structure:

```markdown
# Discovery Artifact

## Idea Summary

## Trigger Context

## Confirmed Findings

Use finding/evidence pairs:

- Finding: ...
  Evidence: ...

## Tentative Hypotheses

## Current Workarounds

## Existing Alternatives

## Dissatisfaction with Alternatives

## Strongest Pain

## Open Questions

## Deferred Topics

## Do Not Assume

## Ready for Direction
```

In `Do Not Assume`, list boundaries such as "MVP is not defined", "technology stack is not selected", and any user-specific uncertainties.

In `Ready for Direction`, include the explicit artifact output permission
evidence, for example: `Artifact output permission: The user said "出力してよいです"
after the Final Coverage Review.`

### `discovery.coverage.json`

Include every required topic and any recommended topic that was discussed:

Do not add metadata keys outside the schema. The allowed top-level keys are
`phase`, `coverageScore`, `coverageMaxScore`, `coverageReady`,
`userApprovedArtifactOutput`, `readyForArtifact`, `topics`, `blockingTopics`,
`deferredTopics`, and optional `validationWarnings`. Do not add keys such as
`artifactOutputPermissionEvidence`; store permission evidence in
`discovery.md` instead.

Each `topics.<topic_id>` object may contain only `status` and optional
`evidence`. Do not copy `coverage.model.json` fields such as `required`,
`weight`, or `description` into `discovery.coverage.json`.

```json
{
  "phase": "discovery",
  "coverageScore": 72,
  "coverageMaxScore": 100,
  "coverageReady": true,
  "userApprovedArtifactOutput": false,
  "readyForArtifact": false,
  "topics": {
    "idea_summary": {
      "status": "confirmed",
      "evidence": "ユーザー発言の要約または根拠"
    },
    "trigger_context": {
      "status": "confirmed",
      "evidence": "ユーザーが説明した直接のきっかけ"
    },
    "target_user_candidate": {
      "status": "confirmed",
      "evidence": "ユーザー発言から直接要約できる対象ユーザー"
    },
    "pain_candidates": {
      "status": "confirmed",
      "evidence": "確認済みの困りごと候補"
    },
    "strongest_pain": {
      "status": "confirmed",
      "evidence": "ユーザーが最重要と確認した困りごと"
    },
    "current_workaround": {
      "status": "confirmed",
      "evidence": "現在の対処方法についてのユーザー回答"
    },
    "existing_alternatives": {
      "status": "deferred",
      "evidence": "現時点で意図的に保留した理由"
    },
    "dissatisfaction_with_alternatives": {
      "status": "confirmed",
      "evidence": "既存手段への不満としてユーザーが確認した内容"
    }
  },
  "blockingTopics": [],
  "deferredTopics": [
    {
      "topic": "existing_alternatives",
      "reason": "現時点で意図的に保留した理由"
    }
  ],
  "validationWarnings": []
}
```

## Resources

- Load `references/test-prompts.md` when asked to test or demonstrate the skill with example prompts.
- Load `references/evaluation.md` when reviewing whether a Discovery conversation or artifact followed this skill.
- Treat `agents/openai.yaml` as Codex/OpenAI interface metadata only. It is not the Anthropic Skill body.
