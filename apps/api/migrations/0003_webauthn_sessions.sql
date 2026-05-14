create table if not exists webauthn_challenges (
  id uuid primary key,
  kind text not null,
  challenge text not null,
  webauthn_user_id text,
  display_name text,
  handle text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint webauthn_challenges_kind check (kind in ('registration', 'authentication')),
  constraint webauthn_challenges_registration_fields check (
    (
      kind = 'registration'
      and webauthn_user_id is not null
      and display_name is not null
    )
    or (
      kind = 'authentication'
      and webauthn_user_id is null
      and display_name is null
      and handle is null
    )
  )
);

create index if not exists webauthn_challenges_active_idx
  on webauthn_challenges (kind, expires_at)
  where consumed_at is null;

create table if not exists webauthn_credentials (
  id text primary key,
  account_id uuid not null references accounts (id),
  webauthn_user_id text not null,
  public_key bytea not null,
  counter bigint not null default 0,
  transports jsonb not null default '[]'::jsonb,
  device_type text not null,
  backed_up boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webauthn_credentials_account_idx
  on webauthn_credentials (account_id);

create table if not exists sessions (
  id uuid primary key,
  account_id uuid not null references accounts (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists sessions_active_idx
  on sessions (id, expires_at)
  where revoked_at is null;

create index if not exists sessions_account_idx
  on sessions (account_id, created_at desc);
