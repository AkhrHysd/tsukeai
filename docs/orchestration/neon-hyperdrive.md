# Neon Hyperdrive Connection

This project connects the Cloudflare Worker API to Neon Postgres through a
Cloudflare Hyperdrive binding named `HYPERDRIVE`.

## Repository Boundary

Do not commit Neon connection strings, database passwords, or Wrangler secrets.
The repository only stores the Worker binding name and the application code that
uses `env.HYPERDRIVE.connectionString`.

## Neon

Create the Neon project in the Tokyo region and copy the pooled or direct
Postgres connection string from Neon. Keep it outside the repository, for
example in a local password manager or shell history-disabled terminal session.

## Hyperdrive

From `apps/api`, create the Hyperdrive configuration with the Neon connection
string:

```sh
pnpm exec wrangler hyperdrive create tanka-reply-sns-neon-tokyo \
  --connection-string="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"
```

Copy the Hyperdrive ID printed by Wrangler into `apps/api/wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"
```

The ID is a Cloudflare resource identifier, not the Neon secret. The Neon
connection string remains stored by Cloudflare Hyperdrive.

If the Hyperdrive ID must also stay outside the repository, keep the placeholder
in `apps/api/wrangler.toml` and substitute the ID into a temporary deploy config
inside `apps/api`. Keeping the temporary file next to `wrangler.toml` preserves
the relative `main = "src/index.ts"` path:

```sh
export HYPERDRIVE_ID="00000000000000000000000000000000"
(
  cd apps/api
  tmp_config="$(mktemp wrangler.hyperdrive.XXXXXX.toml)"
  sed "s/<hyperdrive-id>/${HYPERDRIVE_ID}/g" wrangler.toml > "${tmp_config}"
  deploy_status=0
  pnpm exec wrangler deploy --config "${tmp_config}" || deploy_status=$?
  rm -f "${tmp_config}"
  exit "${deploy_status}"
)
```

The required deploy-time contract is:

- `HYPERDRIVE_ID` contains the Cloudflare Hyperdrive resource ID returned by
  `wrangler hyperdrive create`.
- The temporary config is generated from the committed
  `apps/api/wrangler.toml`.
- `wrangler deploy` is invoked with `--config "${tmp_config}"` so the Worker is
  deployed with `binding = "HYPERDRIVE"` and the real Hyperdrive ID, while the
  repository keeps the Neon connection string and Cloudflare resource ID out of
  git.

The API uses postgres.js with prepared statements disabled for the Hyperdrive
connection (`prepare: false`) so requests go through Hyperdrive reliably.

This repository currently has no committed package lock. If a lockfile is added
later, update it whenever `apps/api/package.json` changes so the `postgres`
dependency is reproducible.

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
