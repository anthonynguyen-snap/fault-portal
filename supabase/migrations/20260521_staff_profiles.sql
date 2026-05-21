create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null unique,
  staff_name text not null,
  shipping_address text not null default '',
  phone text not null default '',
  personal_email text not null default '',
  contract_link text not null default '',
  start_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_profiles_staff_name_idx on staff_profiles(staff_name);
