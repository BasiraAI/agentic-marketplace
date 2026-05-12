-- Up Migration

ALTER TABLE agents
  ADD COLUMN consecutive_health_failures integer NOT NULL DEFAULT 0;

-- Down Migration

ALTER TABLE agents
  DROP COLUMN IF EXISTS consecutive_health_failures;
