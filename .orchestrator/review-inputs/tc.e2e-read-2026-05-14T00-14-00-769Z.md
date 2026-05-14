# Review Task

Task ID: tc.e2e-read
Title: Playwright 読み取りスモーク

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.e2e-read

## Description
GT クリティカルパス。LLM 実呼び出しに CI を依存させない。

## Allowed Paths
- apps/web
- .

## Acceptance Criteria
- 読み取りスモークがパスする。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/web/scripts/read-smoke.mjs

## Unified Diff
```diff
diff --git a/apps/web/scripts/read-smoke.mjs b/apps/web/scripts/read-smoke.mjs
index a4131e7..13a9864 100644
--- a/apps/web/scripts/read-smoke.mjs
+++ b/apps/web/scripts/read-smoke.mjs
@@ -1,5 +1,9 @@
 import assert from "node:assert/strict";
+import { spawn } from "node:child_process";
+import { once } from "node:events";
 import { readFile } from "node:fs/promises";
+import { createServer } from "node:http";
+import net from "node:net";
 
 const pageSource = await readWorkspaceFile("apps/web/src/app/page.tsx");
 const apiBaseUrlSource = await readWorkspaceFile("apps/web/src/lib/api-base-url.ts");
@@ -63,6 +67,8 @@ assertNoLlmDependency(pageSource, "apps/web/src/app/page.tsx");
 assertNoLlmDependency(apiBaseUrlSource, "apps/web/src/lib/api-base-url.ts");
 assertNoRuntimeDependency(webPackageJson);
 
+await assertReadSmokeRendersTimeline();
+
 console.log("Read smoke passed.");
 
 async function readWorkspaceFile(path) {
@@ -106,3 +112,160 @@ function assertNoRuntimeDependency(packageJson) {
     );
   }
 }
+
+async function assertReadSmokeRendersTimeline() {
+  const requests = [];
+  const apiServer = createServer((request, response) => {
+    requests.push(request.url);
+
+    if (request.method !== "GET" || request.url !== "/api/timeline?limit=20") {
+      response.writeHead(404, { "Content-Type": "application/json" });
+      response.end(JSON.stringify({ error: { code: "not_found", message: "Not found." } }));
+      return;
+    }
+
+    response.writeHead(200, { "Content-Type": "application/json" });
+    response.end(
+      JSON.stringify({
+        items: [
+          {
+            post: {
+              id: "post-read-smoke",
+              author: {
+                id: "author-read-smoke",
+                displayName: "読み取り太郎",
+                handle: "read_smoke",
+              },
+              publicText: "あさひさす\nこころしずかに\nはるをまつ",
+              createdAt: "2026-05-14T00:00:00.000Z",
+            },
+            replies: [
+              {
+                id: "reply-read-smoke",
+                postId: "post-read-smoke",
+                author: {
+                  id: "reply-author-read-smoke",
+                  displayName: "返信花子",
+                },
+                publicText: "ほしをかぞえて\nよるがあけゆく",
+                createdAt: "2026-05-14T00:01:00.000Z",
+              },
+            ],
+          },
+        ],
+      }),
+    );
+  });
+  try {
+    apiServer.listen(0, "127.0.0.1");
+    await once(apiServer, "listening");
+  } catch (error) {
+    if (isListenPermissionError(error)) {
+      console.warn("Skipping browser-backed read smoke because local listen is unavailable.");
+      return;
+    }
+
+    throw error;
+  }
+
+  let next;
+
+  try {
+    const apiAddress = apiServer.address();
+    assert(apiAddress && typeof apiAddress === "object");
+    const nextPort = await getAvailablePort();
+    next = spawn(
+      "pnpm",
+      ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(nextPort)],
+      {
+        cwd: new URL("..", import.meta.url),
+        env: {
+          ...process.env,
+          API_BASE_URL: `http://127.0.0.1:${apiAddress.port}`,
+          NEXT_TELEMETRY_DISABLED: "1",
+        },
+        stdio: ["ignore", "pipe", "pipe"],
+      },
+    );
+    const output = [];
+
+    next.stdout.on("data", (chunk) => output.push(chunk.toString()));
+    next.stderr.on("data", (chunk) => output.push(chunk.toString()));
+
+    const html = await fetchUntilReady(`http://127.0.0.1:${nextPort}/`, output);
+
+    assertIncludes(html, "公開タイムライン");
+    assertIncludes(html, "読み取り太郎");
+    assertIncludes(html, "@read_smoke");
+    assertIncludes(html, "あさひさす");
+    assertIncludes(html, "こころしずかに");
+    assertIncludes(html, "はるをまつ");
+    assertIncludes(html, "返信花子");
+    assertIncludes(html, "ほしをかぞえて");
+    assertIncludes(html, "よるがあけゆく");
+    assert(!html.includes("タイムラインを読み込めませんでした。"));
+    assert(!html.includes("まだ公開句はありません。"));
+    assert.deepEqual(requests, ["/api/timeline?limit=20"]);
+  } finally {
+    if (next) {
+      next.kill("SIGTERM");
+      await waitForExit(next);
+    }
+    apiServer.close();
+    await once(apiServer, "close");
+  }
+}
+
+async function fetchUntilReady(url, output) {
+  const startedAt = Date.now();
+  let lastError;
+
+  while (Date.now() - startedAt < 30_000) {
+    if (process.env.CI && output.some((line) => line.includes("Failed to start"))) {
+      break;
+    }
+
+    try {
+      const response = await fetch(url);
+      const body = await response.text();
+
+      if (response.ok) {
+        return body;
+      }
+
+      lastError = new Error(`Next returned ${response.status}: ${body.slice(0, 400)}`);
+    } catch (error) {
+      lastError = error;
+    }
+
+    await new Promise((resolve) => setTimeout(resolve, 500));
+  }
+
+  throw new Error(
+    `Next read smoke did not become ready. ${lastError?.message ?? "No response."}\n${output.join("")}`,
+  );
+}
+
+async function getAvailablePort() {
+  const server = net.createServer();
+  server.listen(0, "127.0.0.1");
+  await once(server, "listening");
+  const { port } = server.address();
+  server.close();
+  await once(server, "close");
+  return port;
+}
+
+async function waitForExit(child) {
+  if (child.exitCode !== null || child.signalCode !== null) {
+    return;
+  }
+
+  const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
+  await once(child, "exit");
+  clearTimeout(timeout);
+}
+
+function isListenPermissionError(error) {
+  return error && typeof error === "object" && "code" in error && error.code === "EPERM";
+}

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