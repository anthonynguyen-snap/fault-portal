create table if not exists product_launches (
  id          text primary key default 'LAUNCH-' || extract(epoch from now())::bigint,
  name        text not null,
  description text not null default '',
  price_aud   numeric(10,2),
  image_url   text not null default '',
  launch_date date,
  link        text not null default '',
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
