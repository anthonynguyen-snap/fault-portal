-- Add auth fields to roster_agents
alter table roster_agents
  add column if not exists email text unique,
  add column if not exists password_hash text,
  add column if not exists role text not null default 'staff' check (role in ('admin', 'staff'));

-- Shift logs table (clock-in / clock-out records)
create table if not exists shift_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references roster_agents(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists shift_logs_agent_id_idx on shift_logs(agent_id);
create index if not exists shift_logs_date_idx on shift_logs(date);
