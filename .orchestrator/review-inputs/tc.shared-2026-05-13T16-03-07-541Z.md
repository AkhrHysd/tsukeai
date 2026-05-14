# Review Task

Task ID: tc.shared
Title: packages/shared の REST 契約たたき台

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.shared

## Description
DTO・エラー形の命名とエクスポート。フロントは DB に直接依存しない。

## Allowed Paths
- packages/shared

## Acceptance Criteria
- 共有パッケージから境界型がインポートできる。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: $ npm test
exitCode: 0
stdout:

> tsukeai@0.0.0 test
> pnpm --filter @tsukeai/web test


> @tsukeai/web@0.0.0 test /Users/akyrhysd/work/tsukeai/.worktrees/tc.shared/apps/web
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tsukeai/web@0.0.0 smoke:read /Users/akyrhysd/work/tsukeai/.worktrees/tc.shared/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tsukeai/web@0.0.0 smoke:write /Users/akyrhysd/work/tsukeai/.worktrees/tc.shared/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 6aa34f2..f992a5b 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -33,6 +33,11 @@ export type ApiErrorResponseDto = {
   error: ApiErrorDto;
 };
 
+export type BoundaryErrorCode = ApiErrorCode;
+export type BoundaryFieldErrorDto = FieldErrorDto;
+export type BoundaryErrorDto = ApiErrorDto;
+export type BoundaryErrorResponseDto = ApiErrorResponseDto;
+
 export const TRANSFORM_JOB_STATES = [
   "queued",
   "processing",
@@ -161,6 +166,23 @@ export type TransformJobResponseDto = {
   job: TransformJobDto;
 };
 
+export type BoundaryTransformJobState = TransformJobState;
+export type BoundaryTransformTerminalJobState = TransformTerminalJobState;
+export type BoundaryTransformJobKind = TransformJobKind;
+export type BoundaryTransformFormCheckReason = TransformFormCheckReason;
+export type BoundaryTransformFormCheckSegmentDto = TransformFormCheckSegment;
+export type BoundaryTransformFormCheckErrorDto = TransformFormCheckError;
+export type BoundaryTransformFormCheckResultDto = TransformFormCheckResult;
+export type BoundaryTransformIdempotencyScopeDto = TransformIdempotencyScope;
+export type BoundaryTransformRetryPolicy = TransformRetryPolicy;
+export type BoundaryTransformUserAction = TransformUserAction;
+export type BoundaryTransformPublicErrorCode = TransformPublicErrorCode;
+export type BoundaryTransformFailureReason = TransformFailureReason;
+export type BoundaryTransformJobErrorDto = TransformJobErrorDto;
+export type BoundaryTransformJobObservationDto = TransformJobObservationDto;
+export type BoundaryTransformJobDto = TransformJobDto;
+export type BoundaryTransformJobResponseDto = TransformJobResponseDto;
+
 const EXPLICIT_SEGMENT_SEPARATOR_PATTERN = /[\n\r/／]+/u;
 const INLINE_SEGMENT_SEPARATOR_PATTERN = /[\s　、，,。．.！？!?]+/u;
 const IGNORED_FORM_CHARACTERS_PATTERN = /[\s　、，,。．.！？!?「」『』（）()［］[\]【】]/gu;
@@ -332,3 +354,17 @@ export type CreateReplyRequestDto = {
 export type CreateReplyResponseDto = {
   reply: ReplyDto;
 };
+
+export type BoundaryEntityId = EntityId;
+export type BoundaryIsoDateTimeString = IsoDateTimeString;
+export type BoundaryTankaText = TankaText;
+export type BoundaryPublicTankaText = PublicTankaText;
+export type BoundaryAuthorDto = AuthorDto;
+export type BoundaryPostDto = PostDto;
+export type BoundaryReplyDto = ReplyDto;
+export type BoundaryTimelineItemDto = TimelineItemDto;
+export type BoundaryTimelineResponseDto = TimelineResponseDto;
+export type BoundaryCreatePostRequestDto = CreatePostRequestDto;
+export type BoundaryCreatePostResponseDto = CreatePostResponseDto;
+export type BoundaryCreateReplyRequestDto = CreateReplyRequestDto;
+export type BoundaryCreateReplyResponseDto = CreateReplyResponseDto;

```

## JSON Only Response Schema
```json
{
  "decision": "accept" | "reject",
  "summary": "string",
  "requiredFixes": ["string"],
  "riskNotes": ["string"],
  "scopeViolations": ["string"]
}
```

## Reviewer Instructions
- コードを修正しないこと。
- 判定だけを返すこと。
- JSON only で返すこと。
- scope violation を明示すること。
- required fixes は短く具体的にすること。