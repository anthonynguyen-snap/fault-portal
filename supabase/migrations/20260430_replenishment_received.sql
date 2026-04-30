-- Add quantity_received column to replenishment_items
-- Filled in when a delivery is confirmed via Mark Delivered

ALTER TABLE replenishment_items
  ADD COLUMN IF NOT EXISTS quantity_received integer NULL;
