# Review Task

Task ID: tc.delete
Title: 本人削除（M6）

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.delete

## Description
公開句の削除または非表示。管理者削除は MVP 外。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 本人削除後に一覧／スレッドが一貫する。

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


> @tanka-reply-sns/web@0.0.0 test /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.delete/apps/web
> pnpm run smoke:read


> @tanka-reply-sns/web@0.0.0 smoke:read /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.delete/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 308a92a..e9bf4f4 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -55,6 +55,12 @@ type TimelineRow = {
   has_next: boolean;
 };
 
+type DeletePublicConversionResult = {
+  exists: boolean;
+  authorized: boolean;
+  deleted_count: number;
+};
+
 type SafeLogError = {
   name: string;
   code?: string;
@@ -66,8 +72,7 @@ const DEFAULT_TIMELINE_LIMIT = 20;
 const MAX_TIMELINE_LIMIT = 50;
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
-const PUBLIC_TIMELINE_CACHE_CONTROL =
-  "public, max-age=30, stale-while-revalidate=60";
+const PUBLIC_TIMELINE_CACHE_CONTROL = "no-store";
 const UUID_PATTERN =
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const HEALTH_RESPONSE: HealthResponse = {
@@ -209,18 +214,30 @@ async function verifySessionCookie(
   cookieValue: string | undefined,
   secret: string | undefined,
 ): Promise<boolean> {
+  return (await getSessionAccountId(cookieValue, secret)) !== undefined;
+}
+
+async function getSessionAccountId(
+  cookieValue: string | undefined,
+  secret: string | undefined,
+): Promise<string | undefined> {
   if (!cookieValue || !secret) {
-    return false;
+    return undefined;
   }
 
   const separatorIndex = cookieValue.indexOf(".");
 
   if (separatorIndex <= 0 || separatorIndex === cookieValue.length - 1) {
-    return false;
+    return undefined;
   }
 
   const accountId = cookieValue.slice(0, separatorIndex);
   const signature = cookieValue.slice(separatorIndex + 1);
+
+  if (!UUID_PATTERN.test(accountId)) {
+    return undefined;
+  }
+
   const key = await crypto.subtle.importKey(
     "raw",
     new TextEncoder().encode(secret),
@@ -232,7 +249,7 @@ async function verifySessionCookie(
     await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accountId)),
   );
 
-  return signaturesMatch(signature, expectedSignature);
+  return signaturesMatch(signature, expectedSignature) ? accountId : undefined;
 }
 
 function toTimelineResponse(rows: TimelineRow[]): TimelineResponseDto {
@@ -456,11 +473,13 @@ app.get("/api/timeline", async (c) => {
           ) as post_published_at,
           p.published_at as post_published_sort
         from public_conversions p
+        join threads t on t.id = p.thread_id
         join accounts pa on pa.id = p.account_id
         where
           p.kind = 'post'
           and p.is_published = true
           and p.deleted_at is null
+          and t.deleted_at is null
           and pa.deleted_at is null
           ${
             cursor
@@ -558,6 +577,156 @@ app.get("/api/timeline", async (c) => {
   }
 });
 
+app.delete("/api/public-conversions/:id", async (c) => {
+  const publicConversionId = c.req.param("id");
+
+  if (!UUID_PATTERN.test(publicConversionId)) {
+    return c.json(
+      {
+        error: {
+          code: "bad_request",
+          message: "The public conversion id must be a UUID.",
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
+          code: "unauthorized",
+          message: "Authentication is required for this write operation.",
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
+    const result = await sql.begin(async (transaction) => {
+      const [row] = await transaction<DeletePublicConversionResult[]>`
+        with target as (
+          select
+            id,
+            account_id,
+            kind,
+            thread_id
+          from public_conversions
+          where
+            id = ${publicConversionId}::uuid
+            and is_published = true
+            and deleted_at is null
+        ),
+        authorized as (
+          select *
+          from target
+          where account_id = ${accountId}::uuid
+        ),
+        deleted_conversions as (
+          update public_conversions pc
+          set
+            is_published = false,
+            deleted_at = now()
+          from authorized a
+          where
+            (
+              pc.id = a.id
+              or (
+                a.kind = 'post'
+                and pc.thread_id = a.thread_id
+                and pc.kind = 'reply'
+              )
+            )
+            and pc.is_published = true
+            and pc.deleted_at is null
+          returning pc.id
+        ),
+        deleted_threads as (
+          update threads t
+          set
+            deleted_at = now(),
+            updated_at = now()
+          from authorized a
+          where
+            a.kind = 'post'
+            and t.id = a.thread_id
+            and t.deleted_at is null
+          returning t.id
+        )
+        select
+          exists(select 1 from target) as exists,
+          exists(select 1 from authorized) as authorized,
+          (select count(*)::int from deleted_conversions) as deleted_count
+      `;
+
+      return row;
+    });
+
+    if (!result?.exists) {
+      return c.json(
+        {
+          error: {
+            code: "not_found",
+            message: "Public conversion not found.",
+          },
+        },
+        404,
+      );
+    }
+
+    if (!result.authorized) {
+      return c.json(
+        {
+          error: {
+            code: "forbidden",
+            message: "Only the author can delete this public conversion.",
+          },
+        },
+        403,
+      );
+    }
+
+    c.header("Cache-Control", "no-store");
+
+    return c.json({
+      deleted: true,
+      deletedCount: result.deleted_count,
+    });
+  } catch (error) {
+    console.error("Public conversion delete failed", toSafeLogError(error));
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable",
+          message: "Public conversion could not be deleted.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error(
+        "Failed to close public conversion delete database client",
+        toSafeLogError(error),
+      );
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