# Review Task

Task ID: tc.neon
Title: Neon と Hyperdrive の接続方針

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.neon

## Description
東京 Postgres へ Hyperdrive。秘密はリポジトリ外。

## Allowed Paths
- apps/api
- docs/orchestration

## Acceptance Criteria
- Hyperdrive 経由で Neon 接続を再現できる。

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
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_11_01_718Z-debug-0.log

## Changed Files
- apps/api/package.json
- apps/api/src/index.ts
- apps/api/wrangler.toml
- docs/orchestration/neon-hyperdrive.md

## Unified Diff
```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index 4217afb..2c18a24 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -11,7 +11,8 @@
   },
   "dependencies": {
     "@tanka-reply-sns/shared": "workspace:*",
-    "hono": "^4.7.0"
+    "hono": "^4.7.0",
+    "postgres": "^3.4.5"
   },
   "devDependencies": {
     "@cloudflare/workers-types": "^4.20250411.0",
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index bd890e2..799008e 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1,8 +1,10 @@
 import { Hono } from "hono";
 import { cors } from "hono/cors";
+import postgres from "postgres";
 
 type Bindings = {
   API_ALLOWED_ORIGINS?: string;
+  HYPERDRIVE: Hyperdrive;
 };
 
 type HealthResponse = {
@@ -10,6 +12,18 @@ type HealthResponse = {
   service: "api";
 };
 
+type DatabaseHealthRow = {
+  ok: number;
+  database: string;
+  server_version: string;
+};
+
+type DatabaseHealthResponse = {
+  status: "ok";
+  database: string;
+  serverVersion: string;
+};
+
 const LOCAL_WEB_ORIGIN = "http://localhost:3000";
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
@@ -20,6 +34,14 @@ const HEALTH_RESPONSE: HealthResponse = {
 
 const app = new Hono<{ Bindings: Bindings }>();
 
+function createSql(connectionString: string) {
+  return postgres(connectionString, {
+    max: 1,
+    fetch_types: false,
+    prepare: false,
+  });
+}
+
 function allowedOrigins(value: string | undefined): string[] {
   const origins =
     value
@@ -51,6 +73,58 @@ app.get("/api/health", (c) => {
   return c.json(HEALTH_RESPONSE);
 });
 
+app.get("/api/db/health", async (c) => {
+  let sql: ReturnType<typeof createSql> | undefined;
+
+  try {
+    sql = createSql(c.env.HYPERDRIVE.connectionString);
+    const [row] = await sql<DatabaseHealthRow[]>`
+      select
+        1 as ok,
+        current_database() as database,
+        current_setting('server_version') as server_version
+    `;
+
+    if (row?.ok !== 1) {
+      return c.json(
+        {
+          error: {
+            code: "database_health_check_failed",
+            message: "Database health check did not return the expected row.",
+          },
+        },
+        503,
+      );
+    }
+
+    const response: DatabaseHealthResponse = {
+      status: "ok",
+      database: row.database,
+      serverVersion: row.server_version,
+    };
+
+    return c.json(response);
+  } catch (error) {
+    console.error("Database health check failed", error);
+
+    return c.json(
+      {
+        error: {
+          code: "database_unavailable",
+          message: "Database health check failed.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error("Failed to close database health check client", error);
+    }
+  }
+});
+
 app.notFound((c) =>
   c.json(
     {
diff --git a/apps/api/wrangler.toml b/apps/api/wrangler.toml
index d89d45a..4ebeb54 100644
--- a/apps/api/wrangler.toml
+++ b/apps/api/wrangler.toml
@@ -1,6 +1,13 @@
 name = "tanka-reply-sns-api"
 main = "src/index.ts"
 compatibility_date = "2025-04-01"
+compatibility_flags = ["nodejs_compat"]
 
 [vars]
 API_ALLOWED_ORIGINS = "http://localhost:3000"
+
+[[hyperdrive]]
+binding = "HYPERDRIVE"
+# Keep the real Cloudflare resource ID outside git and substitute it at deploy
+# time. See docs/orchestration/neon-hyperdrive.md for the exact command.
+id = "<hyperdrive-id>"

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