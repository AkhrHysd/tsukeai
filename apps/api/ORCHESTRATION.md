# API Orchestration Notes

## Session State Source of Truth

S1 spike outcome: Neon is the single source of truth for API session validity and
write ownership. Cloudflare KV is not used for session state.

Workers treat the `__Host-tsukeai_session` cookie, or `SESSION_COOKIE_NAME` when
overridden, as a signed credential only. For protected write APIs, the Worker
must verify the cookie signature with `SESSION_SECRET` and then confirm that the
referenced `accounts` row exists in Neon with `deleted_at is null` before the
request can create posts, create replies, create transform jobs, or delete public
conversions.

If Neon cannot be reached during session verification, protected writes fail
closed with `503`. If the cookie is missing, invalid, or points at no active
account, protected writes return `401`.
