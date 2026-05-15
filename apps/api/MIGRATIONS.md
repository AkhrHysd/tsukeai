# API Database Migrations

The API database is Neon Postgres. Migrations are applied directly to Neon with a
database URL kept outside the repository; the Worker still reads through the
`HYPERDRIVE` binding at runtime.

## Minimal Public Entities

`0001_minimal_entities.sql` creates the minimum public data model:

- `accounts`: minimum owner identity for writes and later self-delete checks.
- `threads`: the public thread container used by GT and thread reads.
- `public_conversions`: only the public transformed text, ownership,
  post/reply kind, thread parent relation, optional source hash, and publish or
  delete state. Raw source text is not persisted.
- `schema_migrations`: applied migration versions and checksums.

`0002_transform_jobs.sql` adds transform job state after the public entities:

- `transform_jobs`: transform state, idempotency scope, public result link,
  sanitized failure classification, and observation metadata.

`0004_public_conversion_reading_text.sql` adds the optional `reading_text`
column used to expose the kana reading for transformed public poems.

## Apply Minimal Entities

From the repository root:

```sh
pnpm install
export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
pnpm --filter @tsukeai/api migrate:up -- --to 0001_minimal_entities
```

The same command is safe to run again. Already-applied migrations are skipped,
and an edited migration with the same version is rejected by checksum.

For a non-connecting check of the minimal entity migration file and checksum:

```sh
pnpm --filter @tsukeai/api migrate:up -- --to 0001_minimal_entities --dry-run
```

## Verify Minimal Entities

After applying, verify the expected minimal tables in Neon:

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'accounts',
    'threads',
    'public_conversions',
    'schema_migrations'
  )
order by tablename;
```

Expected result:

```text
accounts
public_conversions
schema_migrations
threads
```

## Apply All Current Migrations

To bring the API schema fully up to the current application version, omit
`--to`:

```sh
pnpm --filter @tsukeai/api migrate:up
```

Then confirm the Worker can still reach the database through Hyperdrive:

```sh
curl https://<api-worker-host>/api/db/health
```
