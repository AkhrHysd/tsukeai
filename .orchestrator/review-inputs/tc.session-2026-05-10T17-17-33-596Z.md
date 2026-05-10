# Review Task

Task ID: tc.session
Title: セッション／Cookie と書き込み境界

Workspace Path: /Users/akyrhysd/work/tanka-reply-sns/.worktrees/tc.session

## Description
投稿・返信・削除はログイン後のみ。Workers 側で検証。

## Allowed Paths
- apps/api

## Acceptance Criteria
- 書き込み API が未認証で拒否される。

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
npm error A complete log of this run can be found in: /var/folders/n2/cxypjnxj15jg_ps764m9sdrw0000gn/T/cursor-sandbox-cache/7afdc93aaa86e33c9dd2fc139830d468/npm/_logs/2026-05-10T17_17_33_558Z-debug-0.log

## Changed Files
- apps/api/src/index.ts

## Unified Diff
```diff
diff --git a/apps/api/src/index.ts b/apps/api/src/index.ts
index 799008e..c00c3b6 100644
--- a/apps/api/src/index.ts
+++ b/apps/api/src/index.ts
@@ -1,10 +1,13 @@
 import { Hono } from "hono";
+import { getCookie } from "hono/cookie";
 import { cors } from "hono/cors";
 import postgres from "postgres";
 
 type Bindings = {
   API_ALLOWED_ORIGINS?: string;
   HYPERDRIVE: Hyperdrive;
+  SESSION_COOKIE_NAME?: string;
+  SESSION_SECRET?: string;
 };
 
 type HealthResponse = {
@@ -25,6 +28,7 @@ type DatabaseHealthResponse = {
 };
 
 const LOCAL_WEB_ORIGIN = "http://localhost:3000";
+const DEFAULT_SESSION_COOKIE_NAME = "__Host-tanka_session";
 const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
 const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
 const HEALTH_RESPONSE: HealthResponse = {
@@ -52,6 +56,72 @@ function allowedOrigins(value: string | undefined): string[] {
   return origins.length > 0 ? origins : [LOCAL_WEB_ORIGIN];
 }
 
+function isProtectedWrite(method: string, path: string): boolean {
+  return (
+    (method === "POST" || method === "DELETE") &&
+    path.startsWith("/api/") &&
+    !/^\/api\/(?:auth|sessions)(?:\/|$)/.test(path)
+  );
+}
+
+function toBase64Url(buffer: ArrayBuffer): string {
+  const bytes = new Uint8Array(buffer);
+  let binary = "";
+
+  for (const byte of bytes) {
+    binary += String.fromCharCode(byte);
+  }
+
+  return btoa(binary)
+    .replaceAll("+", "-")
+    .replaceAll("/", "_")
+    .replaceAll("=", "");
+}
+
+function signaturesMatch(actual: string, expected: string): boolean {
+  if (actual.length !== expected.length) {
+    return false;
+  }
+
+  let difference = 0;
+
+  for (let index = 0; index < actual.length; index += 1) {
+    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
+  }
+
+  return difference === 0;
+}
+
+async function verifySessionCookie(
+  cookieValue: string | undefined,
+  secret: string | undefined,
+): Promise<boolean> {
+  if (!cookieValue || !secret) {
+    return false;
+  }
+
+  const separatorIndex = cookieValue.indexOf(".");
+
+  if (separatorIndex <= 0 || separatorIndex === cookieValue.length - 1) {
+    return false;
+  }
+
+  const accountId = cookieValue.slice(0, separatorIndex);
+  const signature = cookieValue.slice(separatorIndex + 1);
+  const key = await crypto.subtle.importKey(
+    "raw",
+    new TextEncoder().encode(secret),
+    { name: "HMAC", hash: "SHA-256" },
+    false,
+    ["sign"],
+  );
+  const expectedSignature = toBase64Url(
+    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accountId)),
+  );
+
+  return signaturesMatch(signature, expectedSignature);
+}
+
 app.use("*", async (c, next) => {
   const middleware = cors({
     origin: allowedOrigins(c.env.API_ALLOWED_ORIGINS),
@@ -65,6 +135,32 @@ app.use("*", async (c, next) => {
   return middleware(c, next);
 });
 
+app.use("*", async (c, next) => {
+  if (!isProtectedWrite(c.req.method, c.req.path)) {
+    return next();
+  }
+
+  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
+  const isAuthenticated = await verifySessionCookie(
+    getCookie(c, cookieName),
+    c.env.SESSION_SECRET,
+  );
+
+  if (isAuthenticated) {
+    return next();
+  }
+
+  return c.json(
+    {
+      error: {
+        code: "unauthorized",
+        message: "Authentication is required for this write operation.",
+      },
+    },
+    401,
+  );
+});
+
 app.get("/health", (c) => {
   return c.json(HEALTH_RESPONSE);
 });

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