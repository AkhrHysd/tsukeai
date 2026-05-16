import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";

const pageSource = await readWorkspaceFile("apps/web/src/app/(protected)/page.tsx");
const timelineItemSource = await readWorkspaceFile("apps/web/src/app/timeline-item.tsx");
const protectedLayoutSource = await readWorkspaceFile("apps/web/src/app/(protected)/layout.tsx");
const loginPageSource = await readWorkspaceFile("apps/web/src/app/login/page.tsx");
const authControlsSource = await readWorkspaceFile("apps/web/src/app/auth-controls.tsx");
const replyThreadSource = await readWorkspaceFile("apps/web/src/app/reply-thread.tsx");
const apiBaseUrlSource = await readWorkspaceFile("apps/web/src/lib/api-base-url.ts");
const webPackageJson = JSON.parse(await readWorkspaceFile("apps/web/package.json"));
const rootPackageJson = JSON.parse(await readWorkspaceFile("package.json"));

assert.equal(
  rootPackageJson.scripts?.test,
  "pnpm --filter @tsukeai/web test",
  "root npm test must run the web read smoke",
);
assert.equal(
  webPackageJson.scripts?.test,
  "WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write",
  "web test must run read and write smokes",
);
assert.equal(
  webPackageJson.scripts?.["smoke:read"],
  "node scripts/read-smoke.mjs",
  "read smoke must stay dependency-free",
);
assert.equal(
  webPackageJson.scripts?.["smoke:write"],
  "node scripts/write-smoke.mjs",
  "write smoke must stay dependency-free",
);

assertIncludes(pageSource, "AuthorDto");
assertIncludes(pageSource, "EntityId");
assertIncludes(pageSource, "IsoDateTimeString");
assertIncludes(pageSource, "TimelineResponseDto");
assertIncludes(pageSource, "getApiBaseUrl");
assertIncludes(pageSource, "../../lib/api-base-url");
assertIncludes(pageSource, "getCurrentSession");
assertIncludes(pageSource, "../../lib/current-session");
assertIncludes(pageSource, 'export const dynamic = "force-dynamic";');
assertIncludes(pageSource, 'new URL("/api/timeline?limit=20", apiBaseUrl)');
assertIncludes(pageSource, 'Accept: "application/json"');
assertIncludes(pageSource, 'cache: "no-store"');
assertIncludes(pageSource, "if (!response.ok)");
assertIncludes(pageSource, 'return { status: "unavailable" };');
assertIncludes(pageSource, "catch");

assertIncludes(pageSource, '<h1 id="page-title" className="sr-only">');
assertIncludes(pageSource, 'role="status"');
assertIncludes(pageSource, "タイムラインを読み込めませんでした。");
assertIncludes(pageSource, "まだ公開句はありません。");
assertIncludes(pageSource, '<ul className="timeline-list"');
assertIncludes(pageSource, 'aria-label="公開タイムライン"');
assertIncludes(pageSource, "<TimelineItemView");
assertIncludes(timelineItemSource, '<li className="post-item"');
assertIncludes(timelineItemSource, "{post.author.displayName}");
assertIncludes(timelineItemSource, "{post.publicText}");
assertIncludes(pageSource, "function toPublicTimeline");
assertIncludes(pageSource, "conversion.publicText ?? conversion.body ??");
assertIncludes(replyThreadSource, 'aria-label="返信"');
assertIncludes(replyThreadSource, "{reply.author.displayName}");
assertIncludes(replyThreadSource, "reply.publicText");
assertIncludes(protectedLayoutSource, 'redirect("/login")');
assertIncludes(protectedLayoutSource, "<AppShellActions");
assertIncludes(protectedLayoutSource, "<AuthControls");
assertIncludes(loginPageSource, 'redirect("/")');
assertIncludes(loginPageSource, "<LoginAuthControls");
assertIncludes(authControlsSource, "export function LoginAuthControls");
assertIncludes(authControlsSource, 'router.replace("/")');

assertIncludes(apiBaseUrlSource, 'const DEFAULT_API_BASE_URL = "http://localhost:8787";');
assertIncludes(apiBaseUrlSource, "process.env.API_BASE_URL");
assertIncludes(apiBaseUrlSource, "return new URL(value);");

assertNoLlmDependency(pageSource, "apps/web/src/app/(protected)/page.tsx");
assertNoLlmDependency(apiBaseUrlSource, "apps/web/src/lib/api-base-url.ts");
assertNoRuntimeDependency(webPackageJson);

await assertReadSmokeRendersTimeline();
await assertReadSmokeRedirectsUnauthed();

console.log("Read smoke passed.");

async function readWorkspaceFile(path) {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

function assertIncludes(source, expected) {
  assert(source.includes(expected), `Expected source to include: ${expected}`);
}

function assertNoLlmDependency(source, path) {
  const forbidden = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "openai",
    "anthropic",
    "generative-ai",
  ];

  for (const token of forbidden) {
    assert(
      !source.toLowerCase().includes(token.toLowerCase()),
      `${path} must not depend on LLM runtime token: ${token}`,
    );
  }
}

function assertNoRuntimeDependency(packageJson) {
  const forbiddenDependencies = ["@playwright/test", "playwright"];
  const runtimeDependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };

  for (const dependency of forbiddenDependencies) {
    assert(
      !Object.hasOwn(runtimeDependencies, dependency),
      `${dependency} must not be required at runtime for read smoke`,
    );
  }
}

async function assertReadSmokeRendersTimeline() {
  const requests = [];
  const apiServer = createServer((request, response) => {
    requests.push(request.url);

    if (request.method === "GET" && request.url === "/api/sessions/current") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          authenticated: true,
          account: { id: "account-read-smoke", displayName: "読み取り太郎" },
        }),
      );
      return;
    }

    if (request.method !== "GET" || request.url !== "/api/timeline?limit=20") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { code: "not_found", message: "Not found." } }));
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        items: [
          {
            post: {
              id: "post-read-smoke",
              author: {
                id: "author-read-smoke",
                displayName: "読み取り太郎",
                handle: "read_smoke",
              },
              publicText: "あさひさす\nこころしずかに\nはるをまつ",
              createdAt: "2026-05-14T00:00:00.000Z",
            },
            replies: [
              {
                id: "reply-read-smoke",
                postId: "post-read-smoke",
                author: {
                  id: "reply-author-read-smoke",
                  displayName: "返信花子",
                },
                publicText: "ほしをかぞえて\nよるがあけゆく",
                createdAt: "2026-05-14T00:01:00.000Z",
              },
            ],
          },
        ],
      }),
    );
  });
  try {
    apiServer.listen(0, "127.0.0.1");
    await once(apiServer, "listening");
  } catch (error) {
    if (isListenPermissionError(error)) {
      console.warn("Skipping browser-backed read smoke because local listen is unavailable.");
      return;
    }

    throw error;
  }

  let next;

  try {
    const apiAddress = apiServer.address();
    assert(apiAddress && typeof apiAddress === "object");
    const nextPort = await getAvailablePort();
    next = spawn(
      "pnpm",
      ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(nextPort)],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          API_BASE_URL: `http://127.0.0.1:${apiAddress.port}`,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const output = [];

    next.stdout.on("data", (chunk) => output.push(chunk.toString()));
    next.stderr.on("data", (chunk) => output.push(chunk.toString()));

    const html = await fetchUntilReady(`http://127.0.0.1:${nextPort}/`, output);

    assertIncludes(html, "読み取り太郎");
    assertIncludes(html, "あさひさす");
    assertIncludes(html, "こころしずかに");
    assertIncludes(html, "はるをまつ");
    assertIncludes(html, "返信花子");
    assertIncludes(html, "ほしをかぞえて");
    assertIncludes(html, "よるがあけゆく");
    assert(!html.includes("タイムラインを読み込めませんでした。"));
    assert(!html.includes("まだ公開句はありません。"));
    assert(
      requests.includes("/api/sessions/current"),
      "Expected at least one /api/sessions/current request",
    );
    assert(
      requests.includes("/api/timeline?limit=20"),
      "Expected a /api/timeline?limit=20 request",
    );
  } finally {
    if (next) {
      next.kill("SIGTERM");
      await waitForExit(next);
    }
    apiServer.close();
    await once(apiServer, "close");
  }
}

async function assertReadSmokeRedirectsUnauthed() {
  const requests = [];
  const apiServer = createServer((request, response) => {
    requests.push(request.url);

    if (request.method === "GET" && request.url === "/api/sessions/current") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ authenticated: false }));
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { code: "not_found", message: "Not found." } }));
  });
  try {
    apiServer.listen(0, "127.0.0.1");
    await once(apiServer, "listening");
  } catch (error) {
    if (isListenPermissionError(error)) {
      console.warn("Skipping unauthenticated redirect smoke because local listen is unavailable.");
      return;
    }

    throw error;
  }

  let next;

  try {
    const apiAddress = apiServer.address();
    assert(apiAddress && typeof apiAddress === "object");
    const nextPort = await getAvailablePort();
    next = spawn(
      "pnpm",
      ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(nextPort)],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          API_BASE_URL: `http://127.0.0.1:${apiAddress.port}`,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const output = [];

    next.stdout.on("data", (chunk) => output.push(chunk.toString()));
    next.stderr.on("data", (chunk) => output.push(chunk.toString()));

    const response = await fetchUntilRedirect(`http://127.0.0.1:${nextPort}/`, output);
    const location = response.headers.get("location");

    assert(
      [307, 308].includes(response.status),
      `Expected redirect status, got ${response.status}`,
    );
    assert(location?.endsWith("/login"), `Expected redirect to /login, got ${location}`);
    assert(
      requests.includes("/api/sessions/current"),
      "Expected at least one /api/sessions/current request",
    );
    assert(
      !requests.includes("/api/timeline?limit=20"),
      "Unauthenticated / must not fetch the timeline before redirecting",
    );

    const html = await fetchUntilReady(`http://127.0.0.1:${nextPort}/login`, output);
    assertIncludes(html, "ログイン");
    assertIncludes(html, "アカウント作成");
  } finally {
    if (next) {
      next.kill("SIGTERM");
      await waitForExit(next);
    }
    apiServer.close();
    await once(apiServer, "close");
  }
}

async function fetchUntilReady(url, output) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    if (process.env.CI && output.some((line) => line.includes("Failed to start"))) {
      break;
    }

    try {
      const response = await fetch(url);
      const body = await response.text();

      if (response.ok) {
        return body;
      }

      lastError = new Error(`Next returned ${response.status}: ${body.slice(0, 400)}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Next read smoke did not become ready. ${lastError?.message ?? "No response."}\n${output.join("")}`,
  );
}

async function fetchUntilRedirect(url, output) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    if (process.env.CI && output.some((line) => line.includes("Failed to start"))) {
      break;
    }

    try {
      const response = await fetch(url, { redirect: "manual" });

      if ([307, 308].includes(response.status)) {
        return response;
      }

      lastError = new Error(`Next returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Next redirect smoke did not become ready. ${lastError?.message ?? "No response."}\n${output.join("")}`,
  );
}

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await once(child, "exit");
  clearTimeout(timeout);
}

function isListenPermissionError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "EPERM";
}
