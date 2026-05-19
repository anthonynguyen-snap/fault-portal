-- Incoming Shipments tracker
-- Mirrors the Demand Planning & Supply Chain Google Sheet structure.

CREATE TABLE IF NOT EXISTS shipments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number      text        NOT NULL,
  location             text        NOT NULL DEFAULT '',
  transport_type       text        NOT NULL DEFAULT 'Sea',   -- 'Sea' | 'Air'
  provider             text        NOT NULL DEFAULT '',
  tracking_number      text        NOT NULL DEFAULT '',
  eta                  date        NULL,
  status               text        NOT NULL DEFAULT 'Pending',
  -- 'Pending' | 'In Transit' | 'At Port' | 'Delivered' | 'Delayed'
  cost_usd             numeric(12,2) NOT NULL DEFAULT 0,
  cost_aud             numeric(12,2) NOT NULL DEFAULT 0,
  cartons              text        NOT NULL DEFAULT '',
  weight_kg            text        NOT NULL DEFAULT '',
  branch_transfer_number text      NOT NULL DEFAULT '',
  asn_number           text        NOT NULL DEFAULT '',
  notes                text        NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_name text        NOT NULL,
  sku          text        NOT NULL DEFAULT '',
  quantity     integer     NOT NULL DEFAULT 0,
  notes        text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
