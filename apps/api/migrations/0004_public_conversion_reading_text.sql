alter table public_conversions
  add column if not exists reading_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'public_conversions_reading_text_not_blank'
  ) then
    alter table public_conversions
      add constraint public_conversions_reading_text_not_blank
      check (reading_text is null or btrim(reading_text) <> '');
  end if;
end $$;
