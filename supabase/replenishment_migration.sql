-- ============================================================
-- REPLENISHMENT TABLES
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS replenishment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store             TEXT NOT NULL,
  order_number      TEXT NOT NULL DEFAULT '',
  requested_by      TEXT NOT NULL DEFAULT '',
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  status            TEXT NOT NULL DEFAULT 'Pending',
  tracking_number   TEXT NOT NULL DEFAULT '',
  dispatch_date     DATE,
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replenishment_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           UUID NOT NULL REFERENCES replenishment_requests(id) ON DELETE CASCADE,
  stock_item_id        UUID REFERENCES stock_items(id),
  stock_item_name      TEXT NOT NULL DEFAULT '',
  sku                  TEXT NOT NULL DEFAULT '',
  quantity_requested   INTEGER NOT NULL DEFAULT 0,
  quantity_on_hand     INTEGER NOT NULL DEFAULT 0,
  quantity_sent        INTEGER NOT NULL DEFAULT 0,
  source               TEXT NOT NULL DEFAULT 'Storeroom',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (match your existing table policies)
ALTER TABLE replenishment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE replenishment_items    ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (adjust to match your existing policies)
CREATE POLICY "Allow all" ON replenishment_requests FOR ALL USING (true);
CREATE POLICY "Allow all" ON replenishment_items    FOR ALL USING (true);
