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
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tanka-reply-sns/web@0.0.0 smoke:write /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.e2e-write/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/index.ts
- apps/web/package.json
- apps/web/scripts/read-smoke.mjs
- apps/web/src/app/globals.css
- apps/web/src/app/page.tsx
- apps/web/scripts/write-smoke.mjs

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 378534b..936838f 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -2,19 +2,21 @@ import { Hono } from "hono";
 import type { Context } from "hono";
 import { getCookie } from "hono/cookie";
 import { cors } from "hono/cors";
-import type {
-  ApiErrorCode,
-  ReplyDto,
-  TimelineItemDto,
-  TimelineResponseDto,
-  TransformFailureReason,
-  TransformJobDto,
-  TransformJobKind,
-  TransformJobResponseDto,
-  TransformJobState,
-  TransformPublicErrorCode,
-  TransformRetryPolicy,
-  TransformUserAction,
+import {
+  checkTransformForm,
+  type ApiErrorCode,
+  type PostDto,
+  type ReplyDto,
+  type TimelineItemDto,
+  type TimelineResponseDto,
+  type TransformFailureReason,
+  type TransformJobDto,
+  type TransformJobKind,
+  type TransformJobResponseDto,
+  type TransformJobState,
+  type TransformPublicErrorCode,
+  type TransformRetryPolicy,
+  type TransformUserAction,
 } from "@tanka-reply-sns/shared";
 import postgres from "postgres";
 import {
@@ -30,6 +32,7 @@ type Bindings = LlmAdapterBindings & {
   HYPERDRIVE: Hyperdrive;
   SESSION_COOKIE_NAME?: string;
   SESSION_SECRET?: string;
+  WRITE_SMOKE_FIXED_PUBLIC_TEXT?: string;
 };
 
 type AppContext = Context<{ Bindings: Bindings }>;
@@ -79,6 +82,19 @@ type DeletePublicConversionResult = {
   deleted_count: number;
 };
 
+type PublishedPostRow = {
+  id: string;
+  author_id: string;
+  author_display_name: string;
+  author_handle: string | null;
+  body: string;
+  created_at: string;
+};
+
+type PublishedReplyRow = PublishedPostRow & {
+  post_id: string;
+};
+
 type TransformJobRow = {
   id: string;
   account_id: string;
@@ -104,6 +120,7 @@ type TransformJobRequestBody = {
   kind?: unknown;
   input?: unknown;
   body?: unknown;
+  publicText?: unknown;
   parentPostId?: unknown;
   clientKey?: unknown;
 };
@@ -115,6 +132,13 @@ type TransformJobCreateInput = {
   parentPostId?: string;
 };
 
+type PublicTextCreateInput = {
+  kind: TransformJobKind;
+  publicText: string;
+  clientKey: string;
+  parentPostId?: string;
+};
+
 type SafeLogError = {
   name: string;
   code?: string;
@@ -459,6 +483,33 @@ function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
   };
 }
 
+function toPostDto(row: PublishedPostRow): PostDto {
+  return {
+    id: row.id,
+    author: {
+      id: row.author_id,
+      displayName: row.author_display_name,
+      ...(row.author_handle ? { handle: row.author_handle } : {}),
+    },
+    body: row.body,
+    createdAt: row.created_at,
+  };
+}
+
+function toReplyDto(row: PublishedReplyRow): ReplyDto {
+  return {
+    id: row.id,
+    postId: row.post_id,
+    author: {
+      id: row.author_id,
+      displayName: row.author_display_name,
+      ...(row.author_handle ? { handle: row.author_handle } : {}),
+    },
+    body: row.body,
+    createdAt: row.created_at,
+  };
+}
+
 async function selectTransformJob(
   sql: ReturnType<typeof createSql>,
   jobId: string,
@@ -1151,6 +1202,266 @@ function parseTransformJobInput(
   };
 }
 
+function parsePublicTextInput(
+  body: TransformJobRequestBody,
+  forcedInput: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
+  headerClientKey: string | undefined,
+): PublicTextCreateInput | undefined {
+  const publicText = body.publicText;
+  const clientKey = parseClientKey(body.clientKey, headerClientKey);
+  const parentPostId =
+    forcedInput.parentPostId ??
+    (typeof body.parentPostId === "string"
+      ? body.parentPostId.trim()
+      : undefined);
+
+  if (typeof publicText !== "string" || !clientKey) {
+    return undefined;
+  }
+
+  if (
+    forcedInput.kind === "reply_77" &&
+    (!parentPostId || !UUID_PATTERN.test(parentPostId))
+  ) {
+    return undefined;
+  }
+
+  if (forcedInput.kind === "post_575" && parentPostId !== undefined) {
+    return undefined;
+  }
+
+  const formCheck = checkTransformForm(forcedInput.kind, publicText);
+
+  if (!formCheck.accepted) {
+    return undefined;
+  }
+
+  return {
+    kind: forcedInput.kind,
+    publicText: formCheck.normalizedText,
+    clientKey,
+    ...(parentPostId ? { parentPostId } : {}),
+  };
+}
+
+async function publishPublicTextPost(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+  input: PublicTextCreateInput,
+): Promise<PostDto> {
+  const publicConversionId = crypto.randomUUID();
+  const threadId = crypto.randomUUID();
+  const sourceHash = await sha256Hex(input.publicText);
+
+  const row = await sql.begin(async (transaction) => {
+    await transaction`
+      insert into threads (id)
+      values (${threadId}::uuid)
+    `;
+
+    const [inserted] = await transaction<PublishedPostRow[]>`
+      insert into public_conversions (
+        id,
+        account_id,
+        thread_id,
+        parent_public_conversion_id,
+        kind,
+        public_text,
+        source_sha256
+      )
+      values (
+        ${publicConversionId}::uuid,
+        ${accountId}::uuid,
+        ${threadId}::uuid,
+        null,
+        'post',
+        ${input.publicText},
+        ${sourceHash}
+      )
+      returning
+        id::text,
+        account_id::text as author_id,
+        (
+          select display_name
+          from accounts
+          where id = ${accountId}::uuid and deleted_at is null
+        ) as author_display_name,
+        (
+          select handle
+          from accounts
+          where id = ${accountId}::uuid and deleted_at is null
+        ) as author_handle,
+        public_text as body,
+        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
+    `;
+
+    return inserted;
+  });
+
+  if (!row?.author_display_name) {
+    throw new Error("Post author not found.");
+  }
+
+  return toPostDto(row);
+}
+
+async function publishPublicTextReply(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+  input: PublicTextCreateInput,
+): Promise<ReplyDto | undefined> {
+  if (!input.parentPostId) {
+    return undefined;
+  }
+
+  const publicConversionId = crypto.randomUUID();
+  const sourceHash = await sha256Hex(input.publicText);
+
+  const row = await sql.begin(async (transaction) => {
+    const [parentPost] = await transaction<ReplyParentPostRow[]>`
+      select
+        p.id::text,
+        p.thread_id::text
+      from public_conversions p
+      join threads t on t.id = p.thread_id
+      where
+        p.id = ${input.parentPostId}::uuid
+        and p.kind = 'post'
+        and p.is_published = true
+        and p.deleted_at is null
+        and t.deleted_at is null
+    `;
+
+    if (!parentPost) {
+      return undefined;
+    }
+
+    const [inserted] = await transaction<PublishedReplyRow[]>`
+      insert into public_conversions (
+        id,
+        account_id,
+        thread_id,
+        parent_public_conversion_id,
+        kind,
+        public_text,
+        source_sha256
+      )
+      values (
+        ${publicConversionId}::uuid,
+        ${accountId}::uuid,
+        ${parentPost.thread_id}::uuid,
+        ${parentPost.id}::uuid,
+        'reply',
+        ${input.publicText},
+        ${sourceHash}
+      )
+      returning
+        id::text,
+        ${parentPost.id}::text as post_id,
+        account_id::text as author_id,
+        (
+          select display_name
+          from accounts
+          where id = ${accountId}::uuid and deleted_at is null
+        ) as author_display_name,
+        (
+          select handle
+          from accounts
+          where id = ${accountId}::uuid and deleted_at is null
+        ) as author_handle,
+        public_text as body,
+        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
+    `;
+
+    return inserted;
+  });
+
+  if (!row?.author_display_name) {
+    throw new Error("Reply author not found.");
+  }
+
+  return toReplyDto(row);
+}
+
+async function handleCreatePublicText(
+  c: AppContext,
+  forcedInput: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
+  body: TransformJobRequestBody,
+  accountId: string,
+) {
+  const parsed = parsePublicTextInput(
+    body,
+    forcedInput,
+    c.req.header("Idempotency-Key"),
+  );
+
+  if (!parsed) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message:
+            "Published write requests require valid publicText and an idempotency key.",
+        },
+      },
+      400,
+    );
+  }
+
+  let sql: ReturnType<typeof createSql> | undefined;
+
+  try {
+    sql = createSql(c.env.HYPERDRIVE.connectionString);
+
+    if (parsed.kind === "reply_77") {
+      const reply = await publishPublicTextReply(sql, accountId, parsed);
+
+      if (!reply) {
+        return c.json(
+          {
+            error: {
+              code: "not_found" satisfies ApiErrorCode,
+              message: "Parent post not found.",
+            },
+          },
+          404,
+        );
+      }
+
+      c.header("Cache-Control", "no-store");
+
+      return c.json({ reply }, 201);
+    }
+
+    const post = await publishPublicTextPost(sql, accountId, parsed);
+
+    c.header("Cache-Control", "no-store");
+
+    return c.json({ post }, 201);
+  } catch (error) {
+    console.error("Published write request failed", toSafeLogError(error));
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable" satisfies ApiErrorCode,
+          message: "Published text could not be saved.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error(
+        "Failed to close published write database client",
+        toSafeLogError(error),
+      );
+    }
+  }
+}
+
 async function handleCreateTransformJob(
   c: AppContext,
   forcedInput?: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
@@ -1187,6 +1498,22 @@ async function handleCreateTransformJob(
     );
   }
 
+  if (body.publicText !== undefined) {
+    if (forcedInput?.kind && c.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1") {
+      return handleCreatePublicText(c, forcedInput, body, accountId);
+    }
+
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message: "Published text writes are disabled.",
+        },
+      },
+      400,
+    );
+  }
+
   const parsed = parseTransformJobInput(
     {
       ...body,
diff --git a/apps/web/package.json b/apps/web/package.json
index fd39088..87e99dd 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -9,8 +9,9 @@
     "dev": "next dev",
     "lint": "pnpm --workspace-root exec biome check .",
     "smoke:read": "node scripts/read-smoke.mjs",
+    "smoke:write": "node scripts/write-smoke.mjs",
     "start": "next start",
-    "test": "pnpm run smoke:read",
+    "test": "WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write",
     "typecheck": "tsc --project tsconfig.json --noEmit"
   },
   "dependencies": {
diff --git a/apps/web/scripts/read-smoke.mjs b/apps/web/scripts/read-smoke.mjs
index 87aedd6..6f8244b 100644
--- a/apps/web/scripts/read-smoke.mjs
+++ b/apps/web/scripts/read-smoke.mjs
@@ -17,14 +17,19 @@ assert.equal(
 );
 assert.equal(
   webPackageJson.scripts?.test,
-  "pnpm run smoke:read",
-  "web test must run the read smoke",
+  "WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write",
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
index 94a8faf..2c6dd9f 100644
--- a/apps/web/src/app/page.tsx
+++ b/apps/web/src/app/page.tsx
@@ -1,4 +1,6 @@
 import type { TimelineResponseDto } from "@tanka-reply-sns/shared";
+import { revalidatePath } from "next/cache";
+import { headers } from "next/headers";
 import { getApiBaseUrl } from "../lib/api-base-url";
 
 export const dynamic = "force-dynamic";
@@ -12,6 +14,113 @@ type TimelineResult =
       status: "unavailable";
     };
 
+type TransformKind = "post_575" | "reply_77";
+
+const WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED =
+  process.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1";
+const WRITE_SMOKE_PUBLIC_TEXT = {
+  post_575: "あさひさす\nこころしずかに\nはるをまつ",
+  reply_77: "ほしをかぞえて\nよるがあけゆく",
+} as const satisfies Record<TransformKind, string>;
+
+async function createPost(formData: FormData) {
+  "use server";
+
+  await requestWrite("/api/posts", "post_575", formData);
+  revalidatePath("/");
+}
+
+async function createReply(postId: string, formData: FormData) {
+  "use server";
+
+  await requestWrite(`/api/posts/${postId}/replies`, "reply_77", formData);
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
+async function requestWrite(
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
+  const publicText = WRITE_SMOKE_FIXED_PUBLIC_TEXT_ENABLED
+    ? WRITE_SMOKE_PUBLIC_TEXT[kind]
+    : undefined;
+
+  await requestApi(path, {
+    method: "POST",
+    headers: {
+      "Content-Type": "application/json",
+      "Idempotency-Key": crypto.randomUUID(),
+    },
+    body: JSON.stringify(
+      publicText
+        ? {
+            publicText,
+            clientKey: crypto.randomUUID(),
+          }
+        : {
+            kind,
+            input,
+            clientKey: crypto.randomUUID(),
+          },
+    ),
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
+    let message = `API request failed with ${response.status}`;
+
+    try {
+      const body = (await response.json()) as {
+        error?: { message?: unknown };
+      };
+      const errorMessage = body.error?.message;
+
+      if (typeof errorMessage === "string" && errorMessage.length > 0) {
+        message = errorMessage;
+      }
+    } catch {
+      // Keep the status-only message when the API does not return JSON.
+    }
+
+    throw new Error(message);
+  }
+}
+
 async function getPublicTimeline(apiBaseUrl: URL): Promise<TimelineResult> {
   const timelineUrl = new URL("/api/timeline?limit=20", apiBaseUrl);
 
@@ -52,6 +161,18 @@ export default async function Home() {
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
@@ -76,6 +197,11 @@ export default async function Home() {
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
@@ -89,12 +215,36 @@ export default async function Home() {
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