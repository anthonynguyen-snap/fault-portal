-- Track whether an invoice has been sent for each retail order
ALTER TABLE retail_orders
  ADD COLUMN IF NOT EXISTS invoice_sent boolean NOT NULL DEFAULT false;
