-- Product availability updates
-- Keeps restock tracking product-first and team-facing, without duplicating
-- detailed shipment records from the external source of truth.

ALTER TABLE restock_items
  ADD COLUMN IF NOT EXISTS store text NOT NULL DEFAULT 'All Stores',
  ADD COLUMN IF NOT EXISTS expected_restock_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_message text NOT NULL DEFAULT '';

UPDATE restock_items
SET expected_restock_label = notes
WHERE expected_restock_label = ''
  AND expected_restock_date IS NULL
  AND notes <> '';
