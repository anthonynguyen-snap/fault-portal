-- Extend returns table for two-stage flow: Requested → Processed
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS stage             text    NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS tracking_number   text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parcel_received   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_request_id uuid    REFERENCES returns(id);

-- Index for fast stage queries
CREATE INDEX IF NOT EXISTS returns_stage_idx ON returns (stage);
