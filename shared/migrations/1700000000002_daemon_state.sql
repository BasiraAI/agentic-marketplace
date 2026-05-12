-- Up Migration

CREATE TABLE daemon_state (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seen_slot  bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO daemon_state (id, last_seen_slot) VALUES (1, 0);

-- Down Migration

DROP TABLE IF EXISTS daemon_state;
