import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readWorkspaceFile("apps/web/src/app/page.tsx");
const apiSource = await readWorkspaceFile("apps/api/src/index.ts");
const webPackageJson = JSON.parse(await readWorkspaceFile("apps/web/package.json"));
const rootPackageJson = JSON.parse(await readWorkspaceFile("package.json"));

assert.equal(
  rootPackageJson.scripts?.test,
  "pnpm --filter @tsukeai/web test",
  "root npm test must run the web smoke suite",
);
assert.equal(
  webPackageJson.scripts?.test,
  "WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write",
  "web test must run the dependency-free write smoke",
);
assert.equal(
  webPackageJson.scripts?.["smoke:write"],
  "node scripts/write-smoke.mjs",
  "write smoke must stay dependency-free",
);

assertIncludes(pageSource, 'import { revalidatePath } from "next/cache";');
assertIncludes(pageSource, 'import { headers } from "next/headers";');

assertIncludes(pageSource, "async function createPost(formData: FormData)");
assertIncludes(pageSource, '"use server";');
assertIncludes(pageSource, 'requestWrite("/api/posts", "post_575", formData)');
assertIncludes(pageSource, "async function createReply(postId: string");
// biome-ignore lint/suspicious/noTemplateCurlyInString: asserting source code content
assertIncludes(pageSource, 'requestWrite(`/api/posts/${postId}/replies`, "reply_77", formData)');
assertIncludes(pageSource, "async function deletePublicConversion(publicConversionId: string)");
// biome-ignore lint/suspicious/noTemplateCurlyInString: asserting source code content
assertIncludes(pageSource, "requestApi(`/api/public-conversions/${publicConversionId}`");

assertIncludes(pageSource, 'method: "POST"');
assertIncludes(pageSource, 'method: "DELETE"');
assertIncludes(pageSource, '"Content-Type": "application/json"');
assertIncludes(pageSource, '"Idempotency-Key": crypto.randomUUID()');
assertIncludes(pageSource, "clientKey: crypto.randomUUID()");
assertIncludes(pageSource, 'process.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1"');
assertIncludes(pageSource, "WRITE_SMOKE_PUBLIC_TEXT[kind]");
assertIncludes(pageSource, "publicText");
assertIncludes(pageSource, "あさひさす\\nこころしずかに\\nはるをまつ");
assertIncludes(pageSource, "ほしをかぞえて\\nよるがあけゆく");
assertIncludes(pageSource, 'headersInit.set("Accept", "application/json")');
assertIncludes(pageSource, 'headersInit.set("Cookie", cookie)');
assertIncludes(pageSource, 'cache: "no-store"');
assertIncludes(pageSource, "throw new Error(message)");
assertIncludes(pageSource, 'revalidatePath("/")');

assertIncludes(pageSource, '<form className="composer" action={createPost}');
assertIncludes(pageSource, 'aria-label="投稿"');
assertIncludes(pageSource, 'name="body"');
assertIncludes(pageSource, 'type="submit">投稿</button>');
assertIncludes(pageSource, "action={createReply.bind(null, item.post.id)}");
assertIncludes(pageSource, 'type="submit">返信</button>');
assertIncludes(pageSource, "action={deletePublicConversion.bind(null, item.post.id)}");
assertIncludes(pageSource, "action={deletePublicConversion.bind(null, reply.id)}");
assertIncludes(pageSource, 'className="link-button" type="submit"');
assertIncludes(pageSource, "削除");

assertNotIncludes(
  pageSource,
  "requestTransform",
  "write actions must not hard-code the transform-only helper",
);
assertNotIncludes(
  pageSource,
  "/api/transform-jobs",
  "write smoke must not target the transform job route",
);

assertIncludes(apiSource, "WRITE_SMOKE_FIXED_PUBLIC_TEXT?: string");
assertIncludes(apiSource, 'c.env.WRITE_SMOKE_FIXED_PUBLIC_TEXT === "1"');
assertIncludes(apiSource, "body.publicText !== undefined");
assertIncludes(apiSource, "handleCreatePublicText");
assertIncludes(apiSource, "checkTransformForm(forcedInput.kind, publicText)");
assertIncludes(apiSource, "Published text writes are disabled.");

assertNoLlmDependency(pageSource, "apps/web/src/app/page.tsx");
assertNoRuntimeDependency(webPackageJson);
assertNoLlmScriptDependency(webPackageJson);

console.log("Write smoke passed.");

async function readWorkspaceFile(path) {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

function assertIncludes(source, expected) {
  assert(source.includes(expected), `Expected source to include: ${expected}`);
}

function assertNotIncludes(source, expected, message) {
  assert(!source.includes(expected), message);
}

function assertNoLlmDependency(source, path) {
  const forbidden = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "LLM_API_KEY",
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
      `${dependency} must not be required at runtime for write smoke`,
    );
  }
}

function assertNoLlmScriptDependency(packageJson) {
  for (const [scriptName, script] of Object.entries(packageJson.scripts ?? {})) {
    assert(
      !/\b(?:LLM_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b/i.test(script),
      `${scriptName} script must not require LLM credentials`,
    );
  }
}
