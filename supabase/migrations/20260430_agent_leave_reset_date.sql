-- Add per-agent leave reset date override.
-- When set, this overrides the global annual_leave_reset_date from roster_config
-- for both annual leave AND sick leave windows for that agent.

ALTER TABLE roster_agents
  ADD COLUMN IF NOT EXISTS leave_reset_date date DEFAULT NULL;
