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

## LLM Adapter Contract

The transform ADR is `docs/orchestration/transform-architecture.md`; the API
implementation point is `src/llm-adapter.ts` plus the job runner in
`src/index.ts`.

The adapter follows the ADR call contract as follows:

- **Server-only call boundary**: the client sends only transform input and an
  idempotency key to the API. The Worker builds the system/user messages, model
  request, retry prompt, and provider request. `LLM_API_KEY` is read from Worker
  bindings and must be configured as a Secret; it is never accepted from the
  client or exposed in a response.
- **Required provider configuration**: `LLM_API_KEY`, `LLM_BASE_URL`, and
  `LLM_MODEL` are mandatory when a transform job executes. Missing or invalid
  configuration is classified as `configuration_error` and the job fails without
  publishing.
- **Timeouts**: each provider attempt uses `LLM_TIMEOUT_MS` through an
  `AbortController`. Timeouts become retryable `timeout` failures and are
  reported to users as retry-later transform failures.
- **Input and output limits**: `LLM_MAX_INPUT_CHARS` rejects oversized or blank
  input before the provider call. `LLM_MAX_OUTPUT_TOKENS` is sent to the
  provider and also bounds accepted response text length. Limit violations are
  non-retryable rejected jobs.
- **Bounded retries and call budget**: `LLM_MAX_RETRIES` is clamped by the
  adapter and then capped again by the job runner's remaining call budget.
  Retryable provider failures, rate limits, and timeouts may be retried; input
  limits, prompt-injection signals, provider rejections, output limits, and form
  validation failures are not retried after the configured attempts are
  exhausted.
- **Prompt and data boundary**: user input is normalized and encoded as JSON
  string data inside the prompt. The client cannot choose the model, system
  prompt, output rules, retry conditions, or token limits. Inputs matching
  explicit prompt-injection signals are rejected before the provider call with
  `prompt_injection_detected`.
- **Publication gate**: only output accepted by `checkTransformForm` is
  published. Failed transforms are marked `failed` for temporary/provider
  problems or `rejected` for revisable input/validation problems.
- **Logging boundary**: transform logs include job ID, input hash, failure code,
  retryability, attempts, duration, and model. They do not include the source
  input, prompt body, raw provider response, provider error body, or rejected
  output text. API error logs use normalized error summaries only: error name
  and safe code fields are allowed, but exception messages and provider bodies
  are not logged because they may contain source text.

Runtime knobs are intentionally environment bindings, with conservative clamps
inside the adapter:

| Binding | Default | Clamp / requirement |
| --- | ---: | --- |
| `LLM_API_KEY` | none | required Secret |
| `LLM_BASE_URL` | none | required absolute `http`/`https` URL |
| `LLM_MODEL` | none | required non-blank model ID |
| `LLM_TIMEOUT_MS` | `8000` | `1000` to `20000` |
| `LLM_MAX_INPUT_CHARS` | `1000` | `1` to `4000` |
| `LLM_MAX_OUTPUT_TOKENS` | `96` | `16` to `256` |
| `LLM_MAX_RETRIES` | `1` | `0` to `2` retries, plus the first attempt |
