# Review Task

Task ID: tc.schema
Title: 最小エンティティとマイグレーション運用

Workspace Path: /Users/akyrhysd/work/tsukeai/.worktrees/tc.schema

## Description
Account・公開変換・スレッドの最小列と適用手順（DDL 全文は実装フェーズ）。

## Allowed Paths
- apps/api
- packages/shared

## Acceptance Criteria
- 最小エンティティのマイグレーション適用が手順どおり再現できる。

## Context
none

## Validation Summary
passed: true
stage: test
outcome: passed
failures: none
logs: test: skipped by task validationPolicy

## Changed Files
- apps/api/MIGRATIONS.md
- apps/api/scripts/migrate.mjs

## Unified Diff
```diff
diff --git a/apps/api/MIGRATIONS.md b/apps/api/MIGRATIONS.md
index a74659e..be4b458 100644
--- a/apps/api/MIGRATIONS.md
+++ b/apps/api/MIGRATIONS.md
@@ -4,41 +4,44 @@ The API database is Neon Postgres. Migrations are applied directly to Neon with
 database URL kept outside the repository; the Worker still reads through the
 `HYPERDRIVE` binding at runtime.
 
-## Minimal Entities
+## Minimal Public Entities
 
-The current migration set creates:
+`0001_minimal_entities.sql` creates the minimum public data model:
 
 - `accounts`: minimum owner identity for writes and later self-delete checks.
 - `threads`: the public thread container used by GT and thread reads.
 - `public_conversions`: only the public transformed text, ownership,
   post/reply kind, thread parent relation, optional source hash, and publish or
   delete state. Raw source text is not persisted.
+- `schema_migrations`: applied migration versions and checksums.
+
+`0002_transform_jobs.sql` adds transform job state after the public entities:
+
 - `transform_jobs`: transform state, idempotency scope, public result link,
   sanitized failure classification, and observation metadata.
-- `schema_migrations`: applied migration versions and checksums.
 
-## Apply
+## Apply Minimal Entities
 
 From the repository root:
 
 ```sh
 pnpm install
 export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
-pnpm --filter @tsukeai/api migrate:up
+pnpm --filter @tsukeai/api migrate:up -- --to 0001_minimal_entities
 ```
 
 The same command is safe to run again. Already-applied migrations are skipped,
 and an edited migration with the same version is rejected by checksum.
 
-For a non-connecting check of the migration files and checksums:
+For a non-connecting check of the minimal entity migration file and checksum:
 
 ```sh
-pnpm --filter @tsukeai/api migrate:up -- --dry-run
+pnpm --filter @tsukeai/api migrate:up -- --to 0001_minimal_entities --dry-run
 ```
 
-## Verify
+## Verify Minimal Entities
 
-After applying, verify the expected tables in Neon:
+After applying, verify the expected minimal tables in Neon:
 
 ```sql
 select tablename
@@ -48,7 +51,6 @@ where schemaname = 'public'
     'accounts',
     'threads',
     'public_conversions',
-    'transform_jobs',
     'schema_migrations'
   )
 order by tablename;
@@ -61,7 +63,15 @@ accounts
 public_conversions
 schema_migrations
 threads
-transform_jobs
+```
+
+## Apply All Current Migrations
+
+To bring the API schema fully up to the current application version, omit
+`--to`:
+
+```sh
+pnpm --filter @tsukeai/api migrate:up
 ```
 
 Then confirm the Worker can still reach the database through Hyperdrive:
diff --git a/apps/api/scripts/migrate.mjs b/apps/api/scripts/migrate.mjs
index d8126fb..9da6dab 100644
--- a/apps/api/scripts/migrate.mjs
+++ b/apps/api/scripts/migrate.mjs
@@ -18,6 +18,7 @@ function usage() {
     "",
     "Options:",
     "  --dry-run   List pending migrations without connecting to the database.",
+    "  --to NAME   Apply migrations up to and including NAME.",
   ].join("\n");
 }
 
@@ -52,17 +53,71 @@ async function loadMigrations() {
   );
 }
 
+function parseArgs(argv) {
+  const options = {
+    dryRun: false,
+    help: false,
+    to: undefined,
+  };
+
+  const args = argv.filter((arg) => arg !== "--");
+
+  for (let index = 0; index < args.length; index += 1) {
+    const arg = args[index];
+
+    if (arg === "--help" || arg === "-h") {
+      options.help = true;
+      continue;
+    }
+
+    if (arg === "--dry-run") {
+      options.dryRun = true;
+      continue;
+    }
+
+    if (arg === "--to") {
+      const value = args[index + 1];
+
+      if (!value || value.startsWith("-")) {
+        throw new Error("--to requires a migration name.");
+      }
+
+      options.to = value;
+      index += 1;
+      continue;
+    }
+
+    throw new Error(`Unknown option: ${arg}`);
+  }
+
+  return options;
+}
+
+function selectMigrations(migrations, to) {
+  if (!to) {
+    return migrations;
+  }
+
+  const targetIndex = migrations.findIndex((migration) => migration.version === to);
+
+  if (targetIndex === -1) {
+    throw new Error(`Migration not found: ${to}`);
+  }
+
+  return migrations.slice(0, targetIndex + 1);
+}
+
 async function main() {
-  const args = new Set(process.argv.slice(2));
+  const options = parseArgs(process.argv.slice(2));
 
-  if (args.has("--help") || args.has("-h")) {
+  if (options.help) {
     console.log(usage());
     return;
   }
 
-  const migrations = await loadMigrations();
+  const migrations = selectMigrations(await loadMigrations(), options.to);
 
-  if (args.has("--dry-run")) {
+  if (options.dryRun) {
     for (const migration of migrations) {
       console.log(`${migration.version} ${migration.checksum}`);
     }

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