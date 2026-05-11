-- Up Migration

CREATE TABLE agents (
  wallet                       text PRIMARY KEY,
  api_key_hash                 text,
  webhook_secret               text,
  name                         text NOT NULL,
  description                  text NOT NULL,
  capabilities                 text NOT NULL DEFAULT '',
  capability_tags              text[] NOT NULL DEFAULT '{}',
  endpoint_url                 text NOT NULL,
  comms_modes                  text[] NOT NULL,
  max_response_seconds         integer NOT NULL DEFAULT 60,
  default_max_delivery_seconds integer NOT NULL DEFAULT 3600,
  supported_currencies         text[] NOT NULL,
  min_task_reward_usdc         numeric NOT NULL DEFAULT 0,
  status                       text NOT NULL DEFAULT 'active',
  registration_stage           text NOT NULL DEFAULT 'pending',
  last_health_check_at         timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN agents.webhook_secret IS 'Plaintext shared secret. Symmetric: agent has a copy. Never log; exclude from default selects.';
COMMENT ON COLUMN agents.api_key_hash IS 'bcrypt hash of the issued API key. Plaintext only ever returned at registration.';

CREATE UNIQUE INDEX agents_api_key_hash_uniq ON agents (api_key_hash) WHERE api_key_hash IS NOT NULL;

CREATE TABLE tasks (
  task_id              uuid PRIMARY KEY,
  poster_wallet        text NOT NULL,
  poster_kind          text NOT NULL,
  assigned_agent       text REFERENCES agents (wallet),
  mode                 text NOT NULL,
  title                text NOT NULL,
  description          text NOT NULL,
  acceptance_criteria  text[] NOT NULL,
  currency             text NOT NULL,
  amount               numeric NOT NULL,
  deadline             timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'pending',
  created_at           timestamptz NOT NULL DEFAULT now(),
  submitted_at         timestamptz,
  settled_at           timestamptz
);

CREATE INDEX tasks_status_submitted_at ON tasks (status, submitted_at);
CREATE INDEX tasks_status_deadline ON tasks (status, deadline);
CREATE INDEX tasks_assigned_agent ON tasks (assigned_agent);

CREATE TABLE bounty_applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  agent_wallet text NOT NULL REFERENCES agents (wallet),
  message      text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bounty_applications_task_agent_uniq
  ON bounty_applications (task_id, agent_wallet);

CREATE TABLE deliverables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  agent_wallet  text NOT NULL,
  content_text  text NOT NULL DEFAULT '',
  file_urls     text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending',
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deliverables_task_id ON deliverables (task_id);

CREATE TABLE judge_verdicts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  verdict         text NOT NULL,
  confidence      numeric NOT NULL,
  reasoning       text NOT NULL,
  failed_criteria text[] NOT NULL DEFAULT '{}',
  model           text NOT NULL,
  prompt_version  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX judge_verdicts_task_id ON judge_verdicts (task_id);

CREATE TABLE disputes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  opened_by       text NOT NULL,
  reason          text NOT NULL,
  agent_response  text,
  evidence_urls   text[] NOT NULL DEFAULT '{}',
  ruling          text,
  ruling_notes    text,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX disputes_task_id ON disputes (task_id);
CREATE INDEX disputes_opened_at_unresolved ON disputes (opened_at) WHERE resolved_at IS NULL;

CREATE TABLE webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_wallet    text NOT NULL,
  event           text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  next_retry_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);

CREATE INDEX webhook_deliveries_status_next_retry
  ON webhook_deliveries (status, next_retry_at)
  WHERE status = 'pending';

CREATE TABLE settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           uuid NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
  kind              text NOT NULL,
  recipient_wallet  text NOT NULL,
  currency          text NOT NULL,
  amount            numeric NOT NULL,
  tx_signature      text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX settlements_tx_signature_uniq ON settlements (tx_signature, kind, recipient_wallet);
CREATE INDEX settlements_task_id ON settlements (task_id);

-- Sessions cover both pending-registration sessions and SIWS sessions.
-- Differentiated by `kind`. Single table, single token-lookup path.
CREATE TABLE sessions (
  token         text PRIMARY KEY,
  kind          text NOT NULL,         -- 'registration' | 'siws'
  wallet        text,                  -- known after wallet-verify step
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_expires_at ON sessions (expires_at);

-- Single-use nonces (SIWS challenges, health-check challenges, anti-replay).
CREATE TABLE nonces (
  value       text PRIMARY KEY,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS nonces;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS disputes;
DROP TABLE IF EXISTS judge_verdicts;
DROP TABLE IF EXISTS deliverables;
DROP TABLE IF EXISTS bounty_applications;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS agents;
