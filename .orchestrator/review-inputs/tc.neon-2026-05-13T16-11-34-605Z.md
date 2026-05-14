# Review Task

Task ID: tc.neon
Title: Neon と Hyperdrive の接続方針

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.neon

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
exitCode: 0
stdout:

> tsukeai@0.0.0 test
> pnpm --filter @tsukeai/web test


> @tsukeai/web@0.0.0 test /Users/akyrhysd/work/tsukeai/.worktrees/tc.neon/apps/web
> WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:read && WRITE_SMOKE_FIXED_PUBLIC_TEXT=1 pnpm run smoke:write


> @tsukeai/web@0.0.0 smoke:read /Users/akyrhysd/work/tsukeai/.worktrees/tc.neon/apps/web
> node scripts/read-smoke.mjs

Read smoke passed.

> @tsukeai/web@0.0.0 smoke:write /Users/akyrhysd/work/tsukeai/.worktrees/tc.neon/apps/web
> node scripts/write-smoke.mjs

Write smoke passed.
stderr:
(empty)

## Changed Files
- apps/api/package.json
- apps/api/scripts/deploy.mjs
- apps/api/wrangler.toml
- docs/orchestration/neon-hyperdrive.md
- apps/api/.gitignore
- apps/api/scripts/wrangler-hyperdrive.mjs

## Unified Diff
```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index 76a00d6..5f7f734 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -5,8 +5,8 @@
   "type": "module",
   "scripts": {
     "check": "pnpm run lint",
-    "dev": "wrangler dev",
-    "cf:deploy": "node scripts/deploy.mjs",
+    "dev": "node scripts/wrangler-hyperdrive.mjs dev",
+    "cf:deploy": "node scripts/wrangler-hyperdrive.mjs deploy",
     "lint": "pnpm --workspace-root exec biome check .",
     "migrate:up": "node scripts/migrate.mjs",
     "typecheck": "tsc --project tsconfig.json --noEmit"
diff --git a/apps/api/scripts/deploy.mjs b/apps/api/scripts/deploy.mjs
deleted file mode 100644
index ae042f6..0000000
--- a/apps/api/scripts/deploy.mjs
+++ /dev/null
@@ -1,76 +0,0 @@
-import { spawn } from "node:child_process";
-import { randomUUID } from "node:crypto";
-import { readFile, rm, writeFile } from "node:fs/promises";
-import path from "node:path";
-import process from "node:process";
-
-function usage() {
-  return [
-    "Usage:",
-    "  HYPERDRIVE_ID=... pnpm --filter @tsukeai/api run cf:deploy",
-    "",
-    "Notes:",
-    "- HYPERDRIVE_ID is the Cloudflare Hyperdrive resource id (UUID or 32-hex).",
-    "- This script keeps apps/api/wrangler.toml committed with a placeholder id,",
-    "  and generates a temporary wrangler config for deploy only.",
-  ].join("\n");
-}
-
-function assertHyperdriveId(value) {
-  if (!value) return undefined;
-  const trimmed = value.trim();
-  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
-  const hex32 = /^[0-9a-f]{32}$/i;
-  return uuid.test(trimmed) || hex32.test(trimmed) ? trimmed : undefined;
-}
-
-async function main() {
-  const args = new Set(process.argv.slice(2));
-  if (args.has("--help") || args.has("-h")) {
-    console.log(usage());
-    return;
-  }
-
-  const rawHyperdriveId = process.env.HYPERDRIVE_ID;
-  const hyperdriveId = assertHyperdriveId(rawHyperdriveId);
-  if (!hyperdriveId) {
-    console.error("HYPERDRIVE_ID is required (UUID or 32-hex Cloudflare Hyperdrive ID).\n");
-    console.error(usage());
-    process.exitCode = 1;
-    return;
-  }
-
-  const apiDir = path.resolve(import.meta.dirname, "..");
-  const wranglerTomlPath = path.join(apiDir, "wrangler.toml");
-  const wranglerToml = await readFile(wranglerTomlPath, "utf8");
-
-  if (!wranglerToml.includes("<hyperdrive-id>")) {
-    console.error('Expected wrangler.toml to include "<hyperdrive-id>" placeholder.');
-    process.exitCode = 1;
-    return;
-  }
-
-  // Create the temporary config in the same directory as wrangler.toml so
-  // relative paths like main = "src/index.ts" keep working. Wrangler resolves
-  // relative paths from the config file location.
-  const tmpConfigPath = path.join(apiDir, `wrangler.hyperdrive.${randomUUID()}.toml`);
-  const tmpConfig = wranglerToml.replaceAll("<hyperdrive-id>", hyperdriveId);
-  await writeFile(tmpConfigPath, tmpConfig, "utf8");
-
-  const child = spawn("pnpm", ["exec", "wrangler", "deploy", "--config", tmpConfigPath], {
-    cwd: apiDir,
-    stdio: "inherit",
-  });
-
-  const exitCode = await new Promise((resolve) => {
-    child.on("close", (code) => resolve(code ?? 1));
-  });
-
-  await rm(tmpConfigPath, { force: true });
-  process.exitCode = exitCode;
-}
-
-main().catch((error) => {
-  console.error(error);
-  process.exitCode = 1;
-});
diff --git a/apps/api/wrangler.toml b/apps/api/wrangler.toml
index 8ffd59c..00842a6 100644
--- a/apps/api/wrangler.toml
+++ b/apps/api/wrangler.toml
@@ -9,11 +9,3 @@ compatibility_flags = ["nodejs_compat"]
 API_ALLOWED_ORIGINS = "http://localhost:3000"
 LLM_BASE_URL = "https://api.openai.com/v1/chat/completions"
 LLM_MODEL = "gpt-4.1-mini"
-
-[[hyperdrive]]
-binding = "HYPERDRIVE"
-# Keep the real Cloudflare resource ID outside git and substitute it at deploy
-# time. See docs/orchestration/neon-hyperdrive.md for the exact command.
-id = "<hyperdrive-id>"
-# Local development: wrangler dev uses this connection string directly.
-localConnectionString = "postgres://tsukeai:tsukeai@localhost:5433/tsukeai"
diff --git a/docs/orchestration/neon-hyperdrive.md b/docs/orchestration/neon-hyperdrive.md
index 51f90f7..786f530 100644
--- a/docs/orchestration/neon-hyperdrive.md
+++ b/docs/orchestration/neon-hyperdrive.md
@@ -8,6 +8,9 @@ Cloudflare Hyperdrive binding named `HYPERDRIVE`.
 Do not commit Neon connection strings, database passwords, or Wrangler secrets.
 The repository only stores the Worker binding name and the application code that
 uses `env.HYPERDRIVE.connectionString`.
+The Cloudflare Hyperdrive resource ID also stays outside the committed
+`wrangler.toml`; `apps/api/scripts/wrangler-hyperdrive.mjs` injects it into a
+temporary Wrangler config for local development and deploys.
 
 ## Neon
 
@@ -25,45 +28,44 @@ pnpm exec wrangler hyperdrive create tsukeai-neon-tokyo \
   --connection-string="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
 ```
 
-Copy the Hyperdrive ID printed by Wrangler into `apps/api/wrangler.toml`:
+Keep the Hyperdrive ID printed by Wrangler outside the repository, for example
+in a password manager or an uncommitted shell environment. The ID is a
+Cloudflare resource identifier, not the Neon secret, but the project still keeps
+it out of git so the committed config contains no environment-specific
+resource handles. The Neon connection string remains stored by Cloudflare
+Hyperdrive.
 
-```toml
-[[hyperdrive]]
-binding = "HYPERDRIVE"
-id = "<hyperdrive-id>"
-```
-
-The ID is a Cloudflare resource identifier, not the Neon secret. The Neon
-connection string remains stored by Cloudflare Hyperdrive.
-
-If the Hyperdrive ID must also stay outside the repository, keep the placeholder
-in `apps/api/wrangler.toml` and substitute the ID into a temporary deploy config
-inside `apps/api`. Keeping the temporary file next to `wrangler.toml` preserves
-the relative `main = "src/index.ts"` path:
+Deploy through the repository script. It generates a temporary Wrangler config
+inside `apps/api` and appends the `[[hyperdrive]]` block with
+`binding = "HYPERDRIVE"` and the real ID. Keeping the temporary file next to
+`wrangler.toml` preserves the relative `main = "src/index.ts"` path:
 
 ```sh
 export HYPERDRIVE_ID="00000000000000000000000000000000"
-(
-  cd apps/api
-  tmp_config="$(mktemp wrangler.hyperdrive.XXXXXX.toml)"
-  sed "s/<hyperdrive-id>/${HYPERDRIVE_ID}/g" wrangler.toml > "${tmp_config}"
-  deploy_status=0
-  pnpm exec wrangler deploy --config "${tmp_config}" || deploy_status=$?
-  rm -f "${tmp_config}"
-  exit "${deploy_status}"
-)
+pnpm --filter @tsukeai/api run cf:deploy
 ```
 
 The required deploy-time contract is:
 
 - `HYPERDRIVE_ID` contains the Cloudflare Hyperdrive resource ID returned by
   `wrangler hyperdrive create`.
-- The temporary config is generated from the committed
-  `apps/api/wrangler.toml`.
-- `wrangler deploy` is invoked with `--config "${tmp_config}"` so the Worker is
-  deployed with `binding = "HYPERDRIVE"` and the real Hyperdrive ID, while the
-  repository keeps the Neon connection string and Cloudflare resource ID out of
-  git.
+- The temporary config is generated from the committed `apps/api/wrangler.toml`.
+- `wrangler deploy` is invoked with that temporary config so the Worker is
+  deployed with `binding = "HYPERDRIVE"` and the real Hyperdrive ID.
+- `apps/api/wrangler.toml` must not contain a `[[hyperdrive]]` block or a
+  placeholder ID. The script fails if one is added.
+
+For local Worker development, pass a local or development database URL through
+the environment instead of committing it:
+
+```sh
+export HYPERDRIVE_ID="00000000000000000000000000000000"
+export LOCAL_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
+pnpm --filter @tsukeai/api dev
+```
+
+`LOCAL_DATABASE_URL` is written only to the temporary Wrangler config as
+Hyperdrive's `localConnectionString`.
 
 The API uses postgres.js with prepared statements disabled for the Hyperdrive
 connection (`prepare: false`) so requests go through Hyperdrive reliably. Keep

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