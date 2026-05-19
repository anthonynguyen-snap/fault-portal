-- 3PL Restock Tracker
-- Tracks products that are out of stock at the 3PL warehouse,
-- including expected restock dates and supplier information.
CREATE TABLE IF NOT EXISTS restock_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name         text        NOT NULL,
  sku                  text        NOT NULL DEFAULT '',
  status               text        NOT NULL DEFAULT 'Out of Stock',
  -- status values: 'Out of Stock' | 'Backordered' | 'On Order' | 'Back in Stock'
  expected_restock_date date       NULL,
  supplier             text        NOT NULL DEFAULT '',
  notes                text        NOT NULL DEFAULT '',
  resolved             boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz NULL
);
