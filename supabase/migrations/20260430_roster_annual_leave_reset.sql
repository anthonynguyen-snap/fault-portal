-- Add annual leave reset date to roster_config
-- This date defines the start of each 12-month annual leave window.
-- Agents receive 5 days of annual leave per window (non-accrued, full grant on reset).

ALTER TABLE roster_config
  ADD COLUMN IF NOT EXISTS annual_leave_reset_date date DEFAULT NULL;
