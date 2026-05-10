-- Minimal public data model for the MVP.
-- Raw post/reply source text is intentionally not persisted here.

create table if not exists schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key,
  display_name text not null,
  handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint accounts_display_name_not_blank check (btrim(display_name) <> ''),
  constraint accounts_handle_not_blank check (handle is null or btrim(handle) <> '')
);

create unique index if not exists accounts_handle_unique
  on accounts (lower(handle))
  where handle is not null and deleted_at is null;

create table if not exists threads (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public_conversions (
  id uuid primary key,
  account_id uuid not null references accounts (id),
  thread_id uuid not null references threads (id),
  parent_public_conversion_id uuid,
  kind text not null,
  public_text text not null,
  source_sha256 text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint public_conversions_kind check (kind in ('post', 'reply')),
  constraint public_conversions_public_text_not_blank check (btrim(public_text) <> ''),
  constraint public_conversions_source_sha256_hex check (
    source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint public_conversions_post_parent check (
    (kind = 'post' and parent_public_conversion_id is null)
    or (kind = 'reply' and parent_public_conversion_id is not null)
  ),
  constraint public_conversions_deleted_not_published check (
    deleted_at is null or is_published = false
  ),
  constraint public_conversions_id_thread_unique unique (id, thread_id),
  constraint public_conversions_parent_same_thread foreign key (
    parent_public_conversion_id,
    thread_id
  ) references public_conversions (id, thread_id)
);

create unique index if not exists public_conversions_one_root_per_thread
  on public_conversions (thread_id)
  where parent_public_conversion_id is null;

create index if not exists public_conversions_timeline_idx
  on public_conversions (published_at desc, id desc)
  where is_published = true and deleted_at is null;

create index if not exists public_conversions_thread_idx
  on public_conversions (thread_id, published_at asc, id asc)
  where is_published = true and deleted_at is null;

create index if not exists public_conversions_account_idx
  on public_conversions (account_id, published_at desc, id desc);
