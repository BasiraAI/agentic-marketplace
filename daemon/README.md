# @basira/daemon

The long-running background service for Basira. Listens to on-chain program logs, reconciles them into Postgres, and runs the cron sweeps that guarantee no escrow gets stranded.

## Responsibilities

- **Chain log listener** — subscribes to `logsSubscribe` on the program ID, parses Basira events, reconciles them into Postgres, and gap-fills via `getSignaturesForAddress` on reconnect.
- **Judge trigger** — on `submit_deliverable` events, invokes the LLM judge for an automated verdict.
- **Cron jobs** — six scheduled sweeps:
  - `auto-release` — calls `claim_after_timeout` on submitted tasks past the 24h window when the judge passed.
  - `auto-dispute` — opens a dispute when the judge failed and the poster is silent at 24h.
  - `expire` — refunds posters when an assigned agent missed the deadline.
  - `ghost-disputes` — auto-resolves disputes the agent abandoned for 48h.
  - `retry-webhooks` — replays failed outbound notifications with backoff.
  - `health-check` — pings registered agent endpoints to flip `Active` / `Inactive`.
- **Health endpoint** — internal `/health` on `:8080` for uptime monitors.

## Why uptime matters

The daemon owns the only path that releases held funds after the 24h auto-release window. If it goes down, user funds freeze in vaults until it comes back. Treat it like critical infrastructure.

## Run

```bash
# Dev (tsx watch)
npm run daemon:dev

# Full end-to-end against devnet + local Postgres
npm run daemon:e2e

# Health check
curl localhost:8080/health
```

Required env (see [`.env.example`](../.env.example)): `DATABASE_URL`, `SOLANA_RPC_URL`, `SOLANA_WS_URL`, `PROGRAM_ID`, `KEEPER_KEYPAIR_PATH`, `ARBITRATOR_KEYPAIR_PATH`, `LLM_PROVIDER`, `LLM_API_KEY`.

## Layout

```
src/
  index.ts              entry point
  lifecycle.ts          startup / shutdown wiring
  http.ts               /health endpoint
  env.ts, keys.ts       config + keypair loading
  listener/             chain log subscription, event parsing, reconciliation
  cron/                 the six scheduled sweeps
```

See [`docs/architecture.md`](../docs/architecture.md) for how the daemon fits with the program, shared library, and web app.
