-- Activity log table — append-only audit trail for all portal actions
CREATE TABLE IF NOT EXISTS activity_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           timestamptz NOT NULL    DEFAULT now(),
  actor        text        NOT NULL    DEFAULT '',
  action       text        NOT NULL,
  entity_type  text        NOT NULL,
  entity_id    text        NOT NULL    DEFAULT '',
  entity_label text        NOT NULL    DEFAULT '',
  detail       jsonb                   DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS activity_log_ts_idx          ON activity_log (ts DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON activity_log (entity_type);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx       ON activity_log (actor);
