alter table unfulfilled_orders
  add column if not exists assigned_to text not null default '';

create index if not exists idx_unfulfilled_orders_assigned_to
  on unfulfilled_orders (assigned_to, resolved_at, created_at desc);
