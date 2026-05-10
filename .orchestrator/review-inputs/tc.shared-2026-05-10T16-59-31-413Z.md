# Review Task

Task ID: tc.shared
Title: packages/shared の REST 契約たたき台

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.shared

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
skipped:
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T16_59_31_379Z-debug-0.log

## Changed Files
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 59e5ed0..5d9e76a 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -1 +1,77 @@
 export type TankaText = string;
+
+export type EntityId = string;
+export type IsoDateTimeString = string;
+
+export type ApiErrorCode =
+  | "bad_request"
+  | "unauthorized"
+  | "forbidden"
+  | "not_found"
+  | "conflict"
+  | "rate_limited"
+  | "internal_error"
+  | "service_unavailable";
+
+export type ApiErrorDto = {
+  code: ApiErrorCode;
+  message: string;
+  requestId?: string;
+  fieldErrors?: FieldErrorDto[];
+};
+
+export type FieldErrorDto = {
+  field: string;
+  message: string;
+};
+
+export type ApiErrorResponseDto = {
+  error: ApiErrorDto;
+};
+
+export type AuthorDto = {
+  id: EntityId;
+  displayName: string;
+  handle?: string;
+};
+
+export type PostDto = {
+  id: EntityId;
+  author: AuthorDto;
+  body: TankaText;
+  createdAt: IsoDateTimeString;
+};
+
+export type ReplyDto = {
+  id: EntityId;
+  postId: EntityId;
+  author: AuthorDto;
+  body: TankaText;
+  createdAt: IsoDateTimeString;
+};
+
+export type TimelineItemDto = {
+  post: PostDto;
+  replies: ReplyDto[];
+};
+
+export type TimelineResponseDto = {
+  items: TimelineItemDto[];
+  nextCursor?: string;
+};
+
+export type CreatePostRequestDto = {
+  body: TankaText;
+};
+
+export type CreatePostResponseDto = {
+  post: PostDto;
+};
+
+export type CreateReplyRequestDto = {
+  body: TankaText;
+};
+
+export type CreateReplyResponseDto = {
+  reply: ReplyDto;
+};

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