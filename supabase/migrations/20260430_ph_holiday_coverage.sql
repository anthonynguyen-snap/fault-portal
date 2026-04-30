-- Tracks per-agent coverage confirmation for PH Regular Holidays.
-- working = true  → contractor confirmed they will work the holiday
-- working = false → contractor confirmed they are taking the day off (triggers ph-holiday leave)

CREATE TABLE IF NOT EXISTS ph_holiday_coverage (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date date        NOT NULL,
  agent_id     uuid        NOT NULL REFERENCES roster_agents(id) ON DELETE CASCADE,
  working      boolean     NOT NULL,
  notes        text        NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  UNIQUE (holiday_date, agent_id)
);
