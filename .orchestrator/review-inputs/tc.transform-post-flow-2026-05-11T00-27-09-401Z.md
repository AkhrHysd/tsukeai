# Review Task

Task ID: tc.transform-post-flow
Title: 投稿変換フロー実装候補

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-post-flow

## Description
素→5-7-5。パイプライン詳細は ADR へ合わせる。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 投稿パイプラインが ADR とポリシーに一致する。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-post-flow/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.transform-post-flow/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/MIGRATIONS.md
- apps/api/src/index.ts
- apps/api/src/llm-adapter.ts
- apps/api/migrations/0002_transform_jobs.sql

## Unified Diff
```diff
diff --git a/apps/api/MIGRATIONS.md b/apps/api/MIGRATIONS.md
index 25eac11..1ffb6b5 100644
--- a/apps/api/MIGRATIONS.md
+++ b/apps/api/MIGRATIONS.md
@@ -6,13 +6,15 @@ database URL kept outside the repository; the Worker still reads through the
 
 ## Minimal Entities
 
-`0001_minimal_entities.sql` creates:
+The current migration set creates:
 
 - `accounts`: minimum owner identity for writes and later self-delete checks.
 - `threads`: the public thread container used by GT and thread reads.
 - `public_conversions`: only the public transformed text, ownership,
   post/reply kind, thread parent relation, optional source hash, and publish or
   delete state. Raw source text is not persisted.
+- `transform_jobs`: transform state, idempotency scope, public result link,
+  sanitized failure classification, and observation metadata.
 - `schema_migrations`: applied migration versions and checksums.
 
 ## Apply
@@ -46,6 +48,7 @@ where schemaname = 'public'
     'accounts',
     'threads',
     'public_conversions',
+    'transform_jobs',
     'schema_migrations'
   )
 order by tablename;
@@ -58,6 +61,7 @@ accounts
 public_conversions
 schema_migrations
 threads
+transform_jobs
 ```
 
 Then confirm the Worker can still reach the database through Hyperdrive:
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index e9bf4f4..4622048 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1,13 +1,29 @@
 import { Hono } from "hono";
+import type { Context } from "hono";
 import { getCookie } from "hono/cookie";
 import { cors } from "hono/cors";
 import type {
+  ApiErrorCode,
   ReplyDto,
   TimelineItemDto,
   TimelineResponseDto,
+  TransformFailureReason,
+  TransformJobDto,
+  TransformJobKind,
+  TransformJobResponseDto,
+  TransformJobState,
+  TransformPublicErrorCode,
+  TransformRetryPolicy,
+  TransformUserAction,
 } from "@tanka-reply-sns/shared";
 import postgres from "postgres";
-import type { LlmAdapterBindings } from "./llm-adapter";
+import {
+  classifyTransformFailure,
+  createLlmAdapter,
+  LlmAdapterError,
+  type LlmAdapterBindings,
+  type TransformFailureClassification,
+} from "./llm-adapter";
 
 type Bindings = LlmAdapterBindings & {
   API_ALLOWED_ORIGINS?: string;
@@ -16,6 +32,8 @@ type Bindings = LlmAdapterBindings & {
   SESSION_SECRET?: string;
 };
 
+type AppContext = Context<{ Bindings: Bindings }>;
+
 type HealthResponse = {
   status: "ok";
   service: "api";
@@ -61,6 +79,47 @@ type DeletePublicConversionResult = {
   deleted_count: number;
 };
 
+type TransformJobRow = {
+  id: string;
+  account_id: string;
+  kind: TransformJobKind;
+  parent_public_conversion_id: string | null;
+  input_sha256: string;
+  client_key: string;
+  state: TransformJobState;
+  public_conversion_id: string | null;
+  error_code: TransformPublicErrorCode | null;
+  failure_reason: TransformFailureReason | null;
+  user_action: TransformUserAction | null;
+  retry_policy: TransformRetryPolicy | null;
+  attempts: number;
+  duration_ms: number | null;
+  estimated_cost_micros: number | null;
+  model: string | null;
+  created_at: string;
+  updated_at: string;
+};
+
+type ParentPostRow = {
+  id: string;
+  thread_id: string;
+};
+
+type TransformJobRequestBody = {
+  kind?: unknown;
+  input?: unknown;
+  body?: unknown;
+  parentPostId?: unknown;
+  clientKey?: unknown;
+};
+
+type TransformJobCreateInput = {
+  kind: TransformJobKind;
+  input: string;
+  parentPostId?: string;
+  clientKey: string;
+};
+
 type SafeLogError = {
   name: string;
   code?: string;
@@ -70,6 +129,8 @@ const LOCAL_WEB_ORIGIN = "http://localhost:3000";
 const DEFAULT_SESSION_COOKIE_NAME = "__Host-tanka_session";
 const DEFAULT_TIMELINE_LIMIT = 20;
 const MAX_TIMELINE_LIMIT = 50;
+const MAX_CLIENT_KEY_LENGTH = 128;
+const MAX_TRANSFORM_JOBS_PER_HOUR = 20;
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
 const PUBLIC_TIMELINE_CACHE_CONTROL = "no-store";
@@ -252,6 +313,83 @@ async function getSessionAccountId(
   return signaturesMatch(signature, expectedSignature) ? accountId : undefined;
 }
 
+async function sha256Hex(value: string): Promise<string> {
+  const hash = await crypto.subtle.digest(
+    "SHA-256",
+    new TextEncoder().encode(value),
+  );
+
+  return Array.from(new Uint8Array(hash))
+    .map((byte) => byte.toString(16).padStart(2, "0"))
+    .join("");
+}
+
+function toRetryPolicy(
+  classification: TransformFailureClassification,
+): TransformRetryPolicy {
+  return classification.retryable ? "server_retryable" : "client_revisable";
+}
+
+function toTransformJobDto(row: TransformJobRow): TransformJobDto {
+  const dto: TransformJobDto = {
+    id: row.id,
+    kind: row.kind,
+    state: row.state,
+    idempotency: {
+      userId: row.account_id,
+      kind: row.kind,
+      ...(row.parent_public_conversion_id
+        ? { parentPostId: row.parent_public_conversion_id }
+        : {}),
+      inputHash: row.input_sha256,
+      clientKey: row.client_key,
+    },
+    observation: {
+      jobId: row.id,
+      state: row.state,
+      ...(row.failure_reason ? { reason: row.failure_reason } : {}),
+      attempts: row.attempts,
+      ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
+      ...(row.estimated_cost_micros !== null
+        ? { estimatedCostMicros: row.estimated_cost_micros }
+        : {}),
+      ...(row.model ? { model: row.model } : {}),
+      inputHash: row.input_sha256,
+      createdAt: row.created_at,
+      updatedAt: row.updated_at,
+    },
+    ...(row.state === "succeeded" &&
+    row.public_conversion_id &&
+    row.kind === "post_575"
+      ? { publishedPostId: row.public_conversion_id }
+      : {}),
+    ...(row.state === "succeeded" &&
+    row.public_conversion_id &&
+    row.kind === "reply_77"
+      ? { publishedReplyId: row.public_conversion_id }
+      : {}),
+    ...(row.error_code &&
+    row.failure_reason &&
+    row.user_action &&
+    row.retry_policy
+      ? {
+          error: {
+            code: row.error_code,
+            reason: row.failure_reason,
+            message:
+              row.error_code === "transform_failed"
+                ? "The transform could not be completed. Please retry later."
+                : "The input could not be transformed. Please revise it.",
+            retryPolicy: row.retry_policy,
+            userAction: row.user_action,
+          },
+        }
+      : {}),
+  };
+
+  return dto;
+}
+
 function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
   const itemsByPostId = new Map<string, TimelineItemDto>();
   let lastPostCursor: TimelineCursor | undefined;
@@ -318,6 +456,679 @@ function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
   };
 }
 
+async function selectTransformJob(
+  sql: ReturnType<typeof createSql>,
+  jobId: string,
+): Promise<TransformJobRow | undefined> {
+  const [row] = await sql<TransformJobRow[]>`
+    select
+      id::text,
+      account_id::text,
+      kind,
+      parent_public_conversion_id::text,
+      input_sha256,
+      client_key,
+      state,
+      public_conversion_id::text,
+      error_code,
+      failure_reason,
+      user_action,
+      retry_policy,
+      attempts,
+      duration_ms,
+      estimated_cost_micros::int as estimated_cost_micros,
+      model,
+      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
+      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
+    from transform_jobs
+    where id = ${jobId}::uuid
+  `;
+
+  return row;
+}
+
+async function assertTransformWithinAccountLimits(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+): Promise<boolean> {
+  const [row] = await sql<{ within_limits: boolean }[]>`
+    select
+      (
+        select count(*)::int
+        from transform_jobs
+        where
+          account_id = ${accountId}::uuid
+          and created_at >= now() - interval '1 hour'
+      ) < ${MAX_TRANSFORM_JOBS_PER_HOUR}
+      and not exists (
+        select 1
+        from transform_jobs
+        where
+          account_id = ${accountId}::uuid
+          and state = 'processing'
+      ) as within_limits
+  `;
+
+  return row?.within_limits === true;
+}
+
+async function selectTransformJobByScope(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+  input: TransformJobCreateInput,
+  inputHash: string,
+): Promise<TransformJobRow | undefined> {
+  const parentPostId = input.parentPostId ?? null;
+  const [row] = await sql<TransformJobRow[]>`
+    select
+      id::text,
+      account_id::text,
+      kind,
+      parent_public_conversion_id::text,
+      input_sha256,
+      client_key,
+      state,
+      public_conversion_id::text,
+      error_code,
+      failure_reason,
+      user_action,
+      retry_policy,
+      attempts,
+      duration_ms,
+      estimated_cost_micros::int as estimated_cost_micros,
+      model,
+      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
+      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
+    from transform_jobs
+    where
+      account_id = ${accountId}::uuid
+      and kind = ${input.kind}
+      and coalesce(
+        parent_public_conversion_id,
+        '00000000-0000-0000-0000-000000000000'::uuid
+      ) = coalesce(
+        ${parentPostId}::uuid,
+        '00000000-0000-0000-0000-000000000000'::uuid
+      )
+      and input_sha256 = ${inputHash}
+      and client_key = ${input.clientKey}
+  `;
+
+  return row;
+}
+
+async function createOrJoinTransformJob(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+  input: TransformJobCreateInput,
+  inputHash: string,
+): Promise<TransformJobRow | undefined> {
+  const parentPostId = input.parentPostId ?? null;
+
+  return sql.begin(async (transaction) => {
+    if (input.kind === "reply_77") {
+      const [parent] = await transaction<ParentPostRow[]>`
+        select id::text, thread_id::text
+        from public_conversions
+        where
+          id = ${parentPostId}::uuid
+          and kind = 'post'
+          and is_published = true
+          and deleted_at is null
+      `;
+
+      if (!parent) {
+        return undefined;
+      }
+    }
+
+    const jobId = crypto.randomUUID();
+    const [row] = await transaction<TransformJobRow[]>`
+      insert into transform_jobs (
+        id,
+        account_id,
+        kind,
+        parent_public_conversion_id,
+        input_sha256,
+        client_key,
+        state
+      )
+      values (
+        ${jobId}::uuid,
+        ${accountId}::uuid,
+        ${input.kind},
+        ${parentPostId}::uuid,
+        ${inputHash},
+        ${input.clientKey},
+        'queued'
+      )
+      on conflict (
+        account_id,
+        kind,
+        coalesce(parent_public_conversion_id, '00000000-0000-0000-0000-000000000000'::uuid),
+        input_sha256,
+        client_key
+      )
+      do update set updated_at = transform_jobs.updated_at
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
+async function claimQueuedTransformJob(
+  sql: ReturnType<typeof createSql>,
+  jobId: string,
+): Promise<TransformJobRow | undefined> {
+  const [row] = await sql<TransformJobRow[]>`
+    update transform_jobs
+    set
+      state = 'processing',
+      updated_at = now()
+    where
+      id = ${jobId}::uuid
+      and state = 'queued'
+    returning
+      id::text,
+      account_id::text,
+      kind,
+      parent_public_conversion_id::text,
+      input_sha256,
+      client_key,
+      state,
+      public_conversion_id::text,
+      error_code,
+      failure_reason,
+      user_action,
+      retry_policy,
+      attempts,
+      duration_ms,
+      estimated_cost_micros::int as estimated_cost_micros,
+      model,
+      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
+      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
+  `;
+
+  return row;
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
+  return sql.begin(async (transaction) => {
+    const publicConversionId = crypto.randomUUID();
+    const publicKind = job.kind === "post_575" ? "post" : "reply";
+    let threadId = crypto.randomUUID();
+
+    if (job.kind === "post_575") {
+      await transaction`
+        insert into threads (id)
+        values (${threadId}::uuid)
+      `;
+    } else {
+      const [parent] = await transaction<ParentPostRow[]>`
+        select id::text, thread_id::text
+        from public_conversions
+        where
+          id = ${job.parent_public_conversion_id}::uuid
+          and kind = 'post'
+          and is_published = true
+          and deleted_at is null
+      `;
+
+      if (!parent) {
+        throw new LlmAdapterError(
+          "validation_failed",
+          "Parent post is no longer publishable.",
+          false,
+        );
+      }
+
+      threadId = parent.thread_id;
+    }
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
+        ${threadId}::uuid,
+        ${job.parent_public_conversion_id}::uuid,
+        ${publicKind},
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
+async function markTransformJobFailed(
+  sql: ReturnType<typeof createSql>,
+  jobId: string,
+  classification: TransformFailureClassification,
+  attempts: number,
+  durationMs: number,
+  model?: string,
+): Promise<TransformJobRow | undefined> {
+  const [row] = await sql<TransformJobRow[]>`
+    update transform_jobs
+    set
+      state = ${classification.jobState},
+      error_code = ${classification.publicCode},
+      failure_reason = ${classification.logCode},
+      user_action = ${classification.userAction},
+      retry_policy = ${toRetryPolicy(classification)},
+      attempts = ${attempts},
+      duration_ms = ${durationMs},
+      model = ${model ?? null},
+      updated_at = now()
+    where id = ${jobId}::uuid
+    returning
+      id::text,
+      account_id::text,
+      kind,
+      parent_public_conversion_id::text,
+      input_sha256,
+      client_key,
+      state,
+      public_conversion_id::text,
+      error_code,
+      failure_reason,
+      user_action,
+      retry_policy,
+      attempts,
+      duration_ms,
+      estimated_cost_micros::int as estimated_cost_micros,
+      model,
+      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
+      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
+  `;
+
+  return row;
+}
+
+async function runTransformJob(
+  sql: ReturnType<typeof createSql>,
+  bindings: Bindings,
+  job: TransformJobRow,
+  input: string,
+): Promise<TransformJobRow | undefined> {
+  const claimedJob = await claimQueuedTransformJob(sql, job.id);
+
+  if (!claimedJob) {
+    return selectTransformJob(sql, job.id);
+  }
+
+  const startedAt = Date.now();
+
+  try {
+    const adapter = createLlmAdapter(bindings);
+    const transformed = await adapter.transformText({
+      kind: claimedJob.kind,
+      input,
+      jobId: claimedJob.id,
+      remainingCallBudget: 3,
+    });
+
+    return publishTransformJob(
+      sql,
+      claimedJob,
+      transformed.text,
+      transformed.model,
+      transformed.attempts,
+      transformed.durationMs,
+    );
+  } catch (error) {
+    const adapterError =
+      error instanceof LlmAdapterError
+        ? error
+        : new LlmAdapterError(
+            "provider_unavailable",
+            "Transform request failed.",
+            true,
+          );
+    const classification = classifyTransformFailure(adapterError);
+
+    console.error("Transform job failed", {
+      jobId: claimedJob.id,
+      inputHash: claimedJob.input_sha256,
+      reason: classification.logCode,
+      retryable: classification.retryable,
+    });
+
+    return markTransformJobFailed(
+      sql,
+      claimedJob.id,
+      classification,
+      1,
+      Date.now() - startedAt,
+    );
+  }
+}
+
+async function readTransformJobBody(
+  request: Request,
+): Promise<TransformJobRequestBody | undefined> {
+  try {
+    const body = (await request.json()) as unknown;
+
+    if (!body || typeof body !== "object" || Array.isArray(body)) {
+      return undefined;
+    }
+
+    return body as TransformJobRequestBody;
+  } catch {
+    return undefined;
+  }
+}
+
+function parseClientKey(
+  bodyValue: unknown,
+  headerValue: string | undefined,
+): string | undefined {
+  const clientKey = typeof bodyValue === "string" ? bodyValue : headerValue;
+  const normalized = clientKey?.trim();
+
+  if (
+    !normalized ||
+    normalized.length > MAX_CLIENT_KEY_LENGTH ||
+    /[\p{Cc}]/u.test(normalized)
+  ) {
+    return undefined;
+  }
+
+  return normalized;
+}
+
+function parseTransformJobInput(
+  body: TransformJobRequestBody,
+  headerClientKey: string | undefined,
+): TransformJobCreateInput | undefined {
+  const kind = body.kind;
+  const input = body.input ?? body.body;
+  const clientKey = parseClientKey(body.clientKey, headerClientKey);
+  const parentPostId =
+    typeof body.parentPostId === "string" ? body.parentPostId : undefined;
+
+  if (
+    (kind !== "post_575" && kind !== "reply_77") ||
+    typeof input !== "string" ||
+    !clientKey
+  ) {
+    return undefined;
+  }
+
+  if (kind === "post_575" && parentPostId !== undefined) {
+    return undefined;
+  }
+
+  if (
+    kind === "reply_77" &&
+    (!parentPostId || !UUID_PATTERN.test(parentPostId))
+  ) {
+    return undefined;
+  }
+
+  return {
+    kind,
+    input,
+    ...(parentPostId ? { parentPostId } : {}),
+    clientKey,
+  };
+}
+
+async function handleCreateTransformJob(
+  c: AppContext,
+  forcedKind?: TransformJobKind,
+  forcedParentPostId?: string,
+) {
+  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
+  const accountId = await getSessionAccountId(
+    getCookie(c, cookieName),
+    c.env.SESSION_SECRET,
+  );
+
+  if (!accountId) {
+    return c.json(
+      {
+        error: {
+          code: "unauthorized" satisfies ApiErrorCode,
+          message: "Authentication is required for this write operation.",
+        },
+      },
+      401,
+    );
+  }
+
+  const body = await readTransformJobBody(c.req.raw);
+
+  if (!body) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message: "Request body must be a JSON object.",
+        },
+      },
+      400,
+    );
+  }
+
+  const parsed = parseTransformJobInput(
+    {
+      ...body,
+      ...(forcedKind ? { kind: forcedKind } : {}),
+      ...(forcedParentPostId ? { parentPostId: forcedParentPostId } : {}),
+    },
+    c.req.header("Idempotency-Key"),
+  );
+
+  if (!parsed) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message:
+            "Transform requests require kind, input or body, and an idempotency key.",
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
+    const inputHash = await sha256Hex(parsed.input);
+    const existingJob = await selectTransformJobByScope(
+      sql,
+      accountId,
+      parsed,
+      inputHash,
+    );
+
+    if (existingJob) {
+      const completedJob =
+        existingJob.state === "queued"
+          ? await runTransformJob(sql, c.env, existingJob, parsed.input)
+          : existingJob;
+
+      if (!completedJob) {
+        return c.json(
+          {
+            error: {
+              code: "service_unavailable" satisfies ApiErrorCode,
+              message: "Transform job could not be completed.",
+            },
+          },
+          503,
+        );
+      }
+
+      const response: TransformJobResponseDto = {
+        job: toTransformJobDto(completedJob),
+      };
+
+      c.header("Cache-Control", "no-store");
+
+      return c.json(response);
+    }
+
+    const withinLimit = await assertTransformWithinAccountLimits(sql, accountId);
+
+    if (!withinLimit) {
+      return c.json(
+        {
+          error: {
+            code: "transform_limit_exceeded" satisfies ApiErrorCode,
+            message: "The transform rate limit has been reached.",
+          },
+        },
+        429,
+      );
+    }
+
+    const job = await createOrJoinTransformJob(sql, accountId, parsed, inputHash);
+
+    if (!job) {
+      return c.json(
+        {
+          error: {
+            code: "not_found" satisfies ApiErrorCode,
+            message: "The parent post was not found.",
+          },
+        },
+        404,
+      );
+    }
+
+    const completedJob =
+      job.state === "queued"
+        ? await runTransformJob(sql, c.env, job, parsed.input)
+        : job;
+
+    if (!completedJob) {
+      return c.json(
+        {
+          error: {
+            code: "service_unavailable" satisfies ApiErrorCode,
+            message: "Transform job could not be completed.",
+          },
+        },
+        503,
+      );
+    }
+
+    const response: TransformJobResponseDto = {
+      job: toTransformJobDto(completedJob),
+    };
+
+    c.header("Cache-Control", "no-store");
+
+    if (completedJob.state === "succeeded") {
+      return c.json(response, 201);
+    }
+
+    if (completedJob.state === "rejected") {
+      return c.json(response, 422);
+    }
+
+    if (completedJob.state === "failed") {
+      return c.json(response, 503);
+    }
+
+    return c.json(response, 202);
+  } catch (error) {
+    console.error("Transform job request failed", toSafeLogError(error));
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable" satisfies ApiErrorCode,
+          message: "Transform job is temporarily unavailable.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error(
+        "Failed to close transform job database client",
+        toSafeLogError(error),
+      );
+    }
+  }
+}
+
 app.use("*", async (c, next) => {
   const middleware = cors({
     origin: allowedOrigins(c.env.API_ALLOWED_ORIGINS),
@@ -420,6 +1231,114 @@ app.get("/api/db/health", async (c) => {
   }
 });
 
+app.post("/api/transform-jobs", (c) => {
+  return handleCreateTransformJob(c);
+});
+
+app.post("/api/posts", (c) => {
+  return handleCreateTransformJob(c, "post_575");
+});
+
+app.post("/api/public-conversions/:id/replies", (c) => {
+  const parentPostId = c.req.param("id");
+
+  if (!UUID_PATTERN.test(parentPostId)) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message: "The parent post id must be a UUID.",
+        },
+      },
+      400,
+    );
+  }
+
+  return handleCreateTransformJob(c, "reply_77", parentPostId);
+});
+
+app.get("/api/transform-jobs/:id", async (c) => {
+  const jobId = c.req.param("id");
+
+  if (!UUID_PATTERN.test(jobId)) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request" satisfies ApiErrorCode,
+          message: "The transform job id must be a UUID.",
+        },
+      },
+      400,
+    );
+  }
+
+  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
+  const accountId = await getSessionAccountId(
+    getCookie(c, cookieName),
+    c.env.SESSION_SECRET,
+  );
+
+  if (!accountId) {
+    return c.json(
+      {
+        error: {
+          code: "unauthorized" satisfies ApiErrorCode,
+          message: "Authentication is required to read this transform job.",
+        },
+      },
+      401,
+    );
+  }
+
+  let sql: ReturnType<typeof createSql> | undefined;
+
+  try {
+    sql = createSql(c.env.HYPERDRIVE.connectionString);
+    const job = await selectTransformJob(sql, jobId);
+
+    if (!job || job.account_id !== accountId) {
+      return c.json(
+        {
+          error: {
+            code: "not_found" satisfies ApiErrorCode,
+            message: "Transform job not found.",
+          },
+        },
+        404,
+      );
+    }
+
+    const response: TransformJobResponseDto = {
+      job: toTransformJobDto(job),
+    };
+
+    c.header("Cache-Control", "no-store");
+
+    return c.json(response);
+  } catch (error) {
+    console.error("Transform job lookup failed", toSafeLogError(error));
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable" satisfies ApiErrorCode,
+          message: "Transform job is temporarily unavailable.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error(
+        "Failed to close transform job lookup database client",
+        toSafeLogError(error),
+      );
+    }
+  }
+});
+
 app.get("/api/timeline", async (c) => {
   const limit = parseTimelineLimit(c.req.query("limit"));
 
diff --git a/apps/api/src/llm-adapter.ts b/apps/api/src/llm-adapter.ts
index f07c37e..4379ebd 100644
--- a/apps/api/src/llm-adapter.ts
+++ b/apps/api/src/llm-adapter.ts
@@ -100,6 +100,7 @@ const DEFAULT_LLM_TIMEOUT_MS = 8_000;
 const DEFAULT_LLM_MAX_INPUT_CHARS = 1_000;
 const DEFAULT_LLM_MAX_OUTPUT_TOKENS = 96;
 const DEFAULT_LLM_MAX_RETRIES = 1;
+const DEFAULT_RETRY_BACKOFF_MS = 250;
 const MIN_TIMEOUT_MS = 1_000;
 const MAX_TIMEOUT_MS = 20_000;
 const MIN_OUTPUT_TOKENS = 16;
@@ -175,6 +176,8 @@ export function createLlmAdapter(bindings: LlmAdapterBindings) {
           if (!adapterError.retryable || attempt === maxAttempts) {
             throw adapterError;
           }
+
+          await delay(DEFAULT_RETRY_BACKOFF_MS * 2 ** (attempt - 1));
         }
       }
 
@@ -231,6 +234,10 @@ export function classifyTransformFailure(
   };
 }
 
+function delay(durationMs: number): Promise<void> {
+  return new Promise((resolve) => setTimeout(resolve, durationMs));
+}
+
 function readConfig(bindings: LlmAdapterBindings): LlmAdapterConfig {
   if (!bindings.LLM_API_KEY) {
     throw new LlmAdapterError(

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