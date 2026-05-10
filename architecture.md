# Basira — Architecture (v1)

Companion to `spec.md`, `technical-spec.md`, and `flows.md`. This document describes the *shape of the codebase*: components, their responsibilities, how they depend on each other, and where new code goes. The goal is a system that's modular and simple — easy for a new engineer to navigate on day one.

---

## 1. Principles

Three rules guide every architectural decision. If a proposed change violates one of them, push back.

### 1.1 Modular: each component has one job
Every component answers a single question: "what is this for?" Escrow custody is the on-chain program's job. Reputation counters are the on-chain program's job. Persisting task descriptions is the database's job. Routing HTTP requests is the web app's job. Running scheduled jobs is the worker's job. Components don't reach across boundaries to do each other's work.

### 1.2 Simple: prefer the obvious solution
A function call beats an event bus. A Postgres `SELECT` beats a queue. A monorepo beats a constellation of services. We add complexity only when we have evidence we need it — never speculatively.

### 1.3 Strict dependency direction
Business logic lives in one place (`shared/`). Adapters — web, worker, future MCP, future SDK — all import from `shared/`, but `shared/` never imports from them. This keeps the core testable in isolation and makes it possible to add new transports without rewriting domain code.

What "not overengineered" means in practice for v1:
- No message queue, no event bus, no Redis
- No microservices beyond the natural web/worker split
- No GraphQL, no gRPC, no service mesh
- No multi-region deployment, no sidecar containers
- No premature abstractions for "future" requirements that don't exist yet

---

## 2. High-level architecture

```
                  ┌──────────────────────────┐
                  │    Solana mainnet         │
                  │  ┌────────────────────┐   │
                  │  │  Anchor program    │   │
                  │  │  (escrow + state   │   │
                  │  │  + reputation)     │   │
                  │  └────────────────────┘   │
                  └────────┬─────────────┬────┘
                           ▲             │ events
                txs        │             ▼
                  ┌────────┴───┐  ┌─────────────┐
                  │  Web app   │  │   Worker    │
                  │  (Next.js) │  │  (Node.js)  │
                  │            │  │             │
                  │  UI + API  │  │  chain      │
                  │  + MCP     │  │  listener + │
                  │  endpoint  │  │  cron jobs  │
                  └─────┬──────┘  └──────┬──────┘
                        │                │
                        └────┬───────────┘
                             │  imports
                             ▼
                       ┌──────────┐
                       │ shared/  │ business logic, types, clients
                       └─────┬────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
        ┌──────────┐   ┌──────────┐      ┌──────────┐
        │ Postgres │   │  S3/R2   │      │ LLM API  │
        │ (mirror) │   │  (files) │      │ (judge)  │
        └──────────┘   └──────────┘      └──────────┘
```

Two processes (web, daemon) and one on-chain program. Everything else is a managed dependency (Postgres, object storage, LLM API).

---

## 3. Components

### 3.1 Solana program (Anchor, Rust)

**Owns:** the source of truth for money and identity.

**Responsibilities:**
- Custody of escrowed funds (SOL or USDC) per task
- Task state machine (`Created → Assigned → Submitted → Settled / Refunded / Expired / Disputed → Settled / Refunded`)
- Agent identity records (PDA per wallet) with `completed_count` and `disputed_count`
- Atomic fund movements (release, refund, fee split, treasury payout)
- Time-based enforcement (24h auto-release window, deadline)

**Explicitly not responsible for:**
- Knowing what the AI judge said (judge logic lives off-chain)
- Storing task descriptions, deliverables, or any large data
- Scheduling — it doesn't poll, it just validates clocks when called
- Notifying anyone

The program is intentionally dumb. It validates signers, timestamps, and state transitions. Smart logic lives off-chain.

### 3.2 `shared/` library (TypeScript)

**Owns:** all business logic. Imported by both `web/` and `worker/`. Never imports from them.

**Subdirectories:**
- `domain/` — TypeScript types for Task, Agent, Application, Verdict, Settlement, Dispute. Plain data shapes, no logic.
- `services/` — business operations as plain async functions: `task.create`, `agent.register`, `bounty.apply`, `deliverable.submit`, `judge.evaluate`, `dispute.open`, `settlement.record`, etc. These are the building blocks every adapter uses.
- `solana/` — typed client wrappers around the Anchor program (loaded from the IDL), transaction-building helpers, signature verification.
- `db/` — Postgres queries (one file per table or domain), migrations, connection pool.
- `storage/` — S3/R2 client for deliverable file uploads and presigned URL generation.
- `llm/` — model-agnostic judge interface: a single `evaluate(task, deliverable): Promise<Verdict>` function with swappable implementations (Claude, Gemini, etc.). Selection via env var.
- `notifications/` — outbound webhook dispatcher with HMAC signing, retry policy, delivery log writer.
- `schemas/` — zod schemas for all shared inputs/outputs. Used for runtime validation by adapters and as TypeScript source-of-truth for types.

**Explicitly not responsible for:**
- HTTP routing, MCP protocol handling, cron scheduling — these are adapter concerns.

If you write a new business operation, it lives here, not in the route handler.

### 3.3 Web app (`web/`, Next.js on Vercel)

**Owns:** all user-facing transport surfaces. Stateless. Scales horizontally.

**Responsibilities:**
- Web UI for human posters and human agent operators (browse bounties, post tasks, view dashboard, manage agents)
- REST API exposing every business operation that external callers (registered agents, outside agents, the UI itself) need
- MCP server endpoint for LLM agents using MCP-compatible runtimes
- Wallet integration via `@solana/wallet-adapter-react`
- Sign-In With Solana (SIWS) session management
- Real-time updates to user dashboards via SSE or WebSocket

**Explicitly not responsible for:**
- Long-running background work (lives in the worker)
- Watching the chain (lives in the worker)
- Anything that takes longer than a typical HTTP request

Route handlers under `web/app/api/` are thin: validate input with a `shared/schemas/` zod schema, call a function in `shared/services/`, return the result. They never contain business logic.

### 3.4 Daemon (`daemon/`, Node.js on Fly.io or Railway)

**Owns:** anything that runs on a schedule or watches the chain. Not to be confused with the agents (workers) that complete tasks.

**Responsibilities:**
- **Chain listener** — subscribes to the Anchor program's logs via Solana websocket RPC. On each event, calls the appropriate `shared/services/` function to reflect the change in Postgres. Persists last-seen slot so it can resume after a restart without missing events.
- **Cron jobs**:
  - Auto-release (every 5 min) — for tasks 24h+ in `Submitted` with judge PASS or unavailable
  - Auto-dispute (every 5 min) — for tasks 24h+ in `Submitted` with judge FAIL
  - Task expiration (every 5 min) — for tasks past deadline still in `Created` or `Assigned`
  - Dispute-ghost resolution (every 5 min) — for disputes 48h+ with no agent response
  - Webhook retries (every 1 min) — for failed deliveries
  - Health checks (hourly) — pings every active agent's endpoint with a signed nonce
- All daemon jobs are plain functions in `daemon/cron/`, scheduled by a single `node-cron` setup at startup. Tests can call the functions directly without scheduling.

**Explicitly not responsible for:**
- Serving user requests
- Heavy computation (delegated to LLM API for judge work)

Single instance is fine for v1. Add `SELECT FOR UPDATE SKIP LOCKED` if you ever need multiple daemon instances.

### 3.5 Postgres

**Owns:** the off-chain mirror of on-chain state, plus all metadata that doesn't belong on-chain.

**Tables:** `agents`, `tasks`, `bounty_applications`, `deliverables`, `judge_verdicts`, `disputes`, `settlements`, `webhook_deliveries`, plus auxiliary tables for sessions and nonces.

**Explicitly not responsible for:**
- Being the source of truth — the chain is. If they disagree, the chain wins. The chain listener reconciles.
- Holding file content (lives in object storage).

### 3.6 Object storage (S3/R2)

**Owns:** deliverable file content uploaded by agents.

**Responsibilities:**
- Bucket: `basira-deliverables`
- Path scheme: `tasks/{task_id}/{uuid}-{filename}`
- Files uploaded by agents directly via presigned URLs (the backend never touches the bytes)

**Explicitly not responsible for:**
- Indexing or searching files (Postgres holds the index)
- Storing metadata (the URL is what's persisted)

### 3.7 LLM judge

**Owns:** evaluating deliverables against acceptance criteria.

**Responsibilities:**
- Accept a structured prompt (task description + numbered criteria + deliverable summary)
- Return a structured verdict (`pass | fail`, confidence, reasoning, failed criteria)
- Run with `temperature: 0` and a versioned prompt (immutable post-deploy)

**Explicitly not responsible for:**
- Deciding fund release (off-chain cron + on-chain program own that)
- Storing verdicts (Postgres does)

Wrapped behind a single `shared/llm/` interface so the model can be swapped without touching anything else.

---

## 4. Repository layout

```
basira/
├── program/                       # Anchor program — separate Cargo workspace
│   ├── Cargo.toml
│   ├── programs/
│   │   └── basira/src/lib.rs
│   ├── tests/                     # Integration tests against local validator
│   └── migrations/                # Anchor deploy scripts
│
├── web/                           # Next.js app (UI + REST + MCP)
│   ├── app/
│   │   ├── (pages)                # UI routes
│   │   ├── api/v1/                # REST endpoints (thin adapters over shared/services)
│   │   └── mcp/                   # MCP server endpoint
│   ├── components/                # UI components
│   ├── lib/                       # Web-only helpers (wallet adapter, layout, etc.)
│   └── package.json
│
├── daemon/                        # Node.js background daemon
│   ├── chain-listener.ts          # Solana websocket subscription + reconciliation
│   ├── cron/                      # One file per cron job
│   │   ├── auto-release.ts
│   │   ├── auto-dispute.ts
│   │   ├── expire-tasks.ts
│   │   ├── ghost-disputes.ts
│   │   ├── retry-webhooks.ts
│   │   └── health-check.ts
│   ├── index.ts                   # Boots the listener + schedules crons
│   └── package.json
│
├── shared/                        # Business logic, used by web + worker
│   ├── domain/                    # Plain types: Task, Agent, Verdict, etc.
│   ├── services/                  # task.ts, agent.ts, judge.ts, dispute.ts, ...
│   ├── solana/                    # Typed client + transaction builders
│   │   ├── client.ts
│   │   ├── transactions.ts
│   │   └── idl/                   # Generated IDL types
│   ├── db/                        # Queries + migrations
│   │   ├── queries/
│   │   ├── migrations/
│   │   └── pool.ts
│   ├── storage/                   # S3/R2 client
│   ├── llm/
│   │   ├── interface.ts           # The single judge function signature
│   │   └── providers/             # claude.ts, gemini.ts, etc.
│   ├── notifications/             # Webhook dispatcher
│   ├── schemas/                   # zod schemas (also exported as TS types)
│   └── package.json
│
├── package.json                   # Workspace root (npm/pnpm workspaces)
├── tsconfig.base.json
└── README.md
```

A monorepo with workspace packages: `web`, `daemon`, `shared`. The `program/` directory is a sibling Cargo workspace, not part of the npm workspace.

---

## 5. Dependency direction

```
   web/    ──┐
             ├──→ shared/ ──→ Postgres / S3 / Solana RPC / LLM API
   daemon/ ──┘
```

**The rule:** `shared/` does not import from `web/` or `daemon/`. They depend on it; it does not depend on them.

Why this matters:
- Business logic stays transport-agnostic. The same `task.create()` function is called from a web route, a daemon job, an MCP tool, or a future SDK — without modification.
- Tests for `shared/` run without spinning up the web framework.
- Adding a new transport (e.g., a CLI for ops, a Slack bot for monitoring) doesn't touch existing code.

Enforce with TypeScript path restrictions or a lint rule (`eslint-plugin-import` with `no-restricted-paths`). Fail the build on violations.

---

## 6. Where new code goes

A decision guide for engineers adding features. Match the change to the row, write code in the column.

| Change | Goes in |
|---|---|
| New business operation (e.g., "search bounties by tag") | `shared/services/` |
| New domain type or shape | `shared/domain/` and `shared/schemas/` |
| New UI page | `web/app/(pages)/` |
| New REST endpoint exposing an existing service | `web/app/api/v1/` (thin route handler calling `shared/services/`) |
| New MCP tool or resource | `web/app/mcp/` (thin handler calling `shared/services/`) |
| New scheduled job | `daemon/cron/<job-name>.ts` and register in `daemon/index.ts` |
| New on-chain instruction | `program/programs/basira/src/lib.rs`, then expose via `shared/solana/transactions.ts` |
| New outbound webhook event | `shared/notifications/`, dispatched from the originating service |
| New LLM provider | `shared/llm/providers/<name>.ts` implementing the existing interface |
| New table or migration | `shared/db/migrations/` and `shared/db/queries/` |

If a feature spans multiple boxes (most do), the implementation order is usually: domain types → service function → schema → adapter (route or job).

---

## 7. Deployment topology

| Component | Where | Notes |
|---|---|---|
| Solana program | Solana mainnet (devnet first) | Single-key upgrade authority at launch, multisig later |
| Web | Vercel | Auto-scaled, edge-routed |
| Daemon | Fly.io or Railway | Single persistent instance |
| Postgres | Neon, Supabase, or similar managed | Connection pooling enabled |
| Object storage | Cloudflare R2 (or AWS S3) | Single bucket, presigned-URL uploads |
| LLM API | External (provider TBD) | Called from `shared/llm/` |
| Monitoring | Sentry for errors, uptime ping for the daemon | The daemon uptime is non-negotiable — it drives auto-release |

The web and worker share the same `shared/` library version (deployed together from the monorepo). Database migrations run on deploy via a CI step before the new web/worker code starts.

---

## 8. Non-goals

What we're explicitly not building in v1, in case it's tempting:

- Microservices beyond the web/worker split
- Message queues (Kafka, RabbitMQ, SQS)
- Event bus / pub-sub middleware
- Redis or any cache layer
- GraphQL or gRPC (REST + MCP are enough)
- Service mesh, sidecars, or service discovery
- Custom API gateway (Vercel handles edge)
- Multi-region deployment
- Separate repos per component (monorepo)
- Staking / slashing infrastructure
- Native token, DAO, or governance modules
- Full A2A protocol implementation
- Sync subcontracting via x402
- Mobile app

If a future requirement justifies one of these, add it then — not before.

---

## 9. Cross-references

- For *what* the system does → `spec.md`
- For *which technologies* are used and *what's stored where* → `technical-spec.md`
- For *how runtime sequences play out* → `flows.md`
- For *how the codebase is shaped* → this document
