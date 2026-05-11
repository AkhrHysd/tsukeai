create table if not exists transform_jobs (
  id uuid primary key,
  account_id uuid not null references accounts (id),
  kind text not null,
  parent_public_conversion_id uuid references public_conversions (id),
  input_sha256 text not null,
  client_key text not null,
  state text not null,
  public_conversion_id uuid references public_conversions (id),
  error_code text,
  failure_reason text,
  user_action text,
  retry_policy text,
  attempts integer not null default 0,
  duration_ms integer,
  estimated_cost_micros bigint,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transform_jobs_kind check (kind in ('post_575', 'reply_77')),
  constraint transform_jobs_state check (
    state in ('queued', 'processing', 'succeeded', 'failed', 'rejected')
  ),
  constraint transform_jobs_input_sha256_hex check (
    input_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint transform_jobs_client_key_not_blank check (btrim(client_key) <> ''),
  constraint transform_jobs_attempts_not_negative check (attempts >= 0),
  constraint transform_jobs_post_parent check (
    (kind = 'post_575' and parent_public_conversion_id is null)
    or (kind = 'reply_77' and parent_public_conversion_id is not null)
  ),
  constraint transform_jobs_success_public_conversion check (
    (state = 'succeeded' and public_conversion_id is not null)
    or (state <> 'succeeded' and public_conversion_id is null)
  ),
  constraint transform_jobs_terminal_error check (
    (
      state in ('failed', 'rejected')
      and error_code is not null
      and failure_reason is not null
      and user_action is not null
      and retry_policy is not null
    )
    or (
      state not in ('failed', 'rejected')
      and error_code is null
      and failure_reason is null
      and user_action is null
      and retry_policy is null
    )
  )
);

create unique index if not exists transform_jobs_idempotency_unique
  on transform_jobs (
    account_id,
    kind,
    coalesce(parent_public_conversion_id, '00000000-0000-0000-0000-000000000000'::uuid),
    input_sha256,
    client_key
  );

create index if not exists transform_jobs_account_created_idx
  on transform_jobs (account_id, created_at desc, id desc);
