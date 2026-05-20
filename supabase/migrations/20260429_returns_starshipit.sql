-- Add Starshipit order number to returns table
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS starshipit_order_number text NOT NULL DEFAULT '';
