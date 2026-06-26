-- Add optional launch/finish times for promotions.
-- Dates remain the source of active/archive status; times are for team-facing clarity.

alter table promotions
  add column if not exists start_time text,
  add column if not exists end_time text;
