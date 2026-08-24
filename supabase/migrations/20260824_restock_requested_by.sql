-- Lets staff ask when a product is coming back in stock, instead of an
-- admin having to add every tracker entry themselves. A requested item is
-- just a restock_items row with requested_by set and no answer yet.
ALTER TABLE restock_items
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS requested_note text NOT NULL DEFAULT '';
