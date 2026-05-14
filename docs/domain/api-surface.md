# API Surface

Last scanned: 2026-05-14

## Cross-Cutting Behavior

The API is a Hono app intended for Cloudflare Workers.

Common behavior:

- CORS allows configured origins from `API_ALLOWED_ORIGINS`, defaulting to `http://localhost:3000`.
- `GET /health` and `GET /api/health` do not hit the database.
- Protected writes require a valid signed session cookie and an active account.
- Protected write paths are `POST` and `DELETE` under `/api/`, excluding future `/api/auth` and `/api/sessions` paths.
- Responses that involve mutable state usually set `Cache-Control: no-store`.

Session verification:

- Cookie name defaults to `__Host-tsukeai_session`.
- Cookie value format is `accountId.signature`.
- Signature is HMAC-SHA256 over `accountId`, encoded as base64url.
- A session is accepted only if the account ID is a UUID and the account exists with `deleted_at is null`.

## Health

### `GET /health`

Returns:

```json
{ "status": "ok", "service": "api" }
```

### `GET /api/health`

Same as `/health`.

### `GET /api/db/health`

Checks Postgres connectivity and returns:

```json
{
  "status": "ok",
  "database": "tsukeai",
  "serverVersion": "..."
}
```

## Timeline

### `GET /api/timeline`

Public endpoint. Login is not required.

Query parameters:

- `limit`: optional positive integer, default `20`, maximum `50`.
- `cursor`: optional base64url JSON cursor with `publishedAt` and `id`.

Returns `TimelineResponseDto`:

```json
{
  "items": [
    {
      "post": {
        "id": "uuid",
        "author": { "id": "uuid", "displayName": "..." },
        "body": "あさひさす\nこころしずかに\nはるをまつ",
        "createdAt": "2026-05-14T00:00:00.000Z"
      },
      "replies": []
    }
  ],
  "nextCursor": "optional"
}
```

Error cases:

- `400` for invalid `limit` or `cursor`.
- `503` when the timeline query fails.

## Transform Creation

### `POST /api/transform-jobs`

Generic transform job endpoint. Login required.

Body:

```json
{
  "kind": "post_575",
  "input": "raw private text",
  "clientKey": "optional body idempotency key"
}
```

For replies:

```json
{
  "kind": "reply_77",
  "parentPostId": "uuid",
  "input": "raw private text",
  "clientKey": "optional body idempotency key"
}
```

The `Idempotency-Key` header can supply the client key when `clientKey` is not in the body. `body` is accepted as an alias for `input`.

### `POST /api/posts`

Convenience endpoint for root posts. Login required.

It forces `kind = post_575`; callers provide `input` or `body` and an idempotency key.

### `POST /api/posts/:postId/replies`

Convenience endpoint for replies. Login required.

It forces `kind = reply_77` and `parentPostId = :postId`.

Reply creation first confirms the parent post exists, is a root post, is published, and belongs to an active thread.

## Transform Response Statuses

The create endpoints return `TransformJobResponseDto`.

Status mapping:

- `201`: newly created job completed and published synchronously.
- `200`: existing idempotent job was reused and is already succeeded.
- `202`: job is still queued or processing.
- `422`: job was rejected because the input/result is client-revisable.
- `429`: transform limit exceeded.
- `503`: transform infrastructure failure or server-retryable failure.

Successful job DTOs include either `publishedPostId` or `publishedReplyId`. They do not include raw input.

## Transform Lookup

### `GET /api/transform-jobs/:id`

Login required. Returns only jobs owned by the session account.

Error cases:

- `400` for non-UUID job IDs.
- `401` without a valid session.
- `404` if the job does not exist or belongs to another account.
- `503` on database failure.

## Public Conversion Delete

### `DELETE /api/public-conversions/:id`

Login required. Deletes only the author's own public conversion.

Returns:

```json
{ "deleted": true, "deletedCount": 1 }
```

Error cases:

- `400` for non-UUID IDs.
- `401` without a valid session.
- `403` when the conversion exists but belongs to another account.
- `404` when the conversion is not published/active or its thread is deleted.
- `503` on database failure.

## Smoke-Only Public Text Writes

When `WRITE_SMOKE_FIXED_PUBLIC_TEXT=1`, the API accepts `publicText` writes through the forced endpoints (`/api/posts` and `/api/posts/:postId/replies`). This bypasses the LLM but still validates the tanka form. It is intended for smoke tests and local verification.

Outside that mode, `publicText` writes return `400`.

