# Implementation Gaps and Risks

Last scanned: 2026-05-14

This file lists domain-relevant gaps observed from the code. Some may be intentional MVP tradeoffs, but they are important for future planning.

## Authentication Is Only Partially Implemented

The API verifies signed session cookies and active account rows, but the repository does not currently include routes or UI for:

- account registration;
- login;
- logout;
- passkey/WebAuthn ceremonies;
- session issuance or revocation.

Existing planning docs mention passkey-based authentication, but the current code only implements the protected-write gate.

## Transform Job Polling Is Not Exposed in the UI

The backend supports `202` responses and `GET /api/transform-jobs/:id`, but the web page does not render pending jobs or poll job status. A transform that exceeds the 900 ms synchronous wait can return as active without a user-facing completion flow in the current UI.

## Public DTO Uses `body` While Domain Language Uses `publicText`

The shared DTO supports either `publicText` or `body` for public conversion text, and the web mapper accepts both. The API timeline currently emits `body`. This is compatible but conceptually leaky because `body` can be confused with raw user input.

## Raw Input Is Not Persisted, But It Is Passed Through Request Execution

The code avoids storing raw input in domain tables and safe logs use hashes. During request handling, raw input still exists in memory and is passed to the LLM adapter. Any future logging, tracing, error reporting, or analytics integration must preserve the current no-raw-text boundary.

## Source Hash Semantics Differ Between Paths

Normal transform publishing stores `source_sha256` from the raw private input hash.

Smoke-mode public text publishing stores `source_sha256` from `publicText`. This is acceptable for smoke verification but should not be treated as equivalent observation data.

## Cost Observation Is Stubbed

Successful transform jobs currently store `estimated_cost_micros = 0`. Attempts, duration, and model are recorded, but cost accounting is not yet meaningful.

## Parent Post Delete Hides Replies Through Thread Filtering

Deleting a root post soft-deletes the thread, so replies disappear from timeline queries. Reply rows themselves are not individually marked deleted by that operation. This works for reads today, but future direct reply lookup or moderation views must account for deleted threads.

## Form Checking Is Approximate

The shared mora counter counts hiragana/katakana and long vowel marks, ignores small kana that do not carry their own mora, and strips supported punctuation. It is deterministic and useful as a contract, but it is not a full Japanese phonological analyzer. Edge cases around loanwords, orthography, and poetic license may be rejected or accepted mechanically.

## Moderation Is Not Present

There is no report flow, admin deletion, content review queue, user blocking, or abuse tooling. Since only transformed public text is shown, the blast radius is reduced, but harmful transformed output can still be published if it passes form checks.

## Frontend Error Handling Is Coarse

The server action throws after failed API responses. The page has a fallback for timeline load failure, but write failures do not have structured inline recovery UX.

