# Neon Hyperdrive Connection

This project connects the Cloudflare Worker API to Neon Postgres through a
Cloudflare Hyperdrive binding named `HYPERDRIVE`.

## Repository Boundary

Do not commit Neon connection strings, database passwords, or Wrangler secrets.
The repository only stores the Worker binding name and the application code that
uses `env.HYPERDRIVE.connectionString`.
The Cloudflare Hyperdrive resource ID also stays outside the committed
`wrangler.toml`; `apps/api/scripts/wrangler-hyperdrive.mjs` injects it into a
temporary Wrangler config for local development and deploys.

## Neon

Create the Neon project in the Tokyo region and copy the pooled or direct
Postgres connection string from Neon. Keep it outside the repository, for
example in a local password manager or shell history-disabled terminal session.

## Hyperdrive

From `apps/api`, create the Hyperdrive configuration with the Neon connection
string:

```sh
pnpm exec wrangler hyperdrive create tsukeai-neon-tokyo \
  --connection-string="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
```

Keep the Hyperdrive ID printed by Wrangler outside the repository, for example
in a password manager or an uncommitted shell environment. The ID is a
Cloudflare resource identifier, not the Neon secret, but the project still keeps
it out of git so the committed config contains no environment-specific
resource handles. The Neon connection string remains stored by Cloudflare
Hyperdrive.

Deploy through the repository script. It generates a temporary Wrangler config
inside `apps/api` and appends the `[[hyperdrive]]` block with
`binding = "HYPERDRIVE"` and the real ID. Keeping the temporary file next to
`wrangler.toml` preserves the relative `main = "src/index.ts"` path:

```sh
export HYPERDRIVE_ID="00000000000000000000000000000000"
pnpm --filter @tsukeai/api run cf:deploy
```

The required deploy-time contract is:

- `HYPERDRIVE_ID` contains the Cloudflare Hyperdrive resource ID returned by
  `wrangler hyperdrive create`.
- The temporary config is generated from the committed `apps/api/wrangler.toml`.
- `wrangler deploy` is invoked with that temporary config so the Worker is
  deployed with `binding = "HYPERDRIVE"` and the real Hyperdrive ID.
- `apps/api/wrangler.toml` must not contain a `[[hyperdrive]]` block or a
  placeholder ID. The script fails if one is added.

For local Worker development, pass a local or development database URL through
the environment instead of committing it:

```sh
export HYPERDRIVE_ID="00000000000000000000000000000000"
export LOCAL_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
pnpm --filter @tsukeai/api dev
```

`LOCAL_DATABASE_URL` is written only to the temporary Wrangler config as
Hyperdrive's `localConnectionString`.

The API uses postgres.js with prepared statements disabled for the Hyperdrive
connection (`prepare: false`) so requests go through Hyperdrive reliably. Keep
`pnpm-lock.yaml` updated whenever `apps/api/package.json` changes so the
`postgres` and `wrangler` versions remain reproducible.

## Verify

Install dependencies, deploy or run the Worker with the configured Hyperdrive
binding, then call:

```sh
curl https://<api-worker-host>/api/db/health
```

A successful response has this shape:

```json
{
  "status": "ok",
  "database": "<database-name>",
  "serverVersion": "<postgres-version>"
}
```

Local Worker health that does not touch Postgres remains available at
`/api/health`.
