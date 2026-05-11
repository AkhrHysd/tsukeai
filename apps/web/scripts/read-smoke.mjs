import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readWorkspaceFile("apps/web/src/app/page.tsx");
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

assertIncludes(pageSource, 'import type { TimelineResponseDto } from "@tsukeai/shared";');
assertIncludes(pageSource, 'import { getApiBaseUrl } from "../lib/api-base-url";');
assertIncludes(pageSource, 'export const dynamic = "force-dynamic";');
assertIncludes(pageSource, 'new URL("/api/timeline?limit=20", apiBaseUrl)');
assertIncludes(pageSource, 'Accept: "application/json"');
assertIncludes(pageSource, 'cache: "no-store"');
assertIncludes(pageSource, "if (!response.ok)");
assertIncludes(pageSource, 'return { status: "unavailable" };');
assertIncludes(pageSource, "catch");

assertIncludes(pageSource, '<h1 id="page-title">公開タイムライン</h1>');
assertIncludes(pageSource, 'role="status"');
assertIncludes(pageSource, "タイムラインを読み込めませんでした。");
assertIncludes(pageSource, "まだ公開句はありません。");
assertIncludes(pageSource, '<ul className="timeline-list"');
assertIncludes(pageSource, 'aria-label="公開タイムライン"');
assertIncludes(pageSource, '<li className="post-card"');
assertIncludes(pageSource, 'aria-label="返信"');
assertIncludes(pageSource, "{item.post.author.displayName}");
assertIncludes(pageSource, "{item.post.body}");
assertIncludes(pageSource, "{reply.author.displayName}");
assertIncludes(pageSource, "{reply.body}");

assertIncludes(apiBaseUrlSource, 'const DEFAULT_API_BASE_URL = "http://localhost:8787";');
assertIncludes(apiBaseUrlSource, "process.env.API_BASE_URL");
assertIncludes(apiBaseUrlSource, "return new URL(value);");

assertNoLlmDependency(pageSource, "apps/web/src/app/page.tsx");
assertNoLlmDependency(apiBaseUrlSource, "apps/web/src/lib/api-base-url.ts");
assertNoRuntimeDependency(webPackageJson);

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
