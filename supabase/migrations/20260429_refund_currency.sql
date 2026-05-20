-- Add currency column to refund_requests
-- Run this in your Supabase SQL editor before deploying the currency selector update

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AUD';
