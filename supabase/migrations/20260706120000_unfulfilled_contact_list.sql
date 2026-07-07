-- Shared unfulfilled/backorder contact list.
-- This deliberately works without Shopify: staff can paste rows directly
-- from Excel and use the portal as the durable source of truth.

create table if not exists unfulfilled_orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique,
  customer_name         text not null default '',
  customer_email        text not null default '',
  product_variant       text not null default '',

  contacted_at          timestamptz,
  contacted_by          text not null default '',
  follow_up_required    boolean not null default false,
  follow_up_on          date,
  outcome               text not null default 'Waiting for stock',
  resolved_at           timestamptz,
  resolved_by           text not null default '',
  internal_notes        jsonb not null default '[]'::jsonb,

  source                text not null default 'Manual import',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint unfulfilled_orders_outcome_check check (outcome in (
    'Waiting for stock',
    'Split fulfilment',
    'Cancelled',
    'Colour swap',
    'Alternative product',
    'Other'
  ))
);

create index if not exists idx_unfulfilled_orders_active
  on unfulfilled_orders (resolved_at, follow_up_required, created_at desc);

create index if not exists idx_unfulfilled_orders_customer_email
  on unfulfilled_orders (customer_email);
