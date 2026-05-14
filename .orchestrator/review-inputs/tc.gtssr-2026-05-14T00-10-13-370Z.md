# Review Task

Task ID: tc.gtssr
Title: GT の SSR 一覧・スレッド

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.gtssr

## Description
公開 API と整合。変換句のみ表示し素を出さない。

## Allowed Paths
- apps/web
- packages/shared

## Acceptance Criteria
- GT が SSR で変換句のみを表示する。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/web/scripts/read-smoke.mjs
- apps/web/src/app/page.tsx
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/apps/web/scripts/read-smoke.mjs b/apps/web/scripts/read-smoke.mjs
index 55d889d..a4131e7 100644
--- a/apps/web/scripts/read-smoke.mjs
+++ b/apps/web/scripts/read-smoke.mjs
@@ -27,7 +27,10 @@ assert.equal(
   "write smoke must stay dependency-free",
 );
 
-assertIncludes(pageSource, 'import type { TimelineResponseDto } from "@tsukeai/shared";');
+assertIncludes(pageSource, "AuthorDto");
+assertIncludes(pageSource, "EntityId");
+assertIncludes(pageSource, "IsoDateTimeString");
+assertIncludes(pageSource, "TimelineResponseDto");
 assertIncludes(pageSource, 'import { getApiBaseUrl } from "../lib/api-base-url";');
 assertIncludes(pageSource, 'export const dynamic = "force-dynamic";');
 assertIncludes(pageSource, 'new URL("/api/timeline?limit=20", apiBaseUrl)');
@@ -46,9 +49,11 @@ assertIncludes(pageSource, 'aria-label="公開タイムライン"');
 assertIncludes(pageSource, '<li className="post-card"');
 assertIncludes(pageSource, 'aria-label="返信"');
 assertIncludes(pageSource, "{item.post.author.displayName}");
-assertIncludes(pageSource, "{item.post.body}");
+assertIncludes(pageSource, "{item.post.publicText}");
 assertIncludes(pageSource, "{reply.author.displayName}");
-assertIncludes(pageSource, "{reply.body}");
+assertIncludes(pageSource, "{reply.publicText}");
+assertIncludes(pageSource, "function toPublicTimeline");
+assertIncludes(pageSource, "conversion.publicText ?? conversion.body ??");
 
 assertIncludes(apiBaseUrlSource, 'const DEFAULT_API_BASE_URL = "http://localhost:8787";');
 assertIncludes(apiBaseUrlSource, "process.env.API_BASE_URL");
diff --git a/apps/web/src/app/page.tsx b/apps/web/src/app/page.tsx
index 0be98ac..3a87b9d 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -1,4 +1,9 @@
-import type { TimelineResponseDto } from "@tsukeai/shared";
+import type {
+  AuthorDto,
+  EntityId,
+  IsoDateTimeString,
+  TimelineResponseDto,
+} from "@tsukeai/shared";
 import { revalidatePath } from "next/cache";
 import { headers } from "next/headers";
 import { getApiBaseUrl } from "../lib/api-base-url";
@@ -8,13 +13,34 @@ export const dynamic = "force-dynamic";
 type TimelineResult =
   | {
       status: "ready";
-      timeline: TimelineResponseDto;
+      timeline: PublicTimeline;
     }
   | {
       status: "unavailable";
     };
 
 type TransformKind = "post_575" | "reply_77";
+type PublicTimeline = {
+  items: PublicTimelineItem[];
+  nextCursor?: string;
+};
+type PublicTimelineItem = {
+  post: PublicPost;
+  replies: PublicReply[];
+};
+type PublicPost = {
+  id: EntityId;
+  author: AuthorDto;
+  publicText: string;
+  createdAt: IsoDateTimeString;
+};
+type PublicReply = {
+  id: EntityId;
+  postId: EntityId;
+  author: AuthorDto;
+  publicText: string;
+  createdAt: IsoDateTimeString;
+};
 
 const WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED = process.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1";
 const WRITE_SMOKE_PUBLIC_TEXT = {
@@ -145,15 +171,39 @@ async function getPublicTimeline(apiBaseUrl: URL): Promise<TimelineResult> {
       return { status: "unavailable" };
     }
 
-    return {
-      status: "ready",
-      timeline: (await response.json()) as TimelineResponseDto,
-    };
+    const timeline = toPublicTimeline((await response.json()) as TimelineResponseDto);
+
+    return { status: "ready", timeline };
   } catch {
     return { status: "unavailable" };
   }
 }
 
+function toPublicTimeline(timeline: TimelineResponseDto): PublicTimeline {
+  return {
+    items: timeline.items.map((item) => ({
+      post: {
+        id: item.post.id,
+        author: item.post.author,
+        publicText: getPublicText(item.post),
+        createdAt: item.post.createdAt,
+      },
+      replies: item.replies.map((reply) => ({
+        id: reply.id,
+        postId: reply.postId,
+        author: reply.author,
+        publicText: getPublicText(reply),
+        createdAt: reply.createdAt,
+      })),
+    })),
+    ...(timeline.nextCursor ? { nextCursor: timeline.nextCursor } : {}),
+  };
+}
+
+function getPublicText(conversion: { publicText?: string; body?: string }) {
+  return conversion.publicText ?? conversion.body ?? "";
+}
+
 export default async function Home() {
   const apiBaseUrl = getApiBaseUrl();
   const timelineResult = await getPublicTimeline(apiBaseUrl);
@@ -208,7 +258,7 @@ export default async function Home() {
                 </form>
               </div>
 
-              <p className="post-card__body">{item.post.body}</p>
+              <p className="post-card__body">{item.post.publicText}</p>
 
               {item.replies.length > 0 ? (
                 <ul className="reply-list" aria-label="返信">
@@ -223,7 +273,7 @@ export default async function Home() {
                           </button>
                         </form>
                       </div>
-                      <p>{reply.body}</p>
+                      <p>{reply.publicText}</p>
                     </li>
                   ))}
                 </ul>
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index f992a5b..4058e0c 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -314,18 +314,26 @@ export type AuthorDto = {
   handle?: string;
 };
 
-export type PostDto = {
+export type PublicConversionTextDto =
+  | {
+      publicText: PublicTankaText;
+      body?: never;
+    }
+  | {
+      publicText?: never;
+      body: PublicTankaText;
+    };
+
+export type PostDto = PublicConversionTextDto & {
   id: EntityId;
   author: AuthorDto;
-  body: PublicTankaText;
   createdAt: IsoDateTimeString;
 };
 
-export type ReplyDto = {
+export type ReplyDto = PublicConversionTextDto & {
   id: EntityId;
   postId: EntityId;
   author: AuthorDto;
-  body: PublicTankaText;
   createdAt: IsoDateTimeString;
 };
 
@@ -360,6 +368,7 @@ export type BoundaryIsoDateTimeString = IsoDateTimeString;
 export type BoundaryTankaText = TankaText;
 export type BoundaryPublicTankaText = PublicTankaText;
 export type BoundaryAuthorDto = AuthorDto;
+export type BoundaryPublicConversionTextDto = PublicConversionTextDto;
 export type BoundaryPostDto = PostDto;
 export type BoundaryReplyDto = ReplyDto;
 export type BoundaryTimelineItemDto = TimelineItemDto;

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