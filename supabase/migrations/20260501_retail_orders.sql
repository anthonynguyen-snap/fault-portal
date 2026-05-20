-- Retail orders (direct-to-consumer / 3PL fulfilment)
create table if not exists retail_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  order_number text not null,
  platform text default 'Shopify',
  order_date date,
  -- Customer
  customer_name text not null default '',
  customer_email text default '',
  customer_phone text default '',
  shipping_address text default '',
  shipping_city text default '',
  shipping_state text default '',
  shipping_postcode text default '',
  shipping_country text default 'AU',
  -- 3PL
  third_pl_reference text default '',
  warehouse text default '',
  third_pl_notes text default '',
  -- Tracking
  carrier text default '',
  tracking_number text default '',
  tracking_url text default '',
  status text default 'Pending',
  shipped_date date,
  delivered_date date,
  estimated_delivery date,
  notes text default ''
);

create table if not exists retail_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references retail_orders(id) on delete cascade,
  product text not null default '',
  sku text default '',
  quantity_ordered int default 0,
  quantity_shipped int default 0
);

create index if not exists retail_orders_order_date_idx on retail_orders(order_date desc);
create index if not exists retail_order_items_order_id_idx on retail_order_items(order_id);
