# Review Task

Task ID: tc.session
Title: セッション／Cookie と書き込み境界

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.session

## Description
投稿・返信・削除はログイン後のみ。Workers 側で検証。**セッション状態の単一正本**（Neon のみとするか KV 併用か等）は **S1 スパイク結果に合わせ orchestration に文書化**する。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 書き込み API が未認証で拒否される。
- セッション状態の単一正本（Neon のみ／KV 併用等）が orchestration に記載される。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/src/index.ts
- apps/api/ORCHESTRATION.md

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 711ca1c..31b4b19 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -35,7 +35,11 @@ type Bindings = LlmAdapterBindings & {
   WRITE_SMOKE_FIXED_PUBLIC_TEXT?: string;
 };
 
-type AppContext = Context<{ Bindings: Bindings }>;
+type Variables = {
+  accountId?: string;
+};
+
+type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
 
 type HealthResponse = {
   status: "ok";
@@ -167,7 +171,7 @@ const HEALTH_RESPONSE: HealthResponse = {
   service: "api",
 };
 
-const app = new Hono<{ Bindings: Bindings }>();
+const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
 
 function toSafeLogError(error: unknown): SafeLogError {
   if (!(error instanceof Error)) {
@@ -295,13 +299,6 @@ function signaturesMatch(actual: string, expected: string): boolean {
   return difference === 0;
 }
 
-async function verifySessionCookie(
-  cookieValue: string | undefined,
-  secret: string | undefined,
-): Promise<boolean> {
-  return (await getSessionAccountId(cookieValue, secret)) !== undefined;
-}
-
 async function getSessionAccountId(
   cookieValue: string | undefined,
   secret: string | undefined,
@@ -337,6 +334,33 @@ async function getSessionAccountId(
   return signaturesMatch(signature, expectedSignature) ? accountId : undefined;
 }
 
+async function activeAccountExists(
+  sql: ReturnType<typeof createSql>,
+  accountId: string,
+): Promise<boolean> {
+  const [row] = await sql<{ exists: boolean }[]>`
+    select exists (
+      select 1
+      from accounts
+      where id = ${accountId}::uuid and deleted_at is null
+    ) as exists
+  `;
+
+  return row?.exists === true;
+}
+
+async function getRequestSessionAccountId(c: AppContext): Promise<string | undefined> {
+  const contextAccountId = c.get("accountId");
+
+  if (contextAccountId) {
+    return contextAccountId;
+  }
+
+  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
+
+  return getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);
+}
+
 async function sha256Hex(value: string): Promise<string> {
   const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
 
@@ -1396,13 +1420,19 @@ async function handleCreateTransformJob(
   c: AppContext,
   forcedInput?: Pick<TransformJobCreateInput, "kind" | "parentPostId">,
 ) {
-  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
-  const existingAccountId = await getSessionAccountId(
-    getCookie(c, cookieName),
-    c.env.SESSION_SECRET,
-  );
-  const accountId = existingAccountId ?? crypto.randomUUID();
-  const shouldEnsureAccount = existingAccountId === undefined;
+  const accountId = await getRequestSessionAccountId(c);
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
 
   const body = await readTransformJobBody(c.req.raw);
 
@@ -1461,14 +1491,6 @@ async function handleCreateTransformJob(
   try {
     sql = createSql(c.env.HYPERDRIVE.connectionString);
 
-    if (shouldEnsureAccount) {
-      await sql`
-        insert into accounts (id, display_name)
-        values (${accountId}::uuid, '匿名')
-        on conflict (id) do nothing
-      `;
-    }
-
     if (parsed.kind === "reply_77") {
       const parentPost =
         parsed.parentPostId === undefined
@@ -1615,11 +1637,48 @@ app.use("*", async (c, next) => {
     return next();
   }
 
-  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
-  const isAuthenticated = await verifySessionCookie(getCookie(c, cookieName), c.env.SESSION_SECRET);
+  const accountId = await getRequestSessionAccountId(c);
 
-  if (isAuthenticated) {
-    return next();
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
+
+    if (await activeAccountExists(sql, accountId)) {
+      c.set("accountId", accountId);
+
+      return next();
+    }
+  } catch (error) {
+    console.error("Session account verification failed", toSafeLogError(error));
+
+    return c.json(
+      {
+        error: {
+          code: "service_unavailable",
+          message: "Authentication could not be verified.",
+        },
+      },
+      503,
+    );
+  } finally {
+    try {
+      await sql?.end({ timeout: 5 });
+    } catch (error) {
+      console.error("Failed to close session verification database client", toSafeLogError(error));
+    }
   }
 
   return c.json(
@@ -1719,8 +1778,7 @@ app.get("/api/transform-jobs/:id", async (c) => {
     );
   }
 
-  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
-  const accountId = await getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);
+  const accountId = await getRequestSessionAccountId(c);
 
   if (!accountId) {
     return c.json(
@@ -1949,8 +2007,7 @@ app.delete("/api/public-conversions/:id", async (c) => {
     );
   }
 
-  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
-  const accountId = await getSessionAccountId(getCookie(c, cookieName), c.env.SESSION_SECRET);
+  const accountId = await getRequestSessionAccountId(c);
 
   if (!accountId) {
     return c.json(

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