-- Leave payout requests
-- Staff submit payout requests for unused annual leave; admin approves or denies.

create table if not exists leave_payout_requests (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references roster_agents(id) on delete cascade,
  days_requested   numeric(4,1) not null check (days_requested > 0 and days_requested <= 5),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  leave_window_start date not null,
  notes            text not null default '',
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists leave_payout_requests_agent_id_idx on leave_payout_requests(agent_id);
create index if not exists leave_payout_requests_status_idx   on leave_payout_requests(status);
