import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readWorkspaceFile("apps/web/src/app/(protected)/page.tsx");
const composePageSource = await readWorkspaceFile("apps/web/src/app/(protected)/compose/page.tsx");
const replyPageSource = await readWorkspaceFile(
  "apps/web/src/app/(protected)/posts/[postId]/reply/page.tsx",
);
const postFormsSource = await readWorkspaceFile("apps/web/src/app/post-forms.tsx");
const postsRouteSource = await readWorkspaceFile("apps/web/src/app/api/posts/route.ts");
const repliesRouteSource = await readWorkspaceFile(
  "apps/web/src/app/api/posts/[postId]/replies/route.ts",
);
const transformJobRouteSource = await readWorkspaceFile(
  "apps/web/src/app/api/transform-jobs/[id]/route.ts",
);
const proxyApiSource = await readWorkspaceFile("apps/web/src/lib/proxy-api.ts");
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

assertIncludes(pageSource, '"use server";');
assertIncludes(pageSource, "async function deletePublicConversion(publicConversionId: string)");
// biome-ignore lint/suspicious/noTemplateCurlyInString: asserting source code content
assertIncludes(pageSource, "requestApi(`/api/public-conversions/${publicConversionId}`");

assertIncludes(pageSource, 'method: "DELETE"');
assertIncludes(pageSource, 'headersInit.set("Accept", "application/json")');
assertIncludes(pageSource, 'headersInit.set("Cookie", cookie)');
assertIncludes(pageSource, 'cache: "no-store"');
assertIncludes(pageSource, "throw new Error(`API request failed with $" + "{response.status}`)");
assertIncludes(pageSource, 'revalidatePath("/")');

assertIncludes(pageSource, "action={deletePublicConversion.bind(null, item.post.id)}");
assertIncludes(pageSource, "deletePublicConversion");
assertIncludes(pageSource, 'className="context-menu__item context-menu__item--danger"');
assertIncludes(pageSource, "削除");

assertIncludes(composePageSource, "<PostComposer");
assertIncludes(replyPageSource, "<ReplyComposer");

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
assertIncludes(apiSource, "const account = await getRequestSessionAccountWithSql(c, sql);");
assertIncludes(apiSource, "job.account_id !== account.id");

assertNoLlmDependency(pageSource, "apps/web/src/app/(protected)/page.tsx");
assertIncludes(postFormsSource, '"use client";');
assertIncludes(
  postFormsSource,
  'import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";',
);
assertIncludes(postFormsSource, 'import { useRouter } from "next/navigation";');
assertIncludes(
  postFormsSource,
  '<form ref={formRef} className="composer" onSubmit={submitPost} aria-label="投稿">',
);
assertIncludes(
  postFormsSource,
  '<form ref={formRef} className="composer" onSubmit={submitReply} aria-label="返信">',
);
assertIncludes(postFormsSource, 'name="body"');
assertIncludes(postFormsSource, 'const formDisabled = busy || feedbackState.status === "pending";');
assertIncludes(postFormsSource, "disabled={formDisabled}");
assertIncludes(
  postFormsSource,
  'busy ? "投稿中..." : feedbackState.status === "pending" ? "変換中..." : "投稿"',
);
assertIncludes(
  postFormsSource,
  'busy ? "返信中..." : feedbackState.status === "pending" ? "変換中..." : "返信"',
);
assertIncludes(postFormsSource, 'role={state.status === "error" ? "alert" : "status"}');
assertIncludes(postFormsSource, "requestWrite(path, kind, target, new FormData(form))");
assertIncludes(postFormsSource, "fetch(`/api/transform-jobs/$");
assertIncludes(postFormsSource, "fetch(path, {");
assertIncludes(postFormsSource, '"Idempotency-Key": crypto.randomUUID()');
assertIncludes(postFormsSource, "clientKey: crypto.randomUUID()");
assertIncludes(postFormsSource, 'message: "本文を入力してください。"');
assertIncludes(postFormsSource, '"投稿しました。"');
assertIncludes(postFormsSource, '"返信しました。"');
assertIncludes(postFormsSource, 'message: "変換中です。完了するとタイムラインに反映されます。"');
assertIncludes(postFormsSource, 'status: "pending"');
assertIncludes(postFormsSource, "jobId: body.job.id");
assertIncludes(postFormsSource, 'canRetry: body.job.error?.userAction === "retry_later"');
assertIncludes(postFormsSource, 'className="write-retry"');
assertIncludes(postFormsSource, "再試行");
assertIncludes(postFormsSource, "useTransformJobFeedback");
assertIncludes(postFormsSource, "router.refresh()");
assertNoLlmDependency(postFormsSource, "apps/web/src/app/post-forms.tsx");
assertIncludes(postsRouteSource, 'proxyApiRequest(request, "/api/posts")');
assertIncludes(repliesRouteSource, "proxyApiRequest(request, `/api/posts/$");
assertIncludes(transformJobRouteSource, "proxyApiRequest(request, `/api/transform-jobs/$");
assertIncludes(proxyApiSource, 'request.headers.get("idempotency-key")');
assertIncludes(proxyApiSource, 'proxyHeaders.set("Idempotency-Key", idempotencyKey)');
assertNoLlmDependency(postsRouteSource, "apps/web/src/app/api/posts/route.ts");
assertNoLlmDependency(repliesRouteSource, "apps/web/src/app/api/posts/[postId]/replies/route.ts");
assertNoLlmDependency(transformJobRouteSource, "apps/web/src/app/api/transform-jobs/[id]/route.ts");
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
