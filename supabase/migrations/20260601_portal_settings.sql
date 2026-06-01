-- Portal settings key/value store
create table if not exists portal_settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed empty evidence folders row
insert into portal_settings (key, value)
values ('evidence_folders', '{}'::jsonb)
on conflict (key) do nothing;
