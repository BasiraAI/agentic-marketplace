-- Basira v1 initial schema
-- Tables derived from shared/schemas/index.ts and queries in shared/, web/, worker/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── agents ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  wallet                       TEXT PRIMARY KEY,
  name                         TEXT NOT NULL,
  description                  TEXT NOT NULL DEFAULT '',
  capabilities                 TEXT NOT NULL DEFAULT '',
  capability_tags              TEXT[] NOT NULL DEFAULT '{}',
  endpoint_url                 TEXT NOT NULL,
  comms_modes                  TEXT[] NOT NULL DEFAULT '{webhook}',
  max_response_seconds         INTEGER NOT NULL DEFAULT 60,
  default_max_delivery_seconds INTEGER NOT NULL DEFAULT 3600,
  supported_currencies         TEXT[] NOT NULL DEFAULT '{SOL}',
  min_task_reward_usdc         NUMERIC NOT NULL DEFAULT 0,
  status                       TEXT NOT NULL DEFAULT 'active',
  api_key                      TEXT UNIQUE,
  webhook_secret               TEXT,
  last_health_check_at         TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── tasks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  task_id              UUID PRIMARY KEY,
  poster_wallet        TEXT NOT NULL,
  poster_kind          TEXT NOT NULL CHECK (poster_kind IN ('human','registered_agent','outside_agent')),
  assigned_agent       TEXT,
  mode                 TEXT NOT NULL CHECK (mode IN ('direct','bounty')),
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  acceptance_criteria  TEXT[] NOT NULL,
  currency             TEXT NOT NULL CHECK (currency IN ('SOL','USDC')),
  amount               NUMERIC NOT NULL,
  deadline             TIMESTAMPTZ NOT NULL,
  status               TEXT NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created','assigned','submitted','approved','disputed','settled','refunded','expired')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at         TIMESTAMPTZ,
  settled_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tasks_status_idx       ON tasks (status);
CREATE INDEX IF NOT EXISTS tasks_poster_idx       ON tasks (poster_wallet);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx     ON tasks (assigned_agent);
CREATE INDEX IF NOT EXISTS tasks_deadline_idx     ON tasks (deadline);
CREATE INDEX IF NOT EXISTS tasks_submitted_at_idx ON tasks (submitted_at);

-- ─── bounty_applications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bounty_applications (
  id            UUID PRIMARY KEY,
  task_id       UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  agent_wallet  TEXT NOT NULL,
  message       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, agent_wallet)
);

-- ─── deliverables ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliverables (
  id            UUID PRIMARY KEY,
  task_id       UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  agent_wallet  TEXT NOT NULL,
  content_text  TEXT NOT NULL DEFAULT '',
  file_urls     TEXT[] NOT NULL DEFAULT '{}',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deliverables_task_idx ON deliverables (task_id);

-- ─── judge_verdicts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS judge_verdicts (
  id              UUID PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  verdict         TEXT NOT NULL CHECK (verdict IN ('pass','fail','unavailable')),
  confidence      NUMERIC NOT NULL,
  reasoning       TEXT NOT NULL,
  failed_criteria INTEGER[] NOT NULL DEFAULT '{}',
  model           TEXT NOT NULL,
  prompt_version  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS judge_verdicts_task_idx ON judge_verdicts (task_id);

-- ─── disputes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id                  UUID PRIMARY KEY,
  task_id             UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  opened_by           TEXT NOT NULL,
  reason              TEXT NOT NULL,
  agent_response      TEXT,
  ruling              TEXT CHECK (ruling IS NULL OR ruling IN ('agent','poster')),
  ruling_notes        TEXT,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  agent_responded_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS disputes_task_idx          ON disputes (task_id);
CREATE INDEX IF NOT EXISTS disputes_unresolved_idx    ON disputes (resolved_at) WHERE resolved_at IS NULL;

-- ─── settlements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id                UUID PRIMARY KEY,
  task_id           UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('release','refund','fee')),
  recipient_wallet  TEXT NOT NULL,
  currency          TEXT NOT NULL CHECK (currency IN ('SOL','USDC')),
  amount            NUMERIC NOT NULL,
  tx_signature      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS settlements_task_idx ON settlements (task_id);

-- ─── webhook_deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            UUID PRIMARY KEY,
  agent_wallet  TEXT NOT NULL,
  event         TEXT NOT NULL,
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','delivered','failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS webhook_pending_idx ON webhook_deliveries (status, attempts) WHERE status = 'failed';

-- ─── sync_state (worker chain-listener cursor) ───────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seen_slot  BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sync_state (id, last_seen_slot) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
