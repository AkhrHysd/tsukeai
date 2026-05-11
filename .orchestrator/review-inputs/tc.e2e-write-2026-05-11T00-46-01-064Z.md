# Review Task

Task ID: tc.e2e-write
Title: Playwright 書き込みスモーク

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write

## Description
投稿・返信・削除のクリティカルパス。変換経路確定後。

## Allowed Paths
- apps/web
- .

## Acceptance Criteria
- 書き込みスモークがパスし CI が LLM に依存しない。

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

> tanka-reply-sns@0.0.0 test
> pnpm --filter @tanka-reply-sns/web test


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write/apps/web
> pnpm run smoke:read && pnpm run smoke:write


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tanka-reply-sns/web@0.0.0 smoke:write /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- apps/web/package.json
- apps/web/scripts/read-smoke.mjs
- apps/web/src/app/globals.css
- apps/web/src/app/page.tsx
- apps/web/scripts/write-smoke.mjs

## Unified Diff
```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index fd39088..846e196 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -9,8 +9,9 @@
     "dev": "next dev",
     "lint": "pnpm --workspace-root exec biome check .",
     "smoke:read": "node scripts/read-smoke.mjs",
+    "smoke:write": "node scripts/write-smoke.mjs",
     "start": "next start",
-    "test": "pnpm run smoke:read",
+    "test": "pnpm run smoke:read && pnpm run smoke:write",
     "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {
diff --git a/apps/web/scripts/read-smoke.mjs b/apps/web/scripts/read-smoke.mjs
index 87aedd6..bb2415f 100644
--- a/apps/web/scripts/read-smoke.mjs
+++ b/apps/web/scripts/read-smoke.mjs
@@ -17,14 +17,19 @@ assert.equal(
 );
 assert.equal(
   webPackageJson.scripts?.test,
-  "pnpm run smoke:read",
-  "web test must run the read smoke",
+  "pnpm run smoke:read && pnpm run smoke:write",
+  "web test must run read and write smokes",
 );
 assert.equal(
   webPackageJson.scripts?.["smoke:read"],
   "node scripts/read-smoke.mjs",
   "read smoke must stay dependency-free",
 );
+assert.equal(
+  webPackageJson.scripts?.["smoke:write"],
+  "node scripts/write-smoke.mjs",
+  "write smoke must stay dependency-free",
+);
 
 assertIncludes(
   pageSource,
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index 9045294..cf5fc50 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -127,6 +127,44 @@ h1 {
   gap: 16px;
 }
 
+.composer {
+  display: grid;
+  gap: 10px;
+  padding: 18px;
+  border: 1px solid var(--line);
+  border-radius: 8px;
+  background: var(--panel);
+}
+
+.composer label,
+.reply-form label {
+  font-weight: 700;
+}
+
+.composer textarea,
+.reply-form input {
+  width: 100%;
+  border: 1px solid var(--line);
+  border-radius: 6px;
+  padding: 10px 12px;
+  color: var(--foreground);
+  font: inherit;
+  line-height: 1.5;
+}
+
+.composer button,
+.reply-form button {
+  justify-self: start;
+  border: 0;
+  border-radius: 6px;
+  padding: 10px 16px;
+  background: var(--accent);
+  color: #ffffff;
+  font: inherit;
+  font-weight: 700;
+  cursor: pointer;
+}
+
 .post-card {
   padding: 22px;
   border: 1px solid var(--line);
@@ -146,11 +184,25 @@ h1 {
   font-size: 14px;
 }
 
+.post-card__header form,
+.reply__header form {
+  margin-left: auto;
+}
+
 .post-card__header strong,
 .reply__header strong {
   color: var(--foreground);
 }
 
+.link-button {
+  border: 0;
+  background: transparent;
+  color: var(--accent-strong);
+  font: inherit;
+  font-weight: 700;
+  cursor: pointer;
+}
+
 .post-card__body,
 .reply p {
   margin: 0;
@@ -175,6 +227,18 @@ h1 {
   border-left: 3px solid #b7d4d0;
 }
 
+.reply-form {
+  display: grid;
+  gap: 8px;
+  padding-top: 4px;
+}
+
+.reply-form div {
+  display: grid;
+  grid-template-columns: 1fr auto;
+  gap: 8px;
+}
+
 .timeline-status {
   margin: 0;
   padding: 18px;
@@ -205,4 +269,8 @@ h1 {
     font-size: 38px;
     line-height: 1.05;
   }
+
+  .reply-form div {
+    grid-template-columns: 1fr;
+  }
 }
diff --git a/apps/web/src/app/page.tsx b/apps/web/src/app/page.tsx
index 94a8faf..4d5eced 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -1,4 +1,6 @@
 import type { TimelineResponseDto } from "@tanka-reply-sns/shared";
+import { revalidatePath } from "next/cache";
+import { headers } from "next/headers";
 import { getApiBaseUrl } from "../lib/api-base-url";
 
 export const dynamic = "force-dynamic";
@@ -12,6 +14,80 @@ type TimelineResult =
       status: "unavailable";
     };
 
+type TransformKind = "post_575" | "reply_77";
+
+async function createPost(formData: FormData) {
+  "use server";
+
+  await requestTransform("/api/posts", "post_575", formData);
+  revalidatePath("/");
+}
+
+async function createReply(postId: string, formData: FormData) {
+  "use server";
+
+  await requestTransform(`/api/posts/${postId}/replies`, "reply_77", formData);
+  revalidatePath("/");
+}
+
+async function deletePublicConversion(publicConversionId: string) {
+  "use server";
+
+  await requestApi(`/api/public-conversions/${publicConversionId}`, {
+    method: "DELETE",
+  });
+  revalidatePath("/");
+}
+
+async function requestTransform(
+  path: string,
+  kind: TransformKind,
+  formData: FormData,
+) {
+  const input = formData.get("body");
+
+  if (typeof input !== "string" || input.trim().length === 0) {
+    return;
+  }
+
+  await requestApi(path, {
+    method: "POST",
+    headers: {
+      "Content-Type": "application/json",
+      "Idempotency-Key": crypto.randomUUID(),
+    },
+    body: JSON.stringify({
+      kind,
+      input,
+      clientKey: crypto.randomUUID(),
+    }),
+  });
+}
+
+async function requestApi(path: string, init: RequestInit) {
+  const apiBaseUrl = getApiBaseUrl();
+  const url = new URL(path, apiBaseUrl);
+  const requestHeaders = await headers();
+  const cookie = requestHeaders.get("cookie");
+  const headersInit = new Headers(init.headers);
+
+  headersInit.set("Accept", "application/json");
+
+  if (cookie) {
+    headersInit.set("Cookie", cookie);
+  }
+
+  const response = await fetch(url, {
+    ...init,
+    headers: headersInit,
+    cache: "no-store",
+  });
+
+  if (!response.ok) {
+    return;
+  }
+}
+
 async function getPublicTimeline(apiBaseUrl: URL): Promise<TimelineResult> {
   const timelineUrl = new URL("/api/timeline?limit=20", apiBaseUrl);
 
@@ -52,6 +128,18 @@ export default async function Home() {
         </p>
       </header>
 
+      <form className="composer" action={createPost} aria-label="投稿">
+        <label htmlFor="post-body">投稿する</label>
+        <textarea
+          id="post-body"
+          name="body"
+          rows={3}
+          required
+          placeholder="五七五に変換したい内容"
+        />
+        <button type="submit">投稿</button>
+      </form>
+
       {timelineResult.status === "unavailable" ? (
         <p className="timeline-status" role="status">
           タイムラインを読み込めませんでした。
@@ -76,6 +164,11 @@ export default async function Home() {
                     timeZone: "Asia/Tokyo",
                   }).format(new Date(item.post.createdAt))}
                 </time>
+                <form action={deletePublicConversion.bind(null, item.post.id)}>
+                  <button className="link-button" type="submit">
+                    削除
+                  </button>
+                </form>
               </div>
 
               <p className="post-card__body">{item.post.body}</p>
@@ -89,12 +182,36 @@ export default async function Home() {
                         {reply.author.handle ? (
                           <span>@{reply.author.handle}</span>
                         ) : null}
+                        <form
+                          action={deletePublicConversion.bind(null, reply.id)}
+                        >
+                          <button className="link-button" type="submit">
+                            削除
+                          </button>
+                        </form>
                       </div>
                       <p>{reply.body}</p>
                     </section>
                   ))}
                 </div>
               ) : null}
+
+              <form
+                className="reply-form"
+                action={createReply.bind(null, item.post.id)}
+                aria-label="返信"
+              >
+                <label htmlFor={`reply-body-${item.post.id}`}>返信する</label>
+                <div>
+                  <input
+                    id={`reply-body-${item.post.id}`}
+                    name="body"
+                    required
+                    placeholder="七七に変換したい内容"
+                  />
+                  <button type="submit">返信</button>
+                </div>
+              </form>
             </article>
           ))}
         </div>

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