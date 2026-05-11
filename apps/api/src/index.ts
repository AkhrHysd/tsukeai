import {
  type ApiErrorCode,
  checkTransformForm,
  type PostDto,
  type ReplyDto,
  type TimelineItemDto,
  type TimelineResponseDto,
  type TransformFailureReason,
  type TransformJobDto,
  type TransformJobKind,
  type TransformJobResponseDto,
  type TransformJobState,
  type TransformPublicErrorCode,
  type TransformRetryPolicy,
  type TransformUserAction,
} from "@tsukeai/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import postgres from "postgres";
import {
  classifyTransformFailure,
  createLlmAdapter,
  type LlmAdapterBindings,
  LlmAdapterError,
  type TransformFailureClassification,
} from "./llm-adapter";

type Bindings = LlmAdapterBindings & {
  API_ALLOWED_ORIGINS?: string;
  HYPERDRIVE: Hyperdrive;
  SESSION_COOKIE_NAME?: string;
  SESSION_SECRET?: string;
  WRITE_SMOKE_FIXED_PUBLIC_TEXT?: string;
};

type AppContext = Context<{ Bindings: Bindings }>;

type HealthResponse = {
  status: "ok";
  service: "api";
};

type DatabaseHealthRow = {
  ok: number;
  database: string;
  server_version: string;
};

type DatabaseHealthResponse = {
  status: "ok";
  database: string;
  serverVersion: string;
};

type TimelineCursor = {
  publishedAt: string;
  id: string;
};

type TimelineRow = {
  post_id: string;
  post_author_id: string;
  post_author_display_name: string;
  post_author_handle: string | null;
  post_body: string;
  post_created_at: string;
  post_published_at: string;
  reply_id: string | null;
  reply_author_id: string | null;
  reply_author_display_name: string | null;
  reply_author_handle: string | null;
  reply_body: string | null;
  reply_created_at: string | null;
  has_next: boolean;
};

type DeletePublicConversionResult = {
  exists: boolean;
  authorized: boolean;
  deleted_count: number;
};

type PublishedPostRow = {
  id: string;
  author_id: string;
  author_display_name: string;
  author_handle: string | null;
  body: string;
  created_at: string;
};

type PublishedReplyRow = PublishedPostRow & {
  post_id: string;
};

type TransformJobRow = {
  id: string;
  account_id: string;
  kind: TransformJobKind;
  parent_public_conversion_id: string | null;
  input_sha256: string;
  client_key: string;
  state: TransformJobState;
  public_conversion_id: string | null;
  error_code: TransformPublicErrorCode | null;
  failure_reason: TransformFailureReason | null;
  user_action: TransformUserAction | null;
  retry_policy: TransformRetryPolicy | null;
  attempts: number;
  duration_ms: number | null;
  estimated_cost_micros: number | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

type TransformJobRequestBody = {
  kind?: unknown;
  input?: unknown;
  body?: unknown;
  publicText?: unknown;
  parentPostId?: unknown;
  clientKey?: unknown;
};

type TransformJobCreateInput = {
  kind: TransformJobKind;
  input: string;
  clientKey: string;
  parentPostId?: string;
};

type PublicTextCreateInput = {
  kind: TransformJobKind;
  publicText: string;
  clientKey: string;
  parentPostId?: string;
};

type SafeLogError = {
  name: string;
  code?: string;
};

type ReplyParentPostRow = {
  id: string;
  thread_id: string;
};

const LOCAL_WEB_ORIGIN = "http://localhost:3000";
const DEFAULT_SESSION_COOKIE_NAME = "__Host-tsukeai_session";
const DEFAULT_TIMELINE_LIMIT = 20;
const MAX_TIMELINE_LIMIT = 50;
const MAX_CLIENT_KEY_LENGTH = 128;
const MAX_TRANSFORM_JOBS_PER_HOUR = 20;
const TRANSFORM_SYNC_WAIT_MS = 900;
const PROCESSING_STALE_AFTER_SECONDS = 90;
const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
const PUBLIC_TIMELINE_CACHE_CONTROL = "no-store";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEALTH_RESPONSE: HealthResponse = {
  status: "ok",
  service: "api",
};

const app = new Hono<{ Bindings: Bindings }>();

function toSafeLogError(error: unknown): SafeLogError {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;

  return {
    name: error.name,
    ...(code ? { code } : {}),
    ...("message" in error && typeof error.message === "string" ? { message: error.message } : {}),
  };
}

function createSql(connectionString: string) {
  return postgres(connectionString, {
    max: 1,
    fetch_types: false,
    prepare: false,
  });
}

function allowedOrigins(value: string | undefined): string[] {
  const origins =
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? [];

  return origins.length > 0 ? origins : [LOCAL_WEB_ORIGIN];
}

function isProtectedWrite(method: string, path: string): boolean {
  return (
    method === "DELETE" &&
    path.startsWith("/api/") &&
    !/^\/api\/(?:auth|sessions)(?:\/|$)/.test(path)
  );
}

function parseTimelineLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return DEFAULT_TIMELINE_LIMIT;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) {
    return undefined;
  }

  return Math.min(limit, MAX_TIMELINE_LIMIT);
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function encodeBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;

  return atob(`${base64}${"=".repeat(paddingLength)}`);
}

function encodeTimelineCursor(cursor: TimelineCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

function parseTimelineCursor(value: string | undefined): TimelineCursor | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const cursor = JSON.parse(decodeBase64Url(value)) as Partial<TimelineCursor>;

    if (
      typeof cursor.publishedAt !== "string" ||
      Number.isNaN(Date.parse(cursor.publishedAt)) ||
      typeof cursor.id !== "string" ||
      !UUID_PATTERN.test(cursor.id)
    ) {
      return undefined;
    }

    return {
      publishedAt: cursor.publishedAt,
      id: cursor.id,
    };
  } catch {
    return undefined;
  }
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

async function verifySessionCookie(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  return (await getSessionAccountId(cookieValue, secret)) !== undefined;
}

async function getSessionAccountId(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<string | undefined> {
  if (!cookieValue || !secret) {
    return undefined;
  }

  const separatorIndex = cookieValue.indexOf(".");

  if (separatorIndex <= 0 || separatorIndex === cookieValue.length - 1) {
    return undefined;
  }

  const accountId = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);

  if (!UUID_PATTERN.test(accountId)) {
    return undefined;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSignature = toBase64Url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accountId)),
  );

  return signaturesMatch(signature, expectedSignature) ? accountId : undefined;
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toRetryPolicy(classification: TransformFailureClassification): TransformRetryPolicy {
  return classification.retryable ? "server_retryable" : "client_revisable";
}

function toTransformJobDto(row: TransformJobRow): TransformJobDto {
  const dto: TransformJobDto = {
    id: row.id,
    kind: row.kind,
    state: row.state,
    idempotency: {
      userId: row.account_id,
      kind: row.kind,
      ...(row.parent_public_conversion_id ? { parentPostId: row.parent_public_conversion_id } : {}),
      inputHash: row.input_sha256,
      clientKey: row.client_key,
    },
    observation: {
      jobId: row.id,
      state: row.state,
      ...(row.failure_reason ? { reason: row.failure_reason } : {}),
      attempts: row.attempts,
      ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
      ...(row.estimated_cost_micros !== null
        ? { estimatedCostMicros: row.estimated_cost_micros }
        : {}),
      ...(row.model ? { model: row.model } : {}),
      inputHash: row.input_sha256,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    ...(row.state === "succeeded" && row.public_conversion_id && row.kind === "post_575"
      ? { publishedPostId: row.public_conversion_id }
      : {}),
    ...(row.state === "succeeded" && row.public_conversion_id && row.kind === "reply_77"
      ? { publishedReplyId: row.public_conversion_id }
      : {}),
    ...(row.error_code && row.failure_reason && row.user_action && row.retry_policy
      ? {
          error: {
            code: row.error_code,
            reason: row.failure_reason,
            message:
              row.error_code === "transform_failed"
                ? "The transform could not be completed. Please retry later."
                : "The input could not be transformed. Please revise it.",
            retryPolicy: row.retry_policy,
            userAction: row.user_action,
          },
        }
      : {}),
  };

  return dto;
}

function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
  const itemsByPostId = new Map<string, TimelineItemDto>();
  let lastPostCursor: TimelineCursor | undefined;

  for (const row of rows) {
    let item = itemsByPostId.get(row.post_id);

    if (!item) {
      item = {
        post: {
          id: row.post_id,
          author: {
            id: row.post_author_id,
            displayName: row.post_author_display_name,
            ...(row.post_author_handle ? { handle: row.post_author_handle } : {}),
          },
          body: row.post_body,
          createdAt: row.post_created_at,
        },
        replies: [],
      };
      itemsByPostId.set(row.post_id, item);
      lastPostCursor = {
        publishedAt: row.post_published_at,
        id: row.post_id,
      };
    }

    if (
      row.reply_id &&
      row.reply_author_id &&
      row.reply_author_display_name &&
      row.reply_body &&
      row.reply_created_at
    ) {
      const reply: ReplyDto = {
        id: row.reply_id,
        postId: row.post_id,
        author: {
          id: row.reply_author_id,
          displayName: row.reply_author_display_name,
          ...(row.reply_author_handle ? { handle: row.reply_author_handle } : {}),
        },
        body: row.reply_body,
        createdAt: row.reply_created_at,
      };

      item.replies.push(reply);
    }
  }

  const hasNext = rows.some((row) => row.has_next);
  const items = Array.from(itemsByPostId.values());

  return {
    items,
    ...(hasNext && lastPostCursor ? { nextCursor: encodeTimelineCursor(lastPostCursor) } : {}),
  };
}

function toPostDto(row: PublishedPostRow): PostDto {
  return {
    id: row.id,
    author: {
      id: row.author_id,
      displayName: row.author_display_name,
      ...(row.author_handle ? { handle: row.author_handle } : {}),
    },
    body: row.body,
    createdAt: row.created_at,
  };
}

function toReplyDto(row: PublishedReplyRow): ReplyDto {
  return {
    id: row.id,
    postId: row.post_id,
    author: {
      id: row.author_id,
      displayName: row.author_display_name,
      ...(row.author_handle ? { handle: row.author_handle } : {}),
    },
    body: row.body,
    createdAt: row.created_at,
  };
}

async function selectTransformJob(
  sql: ReturnType<typeof createSql>,
  jobId: string,
): Promise<TransformJobRow | undefined> {
  const [row] = await sql<TransformJobRow[]>`
    select
      id::text,
      account_id::text,
      kind,
      parent_public_conversion_id::text,
      input_sha256,
      client_key,
      state,
      public_conversion_id::text,
      error_code,
      failure_reason,
      user_action,
      retry_policy,
      attempts,
      duration_ms,
      estimated_cost_micros::int as estimated_cost_micros,
      model,
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
    from transform_jobs
    where id = ${jobId}::uuid
  `;

  return row;
}

async function assertTransformWithinAccountLimits(
  sql: ReturnType<typeof createSql>,
  accountId: string,
): Promise<boolean> {
  const [row] = await sql<{ within_limits: boolean }[]>`
    select
      (
        select count(*)::int
        from transform_jobs
        where
          account_id = ${accountId}::uuid
          and created_at >= now() - interval '1 hour'
      ) < ${MAX_TRANSFORM_JOBS_PER_HOUR}
      and not exists (
        select 1
        from transform_jobs
        where
          account_id = ${accountId}::uuid
          and state = 'processing'
          and updated_at >=
            now() - (${PROCESSING_STALE_AFTER_SECONDS} * interval '1 second')
      ) as within_limits
  `;

  return row?.within_limits === true;
}

async function selectTransformJobByScope(
  sql: ReturnType<typeof createSql>,
  accountId: string,
  input: TransformJobCreateInput,
  inputHash: string,
): Promise<TransformJobRow | undefined> {
  const parentPostId = input.parentPostId ?? NIL_UUID;

  const [row] = await sql<TransformJobRow[]>`
    select
      id::text,
      account_id::text,
      kind,
      parent_public_conversion_id::text,
      input_sha256,
      client_key,
      state,
      public_conversion_id::text,
      error_code,
      failure_reason,
      user_action,
      retry_policy,
      attempts,
      duration_ms,
      estimated_cost_micros::int as estimated_cost_micros,
      model,
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
    from transform_jobs
    where
      account_id = ${accountId}::uuid
      and kind = ${input.kind}
      and coalesce(parent_public_conversion_id, ${NIL_UUID}::uuid) =
        ${parentPostId}::uuid
      and input_sha256 = ${inputHash}
      and client_key = ${input.clientKey}
  `;

  return row;
}

async function createOrJoinTransformJob(
  sql: ReturnType<typeof createSql>,
  accountId: string,
  input: TransformJobCreateInput,
  inputHash: string,
): Promise<TransformJobRow | undefined> {
  return sql.begin(async (transaction) => {
    const jobId = crypto.randomUUID();
    const parentPostId = input.parentPostId ?? null;
    const [row] = await transaction<TransformJobRow[]>`
      insert into transform_jobs (
        id,
        account_id,
        kind,
        parent_public_conversion_id,
        input_sha256,
        client_key,
        state
      )
      values (
        ${jobId}::uuid,
        ${accountId}::uuid,
        ${input.kind},
        ${parentPostId}::uuid,
        ${inputHash},
        ${input.clientKey},
        'queued'
      )
      on conflict (
        account_id,
        kind,
        coalesce(parent_public_conversion_id, '00000000-0000-0000-0000-000000000000'::uuid),
        input_sha256,
        client_key
      )
      do update set updated_at = transform_jobs.updated_at
      returning
        id::text,
        account_id::text,
        kind,
        parent_public_conversion_id::text,
        input_sha256,
        client_key,
        state,
        public_conversion_id::text,
        error_code,
        failure_reason,
        user_action,
        retry_policy,
        attempts,
        duration_ms,
        estimated_cost_micros::int as estimated_cost_micros,
        model,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
    `;

    return row;
  });
}

async function claimRunnableTransformJob(
  sql: ReturnType<typeof createSql>,
  jobId: string,
): Promise<TransformJobRow | undefined> {
  const [row] = await sql<TransformJobRow[]>`
    update transform_jobs
    set
      state = 'processing',
      updated_at = now()
    where
      id = ${jobId}::uuid
      and (
        state = 'queued'
        or (
          state = 'processing'
          and updated_at < now() - (${PROCESSING_STALE_AFTER_SECONDS} * interval '1 second')
        )
      )
    returning
      id::text,
      account_id::text,
      kind,
      parent_public_conversion_id::text,
      input_sha256,
      client_key,
      state,
      public_conversion_id::text,
      error_code,
      failure_reason,
      user_action,
      retry_policy,
      attempts,
      duration_ms,
      estimated_cost_micros::int as estimated_cost_micros,
      model,
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
  `;

  return row;
}

async function selectReplyParentPost(
  sql: ReturnType<typeof createSql>,
  parentPostId: string,
): Promise<ReplyParentPostRow | undefined> {
  const [row] = await sql<ReplyParentPostRow[]>`
    select
      p.id::text,
      p.thread_id::text
    from public_conversions p
    join threads t on t.id = p.thread_id
    where
      p.id = ${parentPostId}::uuid
      and p.kind = 'post'
      and p.is_published = true
      and p.deleted_at is null
      and t.deleted_at is null
  `;

  return row;
}

async function publishPostTransformJob(
  sql: ReturnType<typeof createSql>,
  job: TransformJobRow,
  publicText: string,
  model: string,
  attempts: number,
  durationMs: number,
): Promise<TransformJobRow | undefined> {
  return sql.begin(async (transaction) => {
    const publicConversionId = crypto.randomUUID();
    const threadId = crypto.randomUUID();

    await transaction`
      insert into threads (id)
      values (${threadId}::uuid)
    `;

    await transaction`
      insert into public_conversions (
        id,
        account_id,
        thread_id,
        parent_public_conversion_id,
        kind,
        public_text,
        source_sha256
      )
      values (
        ${publicConversionId}::uuid,
        ${job.account_id}::uuid,
        ${threadId}::uuid,
        null,
        'post',
        ${publicText},
        ${job.input_sha256}
      )
    `;

    const [row] = await transaction<TransformJobRow[]>`
      update transform_jobs
      set
        state = 'succeeded',
        public_conversion_id = ${publicConversionId}::uuid,
        attempts = ${attempts},
        duration_ms = ${durationMs},
        estimated_cost_micros = 0,
        model = ${model},
        updated_at = now()
      where id = ${job.id}::uuid
      returning
        id::text,
        account_id::text,
        kind,
        parent_public_conversion_id::text,
        input_sha256,
        client_key,
        state,
        public_conversion_id::text,
        error_code,
        failure_reason,
        user_action,
        retry_policy,
        attempts,
        duration_ms,
        estimated_cost_micros::int as estimated_cost_micros,
        model,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
    `;

    return row;
  });
}

async function publishReplyTransformJob(
  sql: ReturnType<typeof createSql>,
  job: TransformJobRow,
  publicText: string,
  model: string,
  attempts: number,
  durationMs: number,
): Promise<TransformJobRow | undefined> {
  if (!job.parent_public_conversion_id) {
    return undefined;
  }

  return sql.begin(async (transaction) => {
    const [parentPost] = await transaction<ReplyParentPostRow[]>`
      select
        p.id::text,
        p.thread_id::text
      from public_conversions p
      join threads t on t.id = p.thread_id
      where
        p.id = ${job.parent_public_conversion_id}::uuid
        and p.kind = 'post'
        and p.is_published = true
        and p.deleted_at is null
        and t.deleted_at is null
    `;

    if (!parentPost) {
      return undefined;
    }

    const publicConversionId = crypto.randomUUID();

    await transaction`
      insert into public_conversions (
        id,
        account_id,
        thread_id,
        parent_public_conversion_id,
        kind,
        public_text,
        source_sha256
      )
      values (
        ${publicConversionId}::uuid,
        ${job.account_id}::uuid,
        ${parentPost.thread_id}::uuid,
        ${parentPost.id}::uuid,
        'reply',
        ${publicText},
        ${job.input_sha256}
      )
    `;

    const [row] = await transaction<TransformJobRow[]>`
      update transform_jobs
      set
        state = 'succeeded',
        public_conversion_id = ${publicConversionId}::uuid,
        attempts = ${attempts},
        duration_ms = ${durationMs},
        estimated_cost_micros = 0,
        model = ${model},
        updated_at = now()
      where id = ${job.id}::uuid
      returning
        id::text,
        account_id::text,
        kind,
        parent_public_conversion_id::text,
        input_sha256,
        client_key,
        state,
        public_conversion_id::text,
        error_code,
        failure_reason,
        user_action,
        retry_policy,
        attempts,
        duration_ms,
        estimated_cost_micros::int as estimated_cost_micros,
        model,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
        to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
    `;

    return row;
  });
}

async function publishTransformJob(
  sql: ReturnType<typeof createSql>,
  job: TransformJobRow,
  publicText: string,
  model: string,
  attempts: number,
  durationMs: number,
): Promise<TransformJobRow | undefined> {
  if (job.kind === "reply_77") {
    return publishReplyTransformJob(sql, job, publicText, model, attempts, durationMs);
  }

  return publishPostTransformJob(sql, job, publicText, model, attempts, durationMs);
}

async function markTransformJobFailed(
  sql: ReturnType<typeof createSql>,
  jobId: string,
  classification: TransformFailureClassification,
  attempts: number,
  durationMs: number,
  model?: string,
): Promise<TransformJobRow | undefined> {
  const [row] = await sql<TransformJobRow[]>`
    update transform_jobs
    set
      state = ${classification.jobState},
      error_code = ${classification.publicCode},
      failure_reason = ${classification.logCode},
      user_action = ${classification.userAction},
      retry_policy = ${toRetryPolicy(classification)},
      attempts = ${attempts},
      duration_ms = ${durationMs},
      model = ${model ?? null},
      updated_at = now()
    where id = ${jobId}::uuid
    returning
      id::text,
      account_id::text,
      kind,
      parent_public_conversion_id::text,
      input_sha256,
      client_key,
      state,
      public_conversion_id::text,
      error_code,
      failure_reason,
      user_action,
      retry_policy,
      attempts,
      duration_ms,
      estimated_cost_micros::int as estimated_cost_micros,
      model,
      to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
      to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at
  `;

  return row;
}

async function runTransformJob(
  sql: ReturnType<typeof createSql>,
  bindings: Bindings,
  job: TransformJobRow,
  input: string,
): Promise<TransformJobRow | undefined> {
  const claimedJob = await claimRunnableTransformJob(sql, job.id);

  if (!claimedJob) {
    return selectTransformJob(sql, job.id);
  }

  const startedAt = Date.now();

  try {
    const adapter = createLlmAdapter(bindings);
    const transformed = await adapter.transformText({
      kind: claimedJob.kind,
      input,
      jobId: claimedJob.id,
      remainingCallBudget: 3,
    });
    const publishedJob = await publishTransformJob(
      sql,
      claimedJob,
      transformed.text,
      transformed.model,
      transformed.attempts,
      transformed.durationMs,
    );

    if (!publishedJob) {
      throw new LlmAdapterError(
        "provider_unavailable",
        "Transform result could not be published.",
        true,
        transformed.attempts,
        transformed.model,
      );
    }

    return publishedJob;
  } catch (error) {
    const adapterError =
      error instanceof LlmAdapterError
        ? error
        : new LlmAdapterError("provider_unavailable", "Transform request failed.", true);
    const classification = classifyTransformFailure(adapterError);

    console.error("Transform job failed", {
      jobId: claimedJob.id,
      inputHash: claimedJob.input_sha256,
      reason: classification.logCode,
      retryable: classification.retryable,
      attempts: adapterError.attempts,
      error: toSafeLogError(adapterError),
    });

    return markTransformJobFailed(
      sql,
      claimedJob.id,
      classification,
      adapterError.attempts,
      Date.now() - startedAt,
      adapterError.model,
    );
  }
}

async function runTransformJobInBackground(
  bindings: Bindings,
  job: TransformJobRow,
  input: string,
): Promise<TransformJobRow | undefined> {
  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(bindings.HYPERDRIVE.connectionString);
    return await runTransformJob(sql, bindings, job, input);
  } catch (error) {
    console.error("Background transform job failed", {
      jobId: job.id,
      inputHash: job.input_sha256,
      error: toSafeLogError(error),
    });
    return undefined;
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error(
        "Failed to close background transform job database client",
        toSafeLogError(error),
      );
    }
  }
}

async function waitForTransformJob(
  runPromise: Promise<TransformJobRow | undefined>,
): Promise<TransformJobRow | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      runPromise,
      new Promise<undefined>((resolve) => {
        timeoutId = setTimeout(resolve, TRANSFORM_SYNC_WAIT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function responseStatusForTransformJob(
  job: TransformJobRow,
  created: boolean,
): 200 | 201 | 202 | 422 | 503 {
  if (job.state === "succeeded") {
    return created ? 201 : 200;
  }

  if (job.state === "rejected") {
    return 422;
  }

  if (job.state === "failed") {
    return 503;
  }

  return 202;
}

async function resolveTransformJobForResponse(
  sql: ReturnType<typeof createSql>,
  bindings: Bindings,
  context: ExecutionContext,
  job: TransformJobRow,
  input: string,
): Promise<TransformJobRow | undefined> {
  if (job.state !== "queued" && job.state !== "processing") {
    return job;
  }

  const runPromise = runTransformJobInBackground(bindings, job, input);
  context.waitUntil(runPromise.then(() => undefined));

  return (await waitForTransformJob(runPromise)) ?? selectTransformJob(sql, job.id);
}

async function readTransformJobBody(
  request: Request,
): Promise<TransformJobRequestBody | undefined> {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return undefined;
    }

    return body as TransformJobRequestBody;
  } catch {
    return undefined;
  }
}

function parseClientKey(bodyValue: unknown, headerValue: string | undefined): string | undefined {
  const clientKey = typeof bodyValue === "string" ? bodyValue : headerValue;
  const normalized = clientKey?.trim();

  if (!normalized || normalized.length > MAX_CLIENT_KEY_LENGTH || /[\p{Cc}]/u.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function parseTransformJobInput(
  body: TransformJobRequestBody,
  headerClientKey: string | undefined,
): TransformJobCreateInput | undefined {
  const kind = body.kind;
  const input = body.input ?? body.body;
  const clientKey = parseClientKey(body.clientKey, headerClientKey);
  const parentPostId = typeof body.parentPostId === "string" ? body.parentPostId.trim() : undefined;

  if ((kind !== "post_575" && kind !== "reply_77") || typeof input !== "string" || !clientKey) {
    return undefined;
  }

  if (kind === "post_575" && body.parentPostId !== undefined) {
    return undefined;
  }

  if (kind === "reply_77" && (!parentPostId || !UUID_PATTERN.test(parentPostId))) {
    return undefined;
  }

  return {
    kind,
    input,
    clientKey,
    ...(parentPostId ? { parentPostId } : {}),
  };
}

function parsePublicTextInput(
  body: TransformJobRequestBody,
  forcedInput: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
  headerClientKey: string | undefined,
): PublicTextCreateInput | undefined {
  const publicText = body.publicText;
  const clientKey = parseClientKey(body.clientKey, headerClientKey);
  const parentPostId =
    forcedInput.parentPostId ??
    (typeof body.parentPostId === "string" ? body.parentPostId.trim() : undefined);

  if (typeof publicText !== "string" || !clientKey) {
    return undefined;
  }

  if (forcedInput.kind === "reply_77" && (!parentPostId || !UUID_PATTERN.test(parentPostId))) {
    return undefined;
  }

  if (forcedInput.kind === "post_575" && parentPostId !== undefined) {
    return undefined;
  }

  const formCheck = checkTransformForm(forcedInput.kind, publicText);

  if (!formCheck.accepted) {
    return undefined;
  }

  return {
    kind: forcedInput.kind,
    publicText: formCheck.normalizedText,
    clientKey,
    ...(parentPostId ? { parentPostId } : {}),
  };
}

async function publishPublicTextPost(
  sql: ReturnType<typeof createSql>,
  accountId: string,
  input: PublicTextCreateInput,
): Promise<PostDto> {
  const publicConversionId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const sourceHash = await sha256Hex(input.publicText);

  const row = await sql.begin(async (transaction) => {
    await transaction`
      insert into threads (id)
      values (${threadId}::uuid)
    `;

    const [inserted] = await transaction<PublishedPostRow[]>`
      insert into public_conversions (
        id,
        account_id,
        thread_id,
        parent_public_conversion_id,
        kind,
        public_text,
        source_sha256
      )
      values (
        ${publicConversionId}::uuid,
        ${accountId}::uuid,
        ${threadId}::uuid,
        null,
        'post',
        ${input.publicText},
        ${sourceHash}
      )
      returning
        id::text,
        account_id::text as author_id,
        (
          select display_name
          from accounts
          where id = ${accountId}::uuid and deleted_at is null
        ) as author_display_name,
        (
          select handle
          from accounts
          where id = ${accountId}::uuid and deleted_at is null
        ) as author_handle,
        public_text as body,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
    `;

    return inserted;
  });

  if (!row?.author_display_name) {
    throw new Error("Post author not found.");
  }

  return toPostDto(row);
}

async function publishPublicTextReply(
  sql: ReturnType<typeof createSql>,
  accountId: string,
  input: PublicTextCreateInput,
): Promise<ReplyDto | undefined> {
  if (!input.parentPostId) {
    return undefined;
  }

  const publicConversionId = crypto.randomUUID();
  const sourceHash = await sha256Hex(input.publicText);

  const parentPostId = input.parentPostId;

  const row = await sql.begin(async (transaction) => {
    const [parentPost] = await transaction<ReplyParentPostRow[]>`
      select
        p.id::text,
        p.thread_id::text
      from public_conversions p
      join threads t on t.id = p.thread_id
      where
        p.id = ${parentPostId}::uuid
        and p.kind = 'post'
        and p.is_published = true
        and p.deleted_at is null
        and t.deleted_at is null
    `;

    if (!parentPost) {
      return undefined;
    }

    const [inserted] = await transaction<PublishedReplyRow[]>`
      insert into public_conversions (
        id,
        account_id,
        thread_id,
        parent_public_conversion_id,
        kind,
        public_text,
        source_sha256
      )
      values (
        ${publicConversionId}::uuid,
        ${accountId}::uuid,
        ${parentPost.thread_id}::uuid,
        ${parentPost.id}::uuid,
        'reply',
        ${input.publicText},
        ${sourceHash}
      )
      returning
        id::text,
        ${parentPost.id}::text as post_id,
        account_id::text as author_id,
        (
          select display_name
          from accounts
          where id = ${accountId}::uuid and deleted_at is null
        ) as author_display_name,
        (
          select handle
          from accounts
          where id = ${accountId}::uuid and deleted_at is null
        ) as author_handle,
        public_text as body,
        to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
    `;

    return inserted;
  });

  if (!row?.author_display_name) {
    throw new Error("Reply author not found.");
  }

  return toReplyDto(row);
}

async function handleCreatePublicText(
  c: AppContext,
  forcedInput: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
  body: TransformJobRequestBody,
  accountId: string,
) {
  const parsed = parsePublicTextInput(body, forcedInput, c.req.header("Idempotency-Key"));

  if (!parsed) {
    return c.json(
      {
        error: {
          code: "bad_request" satisfies ApiErrorCode,
          message: "Published write requests require valid publicText and an idempotency key.",
        },
      },
      400,
    );
  }

  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);

    if (parsed.kind === "reply_77") {
      const reply = await publishPublicTextReply(sql, accountId, parsed);

      if (!reply) {
        return c.json(
          {
            error: {
              code: "not_found" satisfies ApiErrorCode,
              message: "Parent post not found.",
            },
          },
          404,
        );
      }

      c.header("Cache-Control", "no-store");

      return c.json({ reply }, 201);
    }

    const post = await publishPublicTextPost(sql, accountId, parsed);

    c.header("Cache-Control", "no-store");

    return c.json({ post }, 201);
  } catch (error) {
    console.error("Published write request failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "service_unavailable" satisfies ApiErrorCode,
          message: "Published text could not be saved.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close published write database client", toSafeLogError(error));
    }
  }
}

async function handleCreateTransformJob(
  c: AppContext,
  forcedInput?: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
) {
  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
  const existingAccountId = await getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);
  const accountId = existingAccountId ?? crypto.randomUUID();
  const shouldEnsureAccount = existingAccountId === undefined;

  const body = await readTransformJobBody(c.req.raw);

  if (!body) {
    return c.json(
      {
        error: {
          code: "bad_request" satisfies ApiErrorCode,
          message: "Request body must be a JSON object.",
        },
      },
      400,
    );
  }

  if (body.publicText !== undefined) {
    if (forcedInput?.kind && c.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1") {
      return handleCreatePublicText(c, forcedInput, body, accountId);
    }

    return c.json(
      {
        error: {
          code: "bad_request" satisfies ApiErrorCode,
          message: "Published text writes are disabled.",
        },
      },
      400,
    );
  }

  const parsed = parseTransformJobInput(
    {
      ...body,
      ...(forcedInput?.kind ? { kind: forcedInput.kind } : {}),
      ...(forcedInput?.parentPostId ? { parentPostId: forcedInput.parentPostId } : {}),
    },
    c.req.header("Idempotency-Key"),
  );

  if (!parsed) {
    return c.json(
      {
        error: {
          code: "bad_request" satisfies ApiErrorCode,
          message:
            "Transform requests require kind, input or body, parentPostId for replies, and an idempotency key.",
        },
      },
      400,
    );
  }

  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);

    if (shouldEnsureAccount) {
      await sql`
        insert into accounts (id, display_name)
        values (${accountId}::uuid, '匿名')
        on conflict (id) do nothing
      `;
    }

    if (parsed.kind === "reply_77") {
      const parentPost =
        parsed.parentPostId === undefined
          ? undefined
          : await selectReplyParentPost(sql, parsed.parentPostId);

      if (!parentPost) {
        return c.json(
          {
            error: {
              code: "not_found" satisfies ApiErrorCode,
              message: "Parent post not found.",
            },
          },
          404,
        );
      }
    }

    const inputHash = await sha256Hex(parsed.input);
    const existingJob = await selectTransformJobByScope(sql, accountId, parsed, inputHash);

    if (existingJob) {
      const responseJob = await resolveTransformJobForResponse(
        sql,
        c.env,
        c.executionCtx,
        existingJob,
        parsed.input,
      );

      if (!responseJob) {
        return c.json(
          {
            error: {
              code: "service_unavailable" satisfies ApiErrorCode,
              message: "Transform job could not be completed.",
            },
          },
          503,
        );
      }

      const response: TransformJobResponseDto = {
        job: toTransformJobDto(responseJob),
      };

      c.header("Cache-Control", "no-store");

      return c.json(response, responseStatusForTransformJob(responseJob, false));
    }

    const withinLimit = await assertTransformWithinAccountLimits(sql, accountId);

    if (!withinLimit) {
      return c.json(
        {
          error: {
            code: "transform_limit_exceeded" satisfies ApiErrorCode,
            message: "The transform rate limit has been reached.",
          },
        },
        429,
      );
    }

    const job = await createOrJoinTransformJob(sql, accountId, parsed, inputHash);

    if (!job) {
      return c.json(
        {
          error: {
            code: "service_unavailable" satisfies ApiErrorCode,
            message: "Transform job could not be created.",
          },
        },
        503,
      );
    }

    const responseJob = await resolveTransformJobForResponse(
      sql,
      c.env,
      c.executionCtx,
      job,
      parsed.input,
    );

    if (!responseJob) {
      return c.json(
        {
          error: {
            code: "service_unavailable" satisfies ApiErrorCode,
            message: "Transform job could not be completed.",
          },
        },
        503,
      );
    }

    const response: TransformJobResponseDto = {
      job: toTransformJobDto(responseJob),
    };

    c.header("Cache-Control", "no-store");

    return c.json(response, responseStatusForTransformJob(responseJob, true));
  } catch (error) {
    console.error("Transform job request failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "service_unavailable" satisfies ApiErrorCode,
          message: "Transform job is temporarily unavailable.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close transform job database client", toSafeLogError(error));
    }
  }
}

app.use("*", async (c, next) => {
  const middleware = cors({
    origin: allowedOrigins(c.env.API_ALLOWED_ORIGINS),
    credentials: true,
    allowHeaders: ALLOWED_HEADERS,
    allowMethods: ALLOWED_METHODS,
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86_400,
  });

  return middleware(c, next);
});

app.use("*", async (c, next) => {
  if (!isProtectedWrite(c.req.method, c.req.path)) {
    return next();
  }

  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
  const isAuthenticated = await verifySessionCookie(getCookie(c, cookieName), c.env.SESSION_SECRET);

  if (isAuthenticated) {
    return next();
  }

  return c.json(
    {
      error: {
        code: "unauthorized",
        message: "Authentication is required for this write operation.",
      },
    },
    401,
  );
});

app.get("/health", (c) => {
  return c.json(HEALTH_RESPONSE);
});

app.get("/api/health", (c) => {
  return c.json(HEALTH_RESPONSE);
});

app.get("/api/db/health", async (c) => {
  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);
    const [row] = await sql<DatabaseHealthRow[]>`
      select
        1 as ok,
        current_database() as database,
        current_setting('server_version') as server_version
    `;

    if (row?.ok !== 1) {
      return c.json(
        {
          error: {
            code: "database_health_check_failed",
            message: "Database health check did not return the expected row.",
          },
        },
        503,
      );
    }

    const response: DatabaseHealthResponse = {
      status: "ok",
      database: row.database,
      serverVersion: row.server_version,
    };

    return c.json(response);
  } catch (error) {
    console.error("Database health check failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "database_unavailable",
          message: "Database health check failed.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close database health check client", toSafeLogError(error));
    }
  }
});

app.post("/api/transform-jobs", (c) => {
  return handleCreateTransformJob(c);
});

app.post("/api/posts", (c) => {
  return handleCreateTransformJob(c, { kind: "post_575" });
});

app.post("/api/posts/:postId/replies", (c) => {
  return handleCreateTransformJob(c, {
    kind: "reply_77",
    parentPostId: c.req.param("postId"),
  });
});

app.get("/api/transform-jobs/:id", async (c) => {
  const jobId = c.req.param("id");

  if (!UUID_PATTERN.test(jobId)) {
    return c.json(
      {
        error: {
          code: "bad_request" satisfies ApiErrorCode,
          message: "The transform job id must be a UUID.",
        },
      },
      400,
    );
  }

  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
  const accountId = await getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);

  if (!accountId) {
    return c.json(
      {
        error: {
          code: "unauthorized" satisfies ApiErrorCode,
          message: "Authentication is required to read this transform job.",
        },
      },
      401,
    );
  }

  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);
    const job = await selectTransformJob(sql, jobId);

    if (!job || job.account_id !== accountId) {
      return c.json(
        {
          error: {
            code: "not_found" satisfies ApiErrorCode,
            message: "Transform job not found.",
          },
        },
        404,
      );
    }

    const response: TransformJobResponseDto = {
      job: toTransformJobDto(job),
    };

    c.header("Cache-Control", "no-store");

    return c.json(response);
  } catch (error) {
    console.error("Transform job lookup failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "service_unavailable" satisfies ApiErrorCode,
          message: "Transform job is temporarily unavailable.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close transform job lookup database client", toSafeLogError(error));
    }
  }
});

app.get("/api/timeline", async (c) => {
  const limit = parseTimelineLimit(c.req.query("limit"));

  if (limit === undefined) {
    return c.json(
      {
        error: {
          code: "bad_request",
          message: "The limit query parameter must be a positive integer.",
        },
      },
      400,
    );
  }

  const cursorValue = c.req.query("cursor");
  const cursor = parseTimelineCursor(cursorValue);

  if (cursorValue !== undefined && cursor === undefined) {
    return c.json(
      {
        error: {
          code: "bad_request",
          message: "The cursor query parameter is invalid.",
        },
      },
      400,
    );
  }

  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);
    const rows = await sql<TimelineRow[]>`
      with timeline_posts as (
        select
          p.id::text as post_id,
          p.thread_id,
          pa.id::text as post_author_id,
          pa.display_name as post_author_display_name,
          pa.handle as post_author_handle,
          p.public_text as post_body,
          to_char(
            p.created_at at time zone 'utc',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) as post_created_at,
          to_char(
            p.published_at at time zone 'utc',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) as post_published_at,
          p.published_at as post_published_sort
        from public_conversions p
        join threads t on t.id = p.thread_id
        join accounts pa on pa.id = p.account_id
        where
          p.kind = 'post'
          and p.is_published = true
          and p.deleted_at is null
          and t.deleted_at is null
          and pa.deleted_at is null
          ${
            cursor
              ? sql`and (p.published_at, p.id) < (${cursor.publishedAt}::timestamptz, ${cursor.id}::uuid)`
              : sql``
          }
        order by p.published_at desc, p.id desc
        limit ${limit + 1}
      ),
      page_posts as (
        select *
        from timeline_posts
        order by post_published_sort desc, post_id desc
        limit ${limit}
      ),
      page_state as (
        select exists(
          select 1
          from timeline_posts
          offset ${limit}
          limit 1
        ) as has_next
      ),
      public_replies as (
        select
          r.id::text as reply_id,
          r.thread_id,
          ra.id::text as reply_author_id,
          ra.display_name as reply_author_display_name,
          ra.handle as reply_author_handle,
          r.public_text as reply_body,
          to_char(
            r.created_at at time zone 'utc',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) as reply_created_at,
          r.published_at as reply_published_sort
        from public_conversions r
        join page_posts pp on pp.thread_id = r.thread_id
        join accounts ra on ra.id = r.account_id
        where
          r.kind = 'reply'
          and r.is_published = true
          and r.deleted_at is null
          and ra.deleted_at is null
      )
      select
        pp.post_id,
        pp.post_author_id,
        pp.post_author_display_name,
        pp.post_author_handle,
        pp.post_body,
        pp.post_created_at,
        pp.post_published_at,
        pr.reply_id,
        pr.reply_author_id,
        pr.reply_author_display_name,
        pr.reply_author_handle,
        pr.reply_body,
        pr.reply_created_at,
        ps.has_next
      from page_posts pp
      cross join page_state ps
      left join public_replies pr on pr.thread_id = pp.thread_id
      order by
        pp.post_published_sort desc,
        pp.post_id desc,
        pr.reply_published_sort asc,
        pr.reply_id asc
    `;

    c.header("Cache-Control", PUBLIC_TIMELINE_CACHE_CONTROL);

    return c.json(toTimelineResponse(rows));
  } catch (error) {
    console.error("Timeline query failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "service_unavailable",
          message: "Timeline is temporarily unavailable.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close timeline database client", toSafeLogError(error));
    }
  }
});

app.delete("/api/public-conversions/:id", async (c) => {
  const publicConversionId = c.req.param("id");

  if (!UUID_PATTERN.test(publicConversionId)) {
    return c.json(
      {
        error: {
          code: "bad_request",
          message: "The public conversion id must be a UUID.",
        },
      },
      400,
    );
  }

  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
  const accountId = await getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);

  if (!accountId) {
    return c.json(
      {
        error: {
          code: "unauthorized",
          message: "Authentication is required for this write operation.",
        },
      },
      401,
    );
  }

  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);
    const result = await sql.begin(async (transaction) => {
      const [row] = await transaction<DeletePublicConversionResult[]>`
        with target as (
          select
            id,
            account_id,
            kind,
            thread_id
          from public_conversions
          where
            id = ${publicConversionId}::uuid
            and is_published = true
            and deleted_at is null
        ),
        authorized as (
          select *
          from target
          where account_id = ${accountId}::uuid
        ),
        deleted_conversions as (
          update public_conversions pc
          set
            is_published = false,
            deleted_at = now()
          from authorized a
          where
            (
              pc.id = a.id
              or (
                a.kind = 'post'
                and pc.thread_id = a.thread_id
                and pc.kind = 'reply'
              )
            )
            and pc.is_published = true
            and pc.deleted_at is null
          returning pc.id
        ),
        deleted_threads as (
          update threads t
          set
            deleted_at = now(),
            updated_at = now()
          from authorized a
          where
            a.kind = 'post'
            and t.id = a.thread_id
            and t.deleted_at is null
          returning t.id
        )
        select
          exists(select 1 from target) as exists,
          exists(select 1 from authorized) as authorized,
          (select count(*)::int from deleted_conversions) as deleted_count
      `;

      return row;
    });

    if (!result?.exists) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Public conversion not found.",
          },
        },
        404,
      );
    }

    if (!result.authorized) {
      return c.json(
        {
          error: {
            code: "forbidden",
            message: "Only the author can delete this public conversion.",
          },
        },
        403,
      );
    }

    c.header("Cache-Control", "no-store");

    return c.json({
      deleted: true,
      deletedCount: result.deleted_count,
    });
  } catch (error) {
    console.error("Public conversion delete failed", toSafeLogError(error));

    return c.json(
      {
        error: {
          code: "service_unavailable",
          message: "Public conversion could not be deleted.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error(
        "Failed to close public conversion delete database client",
        toSafeLogError(error),
      );
    }
  }
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "not_found",
        message: "Route not found.",
      },
    },
    404,
  ),
);

export default app;
