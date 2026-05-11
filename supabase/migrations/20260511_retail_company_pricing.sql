-- Add company_name to retail_customers
ALTER TABLE retail_customers
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '';

-- Add company_name to retail_orders (denormalised for display without join)
ALTER TABLE retail_orders
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '';

-- Add unit_price to retail_order_items
ALTER TABLE retail_order_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) NOT NULL DEFAULT 0;
