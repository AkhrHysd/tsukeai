# Data Model

Last scanned: 2026-05-14

## Persistence Principle

The database stores public transformed text, ownership metadata, thread structure, and transform observations. It does not persist raw user input as a domain record. For transform jobs, the raw input is reduced to `input_sha256`; for public conversions, `source_sha256` records a hash of the input used to publish.

## Tables

### `accounts`

Represents the write/delete subject.

Important fields:

- `id`: UUID primary key.
- `display_name`: required, non-blank public author name.
- `handle`: optional public handle, unique case-insensitively for active accounts.
- `deleted_at`: soft-delete flag. Deleted accounts are excluded from timeline queries and protected write checks.

Current implementation does not include account creation or login routes. It only verifies that a signed session cookie points at an active account row.

### `threads`

Groups one root post and its replies.

Important fields:

- `id`: UUID primary key.
- `deleted_at`: soft-delete flag.

Rules:

- A root post creates a new thread.
- A reply reuses the parent post's thread.
- Deleting a root post also marks the thread deleted, hiding the whole thread from timeline reads.

### `public_conversions`

Stores the publishable public tanka text.

Important fields:

- `id`: UUID primary key. This is also the public post/reply identifier exposed through DTOs.
- `account_id`: author account.
- `thread_id`: thread containing the conversion.
- `parent_public_conversion_id`: null for root posts, required for replies.
- `kind`: database-level kind, currently `post` or `reply`.
- `public_text`: the transformed text that may be shown publicly.
- `source_sha256`: SHA-256 hash of the source used for publication.
- `is_published`: public visibility flag.
- `published_at`: timeline ordering timestamp.
- `deleted_at`: soft-delete timestamp.

Constraints enforce:

- Only `post` and `reply` kinds are valid.
- `public_text` is non-blank.
- Root posts have no parent; replies have a parent.
- A parent and reply must belong to the same thread.
- A thread has only one root post.
- Deleted conversions must not remain published.

### `transform_jobs`

Tracks conversion attempts from private input to public text.

Important fields:

- `id`: UUID primary key.
- `account_id`: owner of the transform request.
- `kind`: transform kind, currently `post_575` or `reply_77`.
- `parent_public_conversion_id`: required for `reply_77`, null for `post_575`.
- `input_sha256`: hash of raw input.
- `client_key`: caller-provided idempotency key.
- `state`: `queued`, `processing`, `succeeded`, `failed`, or `rejected`.
- `public_conversion_id`: set only on success.
- `error_code`, `failure_reason`, `user_action`, `retry_policy`: set only on failed/rejected terminal jobs.
- `attempts`, `duration_ms`, `estimated_cost_micros`, `model`: operational observation fields.

The idempotency key is:

`account_id + kind + coalesced parent_public_conversion_id + input_sha256 + client_key`

This means the same user can safely retry the same request with the same client key without producing duplicate public records.

## Public Read Model

`GET /api/timeline` builds a read model by:

- selecting published, undeleted root `public_conversions` with `kind = post`;
- joining active author accounts;
- paging by `(published_at, id)` descending;
- joining all published replies from the selected threads;
- ordering replies ascending by publish time and ID.

The public DTO currently exposes the transformed text as `body`, while the web layer also accepts `publicText` for compatibility.

## Deletion Semantics

Only the author can delete a public conversion.

Deleting a reply:

- sets that reply's `is_published = false`;
- sets `deleted_at = now()`;
- leaves the parent post and thread visible.

Deleting a root post:

- soft-deletes the root conversion;
- soft-deletes the thread;
- causes the root and its replies to disappear from timeline queries.

The code does not currently cascade `deleted_at` to reply rows when a root thread is deleted. The timeline hides those replies through the deleted thread filter.

