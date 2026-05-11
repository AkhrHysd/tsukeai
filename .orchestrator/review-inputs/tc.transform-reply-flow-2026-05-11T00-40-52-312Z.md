# Review Task

Task ID: tc.transform-reply-flow
Title: 返信変換フロー実装候補

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-reply-flow

## Description
対称型 7-7。投稿フローと独立レビュー可能なら分割維持。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 返信パイプラインが対称型方針と一致する。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-reply-flow/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-reply-flow/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index b78d806..378534b 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -109,9 +109,10 @@ type TransformJobRequestBody = {
 };
 
 type TransformJobCreateInput = {
-  kind: "post_575";
+  kind: TransformJobKind;
   input: string;
   clientKey: string;
+  parentPostId?: string;
 };
 
 type SafeLogError = {
@@ -119,6 +120,11 @@ type SafeLogError = {
   code?: string;
 };
 
+type ReplyParentPostRow = {
+  id: string;
+  thread_id: string;
+};
+
 const LOCAL_WEB_ORIGIN = "http://localhost:3000";
 const DEFAULT_SESSION_COOKIE_NAME = "__Host-tanka_session";
 const DEFAULT_TIMELINE_LIMIT = 20;
@@ -130,6 +136,7 @@ const PROCESSING_STALE_AFTER_SECONDS = 90;
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
 const PUBLIC_TIMELINE_CACHE_CONTROL = "no-store";
+const NIL_UUID = "00000000-0000-0000-0000-000000000000";
 const UUID_PATTERN =
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const HEALTH_RESPONSE: HealthResponse = {
@@ -359,6 +366,11 @@ function toTransformJobDto(row: TransformJobRow): TransformJobDto {
     row.kind === "post_575"
       ? { publishedPostId: row.public_conversion_id }
       : {}),
+    ...(row.state === "succeeded" &&
+    row.public_conversion_id &&
+    row.kind === "reply_77"
+      ? { publishedReplyId: row.public_conversion_id }
+      : {}),
     ...(row.error_code &&
     row.failure_reason &&
     row.user_action &&
@@ -511,6 +523,8 @@ async function selectTransformJobByScope(
   input: TransformJobCreateInput,
   inputHash: string,
 ): Promise<TransformJobRow | undefined> {
+  const parentPostId = input.parentPostId ?? NIL_UUID;
+
   const [row] = await sql<TransformJobRow[]>`
     select
       id::text,
@@ -535,7 +549,8 @@ async function selectTransformJobByScope(
     where
       account_id = ${accountId}::uuid
       and kind = ${input.kind}
-      and parent_public_conversion_id is null
+      and coalesce(parent_public_conversion_id, ${NIL_UUID}::uuid) =
+        ${parentPostId}::uuid
       and input_sha256 = ${inputHash}
       and client_key = ${input.clientKey}
   `;
@@ -551,6 +566,7 @@ async function createOrJoinTransformJob(
 ): Promise<TransformJobRow | undefined> {
   return sql.begin(async (transaction) => {
     const jobId = crypto.randomUUID();
+    const parentPostId = input.parentPostId ?? null;
     const [row] = await transaction<TransformJobRow[]>`
       insert into transform_jobs (
         id,
@@ -565,7 +581,7 @@ async function createOrJoinTransformJob(
         ${jobId}::uuid,
         ${accountId}::uuid,
         ${input.kind},
-        null,
+        ${parentPostId}::uuid,
         ${inputHash},
         ${input.clientKey},
         'queued'
@@ -645,7 +661,28 @@ async function claimRunnableTransformJob(
   return row;
 }
 
-async function publishTransformJob(
+async function selectReplyParentPost(
+  sql: ReturnType<typeof createSql>,
+  parentPostId: string,
+): Promise<ReplyParentPostRow | undefined> {
+  const [row] = await sql<ReplyParentPostRow[]>`
+    select
+      p.id::text,
+      p.thread_id::text
+    from public_conversions p
+    join threads t on t.id = p.thread_id
+    where
+      p.id = ${parentPostId}::uuid
+      and p.kind = 'post'
+      and p.is_published = true
+      and p.deleted_at is null
+      and t.deleted_at is null
+  `;
+
+  return row;
+}
+
+async function publishPostTransformJob(
   sql: ReturnType<typeof createSql>,
   job: TransformJobRow,
   publicText: string,
@@ -719,6 +756,125 @@ async function publishTransformJob(
   });
 }
 
+async function publishReplyTransformJob(
+  sql: ReturnType<typeof createSql>,
+  job: TransformJobRow,
+  publicText: string,
+  model: string,
+  attempts: number,
+  durationMs: number,
+): Promise<TransformJobRow | undefined> {
+  if (!job.parent_public_conversion_id) {
+    return undefined;
+  }
+
+  return sql.begin(async (transaction) => {
+    const [parentPost] = await transaction<ReplyParentPostRow[]>`
+      select
+        p.id::text,
+        p.thread_id::text
+      from public_conversions p
+      join threads t on t.id = p.thread_id
+      where
+        p.id = ${job.parent_public_conversion_id}::uuid
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
+    const publicConversionId = crypto.randomUUID();
+
+    await transaction`
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
+        ${job.account_id}::uuid,
+        ${parentPost.thread_id}::uuid,
+        ${parentPost.id}::uuid,
+        'reply',
+        ${publicText},
+        ${job.input_sha256}
+      )
+    `;
+
+    const [row] = await transaction<TransformJobRow[]>`
+      update transform_jobs
+      set
+        state = 'succeeded',
+        public_conversion_id = ${publicConversionId}::uuid,
+        attempts = ${attempts},
+        duration_ms = ${durationMs},
+        estimated_cost_micros = 0,
+        model = ${model},
+        updated_at = now()
+      where id = ${job.id}::uuid
+      returning
+        id::text,
+        account_id::text,
+        kind,
+        parent_public_conversion_id::text,
+        input_sha256,
+        client_key,
+        state,
+        public_conversion_id::text,
+        error_code,
+        failure_reason,
+        user_action,
+        retry_policy,
+        attempts,
+        duration_ms,
+        estimated_cost_micros::int as estimated_cost_micros,
+        model,
+        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
+        to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
+    `;
+
+    return row;
+  });
+}
+
+async function publishTransformJob(
+  sql: ReturnType<typeof createSql>,
+  job: TransformJobRow,
+  publicText: string,
+  model: string,
+  attempts: number,
+  durationMs: number,
+): Promise<TransformJobRow | undefined> {
+  if (job.kind === "reply_77") {
+    return publishReplyTransformJob(
+      sql,
+      job,
+      publicText,
+      model,
+      attempts,
+      durationMs,
+    );
+  }
+
+  return publishPostTransformJob(
+    sql,
+    job,
+    publicText,
+    model,
+    attempts,
+    durationMs,
+  );
+}
+
 async function markTransformJobFailed(
   sql: ReturnType<typeof createSql>,
   jobId: string,
@@ -786,8 +942,7 @@ async function runTransformJob(
       jobId: claimedJob.id,
       remainingCallBudget: 3,
     });
-
-    return publishTransformJob(
+    const publishedJob = await publishTransformJob(
       sql,
       claimedJob,
       transformed.text,
@@ -795,6 +950,18 @@ async function runTransformJob(
       transformed.attempts,
       transformed.durationMs,
     );
+
+    if (!publishedJob) {
+      throw new LlmAdapterError(
+        "provider_unavailable",
+        "Transform result could not be published.",
+        true,
+        transformed.attempts,
+        transformed.model,
+      );
+    }
+
+    return publishedJob;
   } catch (error) {
     const adapterError =
       error instanceof LlmAdapterError
@@ -952,12 +1119,27 @@ function parseTransformJobInput(
   const kind = body.kind;
   const input = body.input ?? body.body;
   const clientKey = parseClientKey(body.clientKey, headerClientKey);
+  const parentPostId =
+    typeof body.parentPostId === "string"
+      ? body.parentPostId.trim()
+      : undefined;
+
+  if (
+    (kind !== "post_575" && kind !== "reply_77") ||
+    typeof input !== "string" ||
+    !clientKey
+  ) {
+    return undefined;
+  }
 
-  if (kind !== "post_575" || typeof input !== "string" || !clientKey) {
+  if (kind === "post_575" && body.parentPostId !== undefined) {
     return undefined;
   }
 
-  if (body.parentPostId !== undefined) {
+  if (
+    kind === "reply_77" &&
+    (!parentPostId || !UUID_PATTERN.test(parentPostId))
+  ) {
     return undefined;
   }
 
@@ -965,12 +1147,13 @@ function parseTransformJobInput(
     kind,
     input,
     clientKey,
+    ...(parentPostId ? { parentPostId } : {}),
   };
 }
 
 async function handleCreateTransformJob(
   c: AppContext,
-  forcedKind?: "post_575",
+  forcedInput?: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
 ) {
   const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
   const accountId = await getSessionAccountId(
@@ -1007,7 +1190,10 @@ async function handleCreateTransformJob(
   const parsed = parseTransformJobInput(
     {
       ...body,
-      ...(forcedKind ? { kind: forcedKind } : {}),
+      ...(forcedInput?.kind ? { kind: forcedInput.kind } : {}),
+      ...(forcedInput?.parentPostId
+        ? { parentPostId: forcedInput.parentPostId }
+        : {}),
     },
     c.req.header("Idempotency-Key"),
   );
@@ -1018,7 +1204,7 @@ async function handleCreateTransformJob(
         error: {
           code: "bad_request" satisfies ApiErrorCode,
           message:
-            "Transform requests require kind, input or body, and an idempotency key.",
+            "Transform requests require kind, input or body, parentPostId for replies, and an idempotency key.",
         },
       },
       400,
@@ -1029,6 +1215,26 @@ async function handleCreateTransformJob(
 
   try {
     sql = createSql(c.env.HYPERDRIVE.connectionString);
+
+    if (parsed.kind === "reply_77") {
+      const parentPost =
+        parsed.parentPostId === undefined
+          ? undefined
+          : await selectReplyParentPost(sql, parsed.parentPostId);
+
+      if (!parentPost) {
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
+    }
+
     const inputHash = await sha256Hex(parsed.input);
     const existingJob = await selectTransformJobByScope(
       sql,
@@ -1253,7 +1459,14 @@ app.post("/api/transform-jobs", (c) => {
 });
 
 app.post("/api/posts", (c) => {
-  return handleCreateTransformJob(c, "post_575");
+  return handleCreateTransformJob(c, { kind: "post_575" });
+});
+
+app.post("/api/posts/:postId/replies", (c) => {
+  return handleCreateTransformJob(c, {
+    kind: "reply_77",
+    parentPostId: c.req.param("postId"),
+  });
 });
 
 app.get("/api/transform-jobs/:id", async (c) => {

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