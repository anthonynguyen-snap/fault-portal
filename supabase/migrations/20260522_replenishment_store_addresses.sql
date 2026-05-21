create table if not exists replenishment_store_addresses (
  id uuid primary key default gen_random_uuid(),
  store text not null unique,
  recipient text not null default '',
  address text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into replenishment_store_addresses (store)
values ('Adelaide Popup'), ('Sydney Store')
on conflict (store) do nothing;
