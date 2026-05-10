# Review Task

Task ID: tc.gtssr
Title: GT の SSR 一覧・スレッド

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.gtssr

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
logs: $ npm test
skipped:
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_24_36_168Z-debug-0.log

## Changed Files
- apps/web/src/app/globals.css
- apps/web/src/app/page.tsx
- packages/shared/src/index.ts

## Unified Diff
```diff
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index b346f10..9045294 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -89,13 +89,15 @@ a {
   padding: 48px 0;
 }
 
-.hero {
+.timeline-page {
   display: grid;
-  gap: 28px;
+  gap: 24px;
 }
 
-.hero__copy {
-  max-width: 720px;
+.timeline-header {
+  display: grid;
+  gap: 18px;
+  max-width: 780px;
 }
 
 .eyebrow {
@@ -108,8 +110,8 @@ a {
 h1 {
   max-width: 760px;
   margin: 0;
-  font-size: 72px;
-  line-height: 0.98;
+  font-size: 56px;
+  line-height: 1.04;
 }
 
 .lead {
@@ -120,40 +122,66 @@ h1 {
   line-height: 1.7;
 }
 
-.timeline-preview {
+.timeline-list {
   display: grid;
-  grid-template-columns: repeat(3, minmax(0, 1fr));
   gap: 16px;
 }
 
 .post-card {
-  min-height: 180px;
-  padding: 20px;
+  padding: 22px;
   border: 1px solid var(--line);
   border-radius: 8px;
   background: var(--panel);
-  display: flex;
-  flex-direction: column;
-  justify-content: space-between;
+  display: grid;
   gap: 18px;
 }
 
-.post-card p {
+.post-card__header,
+.reply__header {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: center;
+  gap: 8px;
+  color: var(--muted);
+  font-size: 14px;
+}
+
+.post-card__header strong,
+.reply__header strong {
+  color: var(--foreground);
+}
+
+.post-card__body,
+.reply p {
   margin: 0;
   line-height: 1.65;
 }
 
-.post-card small {
-  color: var(--muted);
+.post-card__body {
+  font-size: 20px;
+}
+
+.reply-list {
+  display: grid;
+  gap: 14px;
+  padding-top: 16px;
+  border-top: 1px solid var(--line);
+}
+
+.reply {
+  display: grid;
+  gap: 8px;
+  padding-left: 14px;
+  border-left: 3px solid #b7d4d0;
 }
 
-.system-strip {
-  padding: 14px 16px;
+.timeline-status {
+  margin: 0;
+  padding: 18px;
   border: 1px solid var(--line);
   border-radius: 8px;
-  background: #edf5f3;
-  color: var(--accent-strong);
-  font-size: 14px;
+  background: var(--panel);
+  color: var(--muted);
 }
 
 @media (max-width: 720px) {
@@ -174,11 +202,7 @@ h1 {
   }
 
   h1 {
-    font-size: 40px;
+    font-size: 38px;
     line-height: 1.05;
   }
-
-  .timeline-preview {
-    grid-template-columns: 1fr;
-  }
 }
diff --git a/apps/web/src/app/page.tsx b/apps/web/src/app/page.tsx
index 0f92a94..3fbc36d 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -1,47 +1,104 @@
+import type { TimelineResponseDto } from "@tanka-reply-sns/shared";
 import { getApiBaseUrl } from "../lib/api-base-url";
 
 export const dynamic = "force-dynamic";
 
-const previewPosts = [
-  {
-    body: "雨上がり 画面の奥で 返歌待つ",
-    meta: "公開タイムライン",
-  },
-  {
-    body: "ひとことを 五七五七七に ほどきなおす",
-    meta: "SSR shell",
-  },
-  {
-    body: "朝の窓 API の向こう 息をする",
-    meta: "API ready",
-  },
-];
-
-export default function Home() {
+type TimelineResult =
+  | {
+      status: "ready";
+      timeline: TimelineResponseDto;
+    }
+  | {
+      status: "unavailable";
+    };
+
+async function getPublicTimeline(apiBaseUrl: URL): Promise<TimelineResult> {
+  const timelineUrl = new URL("/api/timeline?limit=20", apiBaseUrl);
+
+  try {
+    const response = await fetch(timelineUrl, {
+      headers: {
+        Accept: "application/json",
+      },
+      cache: "no-store",
+    });
+
+    if (!response.ok) {
+      return { status: "unavailable" };
+    }
+
+    return {
+      status: "ready",
+      timeline: (await response.json()) as TimelineResponseDto,
+    };
+  } catch {
+    return { status: "unavailable" };
+  }
+}
+
+export default async function Home() {
   const apiBaseUrl = getApiBaseUrl();
+  const timelineResult = await getPublicTimeline(apiBaseUrl);
 
   return (
-    <section className="hero" aria-labelledby="page-title">
-      <div className="hero__copy">
-        <p className="eyebrow">公開閲覧 / SSR</p>
-        <h1 id="page-title">短歌で返信するタイムライン</h1>
+    <section className="timeline-page" aria-labelledby="page-title">
+      <header className="timeline-header">
+        <div>
+          <p className="eyebrow">公開閲覧 / SSR</p>
+          <h1 id="page-title">公開タイムライン</h1>
+        </div>
         <p className="lead">
-          未ログインでも読める公開ビューを、Next.js App Router のサーバーコンポーネントで描画します。
+          変換済みの公開句だけをサーバーで取得して表示します。
         </p>
-      </div>
-
-      <div className="system-strip">
-        API base URL is read on the server: <strong>{apiBaseUrl.href}</strong>
-      </div>
-
-      <div className="timeline-preview" aria-label="タイムラインのプレビュー">
-        {previewPosts.map((post) => (
-          <article className="post-card" key={post.body}>
-            <p>{post.body}</p>
-            <small>{post.meta}</small>
-          </article>
-        ))}
-      </div>
+      </header>
+
+      {timelineResult.status === "unavailable" ? (
+        <p className="timeline-status" role="status">
+          タイムラインを読み込めませんでした。
+        </p>
+      ) : timelineResult.timeline.items.length === 0 ? (
+        <p className="timeline-status" role="status">
+          まだ公開句はありません。
+        </p>
+      ) : (
+        <div className="timeline-list" aria-label="公開タイムライン">
+          {timelineResult.timeline.items.map((item) => (
+            <article className="post-card" key={item.post.id}>
+              <div className="post-card__header">
+                <strong>{item.post.author.displayName}</strong>
+                {item.post.author.handle ? (
+                  <span>@{item.post.author.handle}</span>
+                ) : null}
+                <time dateTime={item.post.createdAt}>
+                  {new Intl.DateTimeFormat("ja-JP", {
+                    dateStyle: "medium",
+                    timeStyle: "short",
+                    timeZone: "Asia/Tokyo",
+                  }).format(new Date(item.post.createdAt))}
+                </time>
+              </div>
+
+              <p className="post-card__body">{item.post.body}</p>
+
+              {item.replies.length > 0 ? (
+                <div className="reply-list" aria-label="返信">
+                  {item.replies.map((reply) => (
+                    <section className="reply" key={reply.id}>
+                      <div className="reply__header">
+                        <strong>{reply.author.displayName}</strong>
+                        {reply.author.handle ? (
+                          <span>@{reply.author.handle}</span>
+                        ) : null}
+                      </div>
+                      <p>{reply.body}</p>
+                    </section>
+                  ))}
+                </div>
+              ) : null}
+            </article>
+          ))}
+        </div>
+      )}
     </section>
   );
 }
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index 5d9e76a..514b7f4 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -1,4 +1,5 @@
 export type TankaText = string;
+export type PublicTankaText = TankaText;
 
 export type EntityId = string;
 export type IsoDateTimeString = string;
@@ -38,7 +39,7 @@ export type AuthorDto = {
 export type PostDto = {
   id: EntityId;
   author: AuthorDto;
-  body: TankaText;
+  body: PublicTankaText;
   createdAt: IsoDateTimeString;
 };
 
@@ -46,7 +47,7 @@ export type ReplyDto = {
   id: EntityId;
   postId: EntityId;
   author: AuthorDto;
-  body: TankaText;
+  body: PublicTankaText;
   createdAt: IsoDateTimeString;
 };
 

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