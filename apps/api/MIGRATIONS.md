# API Database Migrations

The API database is Neon Postgres. Migrations are applied directly to Neon with a
database URL kept outside the repository; the Worker still reads through the
`HYPERDRIVE` binding at runtime.

## Minimal Entities

The current migration set creates:

- `accounts`: minimum owner identity for writes and later self-delete checks.
- `threads`: the public thread container used by GT and thread reads.
- `public_conversions`: only the public transformed text, ownership,
  post/reply kind, thread parent relation, optional source hash, and publish or
  delete state. Raw source text is not persisted.
- `transform_jobs`: transform state, idempotency scope, public result link,
  sanitized failure classification, and observation metadata.
- `schema_migrations`: applied migration versions and checksums.

## Apply

From the repository root:

```sh
pnpm install
export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
pnpm --filter @tanka-reply-sns/api migrate:up
```

The same command is safe to run again. Already-applied migrations are skipped,
and an edited migration with the same version is rejected by checksum.

For a non-connecting check of the migration files and checksums:

```sh
pnpm --filter @tanka-reply-sns/api migrate:up -- --dry-run
```

## Verify

After applying, verify the expected tables in Neon:

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'accounts',
    'threads',
    'public_conversions',
    'transform_jobs',
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
transform_jobs
```

Then confirm the Worker can still reach the database through Hyperdrive:

```sh
curl https://<api-worker-host>/api/db/health
```
