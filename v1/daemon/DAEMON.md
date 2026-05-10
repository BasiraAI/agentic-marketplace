# @basira/daemon — Phase 3 Reference

A single long-running Node.js process that owns all scheduled and chain-watching logic. The daemon has no public-facing HTTP surface for users — only an internal `/health` endpoint for uptime monitoring.

The daemon's uptime is non-negotiable: when the daemon is down, user funds freeze in vaults until auto-release finally runs (auto-release is what releases held funds 24h after a deliverable is submitted).

---

## Design principles

**Single source of truth: the chain.** The chain listener writes DB state from confirmed on-chain events. Crons read DB state and broadcast new transactions. Crons never write final state — they fire a tx and let the listener observe its confirmation. This eliminates the split-brain failure where the cron commits to DB but the chain rejects.

**Idempotency everywhere.** Every chain-driven DB write is idempotent. `settlements` use `UNIQUE(tx_signature, kind, recipient_wallet)`; `tasks`/`disputes` transitions use conditional `WHERE status = 'expected_prior_status'` so replays are no-ops. Listener can replay the same signature 5× and DB state is identical to playing it once.

**Crons are plain async functions.** Each cron lives in `src/cron/<name>.ts` and exports a function `runXxxSweep(connection): Promise<{ swept, sent, ... }>` that's directly callable from tests. `node-cron` only schedules them.

**No leader election.** A single daemon instance is assumed. If two run by accident, both broadcast every cron sweep — wasteful but on-chain instruction-status checks make replays no-ops, so correctness holds. Phase 7 adds leader election.

---

## Process layout

```
src/
├── index.ts          Entry point: env load, signal handlers, start/stop
├── env.ts            Zod-validated env loader (cached singleton)
├── log.ts            pino logger (pretty in dev, JSON in prod)
├── keys.ts           Lazy keypair loaders for keeper + arbitrator
├── lifecycle.ts      startDaemon / stopDaemon / inflight tracking / stoppers
├── http.ts           node:http /health server
├── listener/
│   ├── index.ts      startListener: gap-fill + onLogs subscription + cursor
│   ├── parse.ts      Extract Anchor instruction names from tx logs
│   ├── reconcile.ts  Per-instruction handler dispatch (one big switch)
│   ├── emit.ts       Webhook emission (enqueue + immediate dispatch attempt)
│   └── judge-trigger.ts  Fire-and-forget runJudge() after submit_deliverable
└── cron/
    ├── index.ts          Schedule all crons via node-cron; track last-run
    ├── _send.ts          signAndBroadcast helper (re-fetches blockhash)
    ├── auto-release.ts   3b. claim_after_timeout via keeper (5min)
    ├── auto-dispute.ts   3c. open_dispute via arbitrator (5min)
    ├── expire.ts         3d. expire_task via keeper (5min)
    ├── ghost-disputes.ts 3e. resolve_dispute (forPoster) via arbitrator (5min)
    ├── retry-webhooks.ts 3f. claim + dispatch + retry/fail (1min)
    └── health-check.ts   3g. signed-nonce ping; 3-strike inactive (1h)
```

---

## Chain listener

### Cursor

`daemon_state` table holds a single row with `last_seen_slot bigint`. On startup the daemon:

1. Reads the cursor.
2. Pages through `getSignaturesForAddress(programId, ...)` until reaching a slot ≤ cursor.
3. Replays the collected signatures **oldest first**, calling `processSignature` for each.
4. Subscribes to `onLogs(programId, ..., "confirmed")` for live tail.

`last_seen_slot` advances *after* a signature is successfully reconciled. Each RPC call has 3-attempt retry with linear backoff (1s/2s/3s) — devnet RPC drops occasionally and this absorbs the noise.

### Why no `#[event]` macros?

The Anchor program does not emit `#[event]` declarations (verified via IDL inspection — no `events` array). The listener identifies instructions by parsing the `Program log: Instruction: <CamelName>` log lines that Anchor emits before each instruction handler. Account positions are read from the parsed transaction's instructions array. The parser is pinned by a unit test against the current IDL.

### Idempotent transitions

`tasksDb.transitionStatus(taskId, fromStatus, toStatus)` runs an atomic conditional UPDATE and returns whether the row was actually updated. Webhook emission is gated on this boolean — if the listener replays an already-applied transition, no webhook fires.

### Handlers (per-instruction)

| Instruction | Listener action |
|---|---|
| `register_agent` | log only (agent row was inserted by `completeRegistration` inline) |
| `create_task_*` | log only (task row was inserted by service pre-broadcast) |
| `assign_agent` | `created → assigned`; emit `task.offered` to agent |
| `reject_assignment_*` | `assigned → refunded`; record `refund` settlement; emit `task.refunded` to poster |
| `submit_deliverable` | `assigned → submitted` (sets `submitted_at`); confirm latest deliverable; **fire `runJudge` async**; emit `task.submitted` to poster |
| `approve_*` | `submitted → settled` (sets `settled_at`); record `release` + `fee`; emit `task.approved` to agent |
| `claim_after_timeout_*` | same DB shape as approve; emit `task.settled` to agent |
| `open_dispute` | `submitted → disputed`; insert dispute row if missing; emit `task.disputed` to agent |
| `resolve_dispute_*` | `disputed → settled` (forAgent: 2 settlements) or `disputed → refunded` (forPoster: 1 refund); update `disputes.ruling`; emit accordingly |
| `expire_task_*` | `(created\|assigned) → expired`; record `refund`; emit `task.expired` to poster |
| `cancel_task_*` | `(created\|assigned) → refunded`; record `refund`; emit `task.cancelled` to poster |

### Fee math

The Anchor program splits an approved task at 500 BPS (5%) treasury, 95% to the agent. The listener mirrors this exactly:
```
fee     = amount * 500 / 10_000
release = amount - fee
```

---

## Cron schedules

| Cron | Schedule | Trigger |
|---|---|---|
| `auto-release` | every 5 min | `tasks.status='submitted' AND submitted_at <= now()-24h` AND latest verdict ∈ {pass, unavailable, absent} AND no open dispute |
| `auto-dispute` | every 5 min | same age + `verdict='fail'` + no dispute |
| `expire` | every 5 min | `tasks.status IN (created, assigned) AND deadline <= now()` |
| `ghost-disputes` | every 5 min | open disputes 48h+ with `agent_response IS NULL` |
| `retry-webhooks` | every 1 min | `webhook_deliveries` claimReadyForRetry batch (50) |
| `health-check` | hourly | every active+complete agent — signed-nonce ping; 3 strikes → inactive |

All cron functions are pure orchestration — they read DB, build & sign the unsigned tx returned by `@basira/shared` builders/services, broadcast via `signAndBroadcast`, and let the listener observe the confirmation.

### Stale blockhash

`signAndBroadcast` always re-fetches a fresh blockhash and overrides `tx.message.recentBlockhash` before signing. Cron iterations may queue for minutes; without this, the second tx in a sweep would fail with `BlockhashNotFound`.

### Listener vs cron race

A cron submits `claim_after_timeout` at T0; listener observes at T0+5s and writes the settlement and flips status to `settled`. The cron's `WHERE status='submitted'` filter naturally guards against duplicate broadcasts on the next sweep — the listener has flipped the row first. If the cron is faster than the listener, the second on-chain instruction hits the program's status check and is a no-op (one wasted fee).

---

## Keys

Two keypairs loaded at boot from env-configured paths:

- **`KEEPER_KEYPAIR_PATH`** signs `claim_after_timeout_*` and `expire_task_*`. These are stateless on-chain (anyone can call after the timeout); the keeper just relays. Pays small SOL fees out of its own balance.
- **`ARBITRATOR_KEYPAIR_PATH`** signs `open_dispute` (auto-dispute path) and `resolve_dispute_*` (ghost path). The on-chain program enforces that resolve_dispute's signer is the hardcoded arbitrator address; passing a different key fails on-chain.

Both keypairs are held in process memory, never logged. In dev they're loaded from `v1/keypairs/*.json`. In prod, mount the secret at the same path.

The health-check cron uses the agent's own `webhook_secret` (a symmetric secret the agent has a copy of) to sign the nonce-ping payload — the agent verifies via HMAC. This deliberately reuses the webhook signing protocol rather than introducing a separate "registrar" key. Phase 7 may split this if a separate Basira-controlled signing identity is desired.

---

## Webhook events emitted by the listener

| Event | Recipient | Trigger |
|---|---|---|
| `task.offered` | agent | `assign_agent` confirms |
| `task.submitted` | poster | `submit_deliverable` confirms |
| `task.approved` | agent | `approve_*` confirms |
| `task.settled` | agent | `claim_after_timeout_*` or `resolve_dispute_*` (forAgent) |
| `task.disputed` | agent | `open_dispute` confirms |
| `task.refunded` | poster | `reject_assignment_*` or `resolve_dispute_*` (forPoster) |
| `task.expired` | poster | `expire_task_*` confirms |
| `task.cancelled` | poster | `cancel_task_*` confirms |

Webhooks are signed HMAC-SHA256 over `${timestamp}.${body}` keyed by `agent.webhook_secret` (per-agent symmetric secret). Listener emits once per transition; replays don't double-emit because the conditional UPDATE returns 0 rows on replay.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `SOLANA_RPC_URL` | yes | — | HTTPS Solana RPC for tx broadcast + getSignatures |
| `SOLANA_WS_URL` | yes | — | WebSocket URL for `onLogs` subscription |
| `PROGRAM_ID` | yes | — | Anchor program ID to listen to |
| `KEEPER_KEYPAIR_PATH` | yes | — | Path to keeper.json (for claim/expire) |
| `ARBITRATOR_KEYPAIR_PATH` | yes | — | Path to arbitrator.json (for disputes) |
| `LLM_PROVIDER` | no | `mock` | `mock` or `anthropic` |
| `LLM_API_KEY` | conditional | — | Required if `LLM_PROVIDER=anthropic` |
| `LOG_LEVEL` | no | `info` | pino level: trace/debug/info/warn/error/fatal/silent |
| `HEALTH_PORT` | no | `8080` | TCP port for `/health` endpoint |
| `NODE_ENV` | no | `development` | `development` enables pino-pretty |

---

## Health endpoint

```
GET /health
→ 200 {
    "status": "ok",
    "uptime_ms": <number>,
    "lastSeenSlot": "<bigint as string>",
    "lastCronRunAt": {
      "auto-release": "2026-05-10T15:30:00.000Z" | null,
      "auto-dispute": ...,
      ...
    }
  }
```

For uptime monitors (Sentry, Betteruptime, etc.). All other paths return 404.

---

## Graceful shutdown

`SIGTERM`/`SIGINT` → `stopDaemon()`:

1. Mark process as stopping (gap-fill replay loop checks this and exits early).
2. Wait up to 30s for tracked inflight async work to settle.
3. Run registered stoppers in reverse order: stop crons → unsubscribe listener → close health server → close DB pool.
4. Process exits 0.

`registerStopper(fn)` from `lifecycle.ts` is how each subsystem (cron scheduler, listener, http server) hooks into shutdown.

---

## Testing strategy

- **Unit (vitest)**: `src/listener/parse.test.ts` — parser against hand-built `ParsedTransactionWithMeta`.
- **Integration (vitest + Postgres)**:
  - `listener/reconcile.test.ts` — seed task rows, drive `reconcileTransaction` with hand-built `ParsedProgramTransaction`, assert DB state. Idempotency check by replaying.
  - `listener/cursor.test.ts` — cursor read/write.
  - `cron/auto-release.test.ts`, `cron/sweeps.test.ts` — seed DB candidates, mock `signAndBroadcast`, assert `swept/sent/skipped` counts.
  - `cron/retry-webhooks.test.ts` — live `http.createServer` returning 500 vs 200, assert delivery state machine.
  - `cron/health-check.test.ts` — live agent server signing nonces, assert 3-strike deactivation.
- **End-to-end (`scripts/daemon-e2e.ts`)**: spawns the daemon as a child process, drives the full task lifecycle on **devnet**, polls DB for listener-written transitions, sends `SIGTERM`, asserts `exit 0`.

Tests run sequentially (`pool: forks`, `singleFork: true`) because they share a single Postgres database.

---

## Quickstart

```bash
cd v1
docker compose up -d postgres
cp .env.example .env
# Set DATABASE_URL, SOLANA_RPC_URL, SOLANA_WS_URL, PROGRAM_ID,
# KEEPER_KEYPAIR_PATH, ARBITRATOR_KEYPAIR_PATH, LLM_PROVIDER=mock
npm install
npm run -w @basira/shared db:migrate

# Boot the daemon (development)
npm run daemon:dev

# In another terminal:
curl localhost:8080/health

# Run the e2e:
npm run daemon:e2e
```

---

## Future Phase 7 hooks

- **Sentry** — wire `pino` to `@sentry/pino` for error transport.
- **Metrics** — Prometheus `/metrics` endpoint, counters for swept/sent/failed per cron, listener lag (now − last_seen_slot's blockTime), webhook delivery histograms.
- **Leader election** — Postgres advisory lock at startup gates whether crons run; replicas not holding the lock just listen.
- **Multisig arbitrator** — replace the single arbitrator key with an SPL Governance signature collection.
- **Real PROGRAM_ID env-driven** — currently the listener uses the env `PROGRAM_ID` but builders rely on the hardcoded shared constant. Mainnet deploy needs both wired through env.
