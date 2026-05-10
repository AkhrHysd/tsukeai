# Review Task

Task ID: tc.timeline
Title: 公開タイムライン GET API

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.timeline

## Description
未ログインで取得可能な JSON。キャッシュはプライバシーと整合する範囲のみ。

## Allowed Paths
- apps/api
- packages/shared

## Acceptance Criteria
- 未認証でタイムライン JSON が取得できる。

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
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_21_09_717Z-debug-0.log

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index c00c3b6..295a7a1 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1,6 +1,11 @@
 import { Hono } from "hono";
 import { getCookie } from "hono/cookie";
 import { cors } from "hono/cors";
+import type {
+  ReplyDto,
+  TimelineItemDto,
+  TimelineResponseDto,
+} from "@tanka-reply-sns/shared";
 import postgres from "postgres";
 
 type Bindings = {
@@ -27,10 +32,38 @@ type DatabaseHealthResponse = {
   serverVersion: string;
 };
 
+type TimelineCursor = {
+  publishedAt: string;
+  id: string;
+};
+
+type TimelineRow = {
+  post_id: string;
+  post_author_id: string;
+  post_author_display_name: string;
+  post_author_handle: string | null;
+  post_body: string;
+  post_created_at: string;
+  post_published_at: string;
+  reply_id: string | null;
+  reply_author_id: string | null;
+  reply_author_display_name: string | null;
+  reply_author_handle: string | null;
+  reply_body: string | null;
+  reply_created_at: string | null;
+  has_next: boolean;
+};
+
 const LOCAL_WEB_ORIGIN = "http://localhost:3000";
 const DEFAULT_SESSION_COOKIE_NAME = "__Host-tanka_session";
+const DEFAULT_TIMELINE_LIMIT = 20;
+const MAX_TIMELINE_LIMIT = 50;
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
+const PUBLIC_TIMELINE_CACHE_CONTROL =
+  "public, max-age=30, stale-while-revalidate=60";
+const UUID_PATTERN =
+  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const HEALTH_RESPONSE: HealthResponse = {
   status: "ok",
   service: "api",
@@ -64,6 +97,20 @@ function isProtectedWrite(method: string, path: string): boolean {
   );
 }
 
+function parseTimelineLimit(value: string | undefined): number | undefined {
+  if (value === undefined) {
+    return DEFAULT_TIMELINE_LIMIT;
+  }
+
+  const limit = Number(value);
+
+  if (!Number.isInteger(limit) || limit < 1) {
+    return undefined;
+  }
+
+  return Math.min(limit, MAX_TIMELINE_LIMIT);
+}
+
 function toBase64Url(buffer: ArrayBuffer): string {
   const bytes = new Uint8Array(buffer);
   let binary = "";
@@ -78,6 +125,52 @@ function toBase64Url(buffer: ArrayBuffer): string {
     .replaceAll("=", "");
 }
 
+function encodeBase64Url(value: string): string {
+  return btoa(value)
+    .replaceAll("+", "-")
+    .replaceAll("/", "_")
+    .replaceAll("=", "");
+}
+
+function decodeBase64Url(value: string): string {
+  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
+  const paddingLength = (4 - (base64.length % 4)) % 4;
+
+  return atob(`${base64}${"=".repeat(paddingLength)}`);
+}
+
+function encodeTimelineCursor(cursor: TimelineCursor): string {
+  return encodeBase64Url(JSON.stringify(cursor));
+}
+
+function parseTimelineCursor(
+  value: string | undefined,
+): TimelineCursor | undefined {
+  if (value === undefined) {
+    return undefined;
+  }
+
+  try {
+    const cursor = JSON.parse(decodeBase64Url(value)) as Partial<TimelineCursor>;
+
+    if (
+      typeof cursor.publishedAt !== "string" ||
+      Number.isNaN(Date.parse(cursor.publishedAt)) ||
+      typeof cursor.id !== "string" ||
+      !UUID_PATTERN.test(cursor.id)
+    ) {
+      return undefined;
+    }
+
+    return {
+      publishedAt: cursor.publishedAt,
+      id: cursor.id,
+    };
+  } catch {
+    return undefined;
+  }
+}
+
 function signaturesMatch(actual: string, expected: string): boolean {
   if (actual.length !== expected.length) {
     return false;
@@ -122,6 +215,72 @@ async function verifySessionCookie(
   return signaturesMatch(signature, expectedSignature);
 }
 
+function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
+  const itemsByPostId = new Map<string, TimelineItemDto>();
+  let lastPostCursor: TimelineCursor | undefined;
+
+  for (const row of rows) {
+    let item = itemsByPostId.get(row.post_id);
+
+    if (!item) {
+      item = {
+        post: {
+          id: row.post_id,
+          author: {
+            id: row.post_author_id,
+            displayName: row.post_author_display_name,
+            ...(row.post_author_handle
+              ? { handle: row.post_author_handle }
+              : {}),
+          },
+          body: row.post_body,
+          createdAt: row.post_created_at,
+        },
+        replies: [],
+      };
+      itemsByPostId.set(row.post_id, item);
+      lastPostCursor = {
+        publishedAt: row.post_published_at,
+        id: row.post_id,
+      };
+    }
+
+    if (
+      row.reply_id &&
+      row.reply_author_id &&
+      row.reply_author_display_name &&
+      row.reply_body &&
+      row.reply_created_at
+    ) {
+      const reply: ReplyDto = {
+        id: row.reply_id,
+        postId: row.post_id,
+        author: {
+          id: row.reply_author_id,
+          displayName: row.reply_author_display_name,
+          ...(row.reply_author_handle
+            ? { handle: row.reply_author_handle }
+            : {}),
+        },
+        body: row.reply_body,
+        createdAt: row.reply_created_at,
+      };
+
+      item.replies.push(reply);
+    }
+  }
+
+  const hasNext = rows.some((row) => row.has_next);
+  const items = Array.from(itemsByPostId.values());
+
+  return {
+    items,
+    ...(hasNext && lastPostCursor
+      ? { nextCursor: encodeTimelineCursor(lastPostCursor) }
+      : {}),
+  };
+}
+
 app.use("*", async (c, next) => {
   const middleware = cors({
     origin: allowedOrigins(c.env.API_ALLOWED_ORIGINS),
@@ -221,6 +380,158 @@ app.get("/api/db/health", async (c) => {
   }
 });
 
+app.get("/api/timeline", async (c) => {
+  const limit = parseTimelineLimit(c.req.query("limit"));
+
+  if (limit === undefined) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request",
+          message: "The limit query parameter must be a positive integer.",
+        },
+      },
+      400,
+    );
+  }
+
+  const cursorValue = c.req.query("cursor");
+  const cursor = parseTimelineCursor(cursorValue);
+
+  if (cursorValue !== undefined && cursor === undefined) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request",
+          message: "The cursor query parameter is invalid.",
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
+    const rows = await sql<TimelineRow[]>`
+      with timeline_posts as (
+        select
+          p.id::text as post_id,
+          p.thread_id,
+          pa.id::text as post_author_id,
+          pa.display_name as post_author_display_name,
+          pa.handle as post_author_handle,
+          p.public_text as post_body,
+          to_char(
+            p.created_at at time zone 'utc',
+            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
+          ) as post_created_at,
+          to_char(
+            p.published_at at time zone 'utc',
+            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
+          ) as post_published_at,
+          p.published_at as post_published_sort
+        from public_conversions p
+        join accounts pa on pa.id = p.account_id
+        where
+          p.kind = 'post'
+          and p.is_published = true
+          and p.deleted_at is null
+          and pa.deleted_at is null
+          ${
+            cursor
+              ? sql`and (p.published_at, p.id) < (${cursor.publishedAt}::timestamptz, ${cursor.id}::uuid)`
+              : sql``
+          }
+        order by p.published_at desc, p.id desc
+        limit ${limit + 1}
+      ),
+      page_posts as (
+        select *
+        from timeline_posts
+        order by post_published_sort desc, post_id desc
+        limit ${limit}
+      ),
+      page_state as (
+        select exists(
+          select 1
+          from timeline_posts
+          offset ${limit}
+          limit 1
+        ) as has_next
+      ),
+      public_replies as (
+        select
+          r.id::text as reply_id,
+          r.thread_id,
+          ra.id::text as reply_author_id,
+          ra.display_name as reply_author_display_name,
+          ra.handle as reply_author_handle,
+          r.public_text as reply_body,
+          to_char(
+            r.created_at at time zone 'utc',
+            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
+          ) as reply_created_at,
+          r.published_at as reply_published_sort
+        from public_conversions r
+        join page_posts pp on pp.thread_id = r.thread_id
+        join accounts ra on ra.id = r.account_id
+        where
+          r.kind = 'reply'
+          and r.is_published = true
+          and r.deleted_at is null
+          and ra.deleted_at is null
+      )
+      select
+        pp.post_id,
+        pp.post_author_id,
+        pp.post_author_display_name,
+        pp.post_author_handle,
+        pp.post_body,
+        pp.post_created_at,
+        pp.post_published_at,
+        pr.reply_id,
+        pr.reply_author_id,
+        pr.reply_author_display_name,
+        pr.reply_author_handle,
+        pr.reply_body,
+        pr.reply_created_at,
+        ps.has_next
+      from page_posts pp
+      cross join page_state ps
+      left join public_replies pr on pr.thread_id = pp.thread_id
+      order by
+        pp.post_published_sort desc,
+        pp.post_id desc,
+        pr.reply_published_sort asc,
+        pr.reply_id asc
+    `;
+
+    c.header("Cache-Control", PUBLIC_TIMELINE_CACHE_CONTROL);
+
+    return c.json(toTimelineResponse(rows));
+  } catch (error) {
+    console.error("Timeline query failed", error);
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable",
+          message: "Timeline is temporarily unavailable.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error("Failed to close timeline database client", error);
+    }
+  }
+});
+
 app.notFound((c) =>
   c.json(
     {

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