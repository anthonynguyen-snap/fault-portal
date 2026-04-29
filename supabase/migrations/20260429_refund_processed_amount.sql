-- Track the actual amount refunded (may differ from requested amount due to discount codes etc.)
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS processed_amount numeric(10,2) NULL;
