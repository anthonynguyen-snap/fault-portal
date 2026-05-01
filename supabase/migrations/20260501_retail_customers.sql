-- Customer database for retail / direct-to-consumer orders
create table if not exists retail_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null default '',
  email text default '',
  phone text default '',
  shipping_address text default '',
  shipping_city text default '',
  shipping_state text default '',
  shipping_postcode text default '',
  shipping_country text default 'AU',
  notes text default ''
);

-- Link retail orders to customers (nullable — existing orders won't have one)
alter table retail_orders add column if not exists customer_id uuid references retail_customers(id) on delete set null;

create index if not exists retail_customers_name_idx on retail_customers(name);
create index if not exists retail_orders_customer_id_idx on retail_orders(customer_id);
