-- Add internal_notes JSONB column to returns and refund_requests
-- Stores an array of { id, text, author, createdAt } objects

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
