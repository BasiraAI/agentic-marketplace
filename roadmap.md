# Basira — Build Roadmap (v1)

Companion to `spec.md`, `technical-spec.md`, `flows.md`, and `architecture.md`. This document defines the **build sequence**: discrete phases, each one independently testable, building from the source of truth (Solana program) outward to the user-facing layers. Every phase has a clear exit criterion before the next phase starts.

Two principles drive the order:

1. **Inside-out.** Solana program first (the source of truth for money), then shared library, then transports (web, daemon), then UI, then agents. Each layer is built against the layer below it once that layer is stable.

2. **Each phase is independently testable.** No phase requires the next phase to verify it. Anchor program → tested with `anchor test`. Shared library → tested against a deployed devnet program. Daemon → tested by triggering devnet events. Web API → tested with curl. UI → tested by clicking. Agent → exercises everything end-to-end.

---

## Phase 0 — Setup (foundations)

**Goal:** All accounts, repos, and CI in place so Phase 1 can start without yak-shaving.

**Scope:**
- Initialize monorepo: `program/` (Cargo workspace), `web/`, `daemon/`, `shared/` (npm workspaces)
- Solana keypair generation (deployer, treasury, arbitrator, keeper) — store securely
- Account creation: Vercel, Fly.io or Railway, managed Postgres (Neon/Supabase), Cloudflare R2 (or AWS S3), LLM API key, Sentry
- CI pipeline (GitHub Actions): lint, typecheck, anchor test, npm test, deploy on tag
- Env var conventions: `.env.example` files committed, real secrets in 1Password/Vercel/Fly secrets
- TypeScript config, ESLint with `no-restricted-paths` enforcing `shared/` doesn't import from `web/` or `daemon/`

**Exit criteria:**
- `anchor test` runs (against an empty program template)
- `npm install && npm run lint && npm run typecheck` runs across all workspaces
- CI green on a trivial PR
- All accounts created, secrets in place

---

## Phase 1 — Solana program

**Goal:** A complete, tested Anchor program covering every instruction in `technical-spec.md`. This is the source of truth. Get it right; everything above depends on it.

**Sub-phases:**
- **1a.** Account schemas (`AgentAccount`, `TaskAccount`, `EscrowVault`) per `technical-spec.md`. Include `Refunded` and `Expired` status variants.
- **1b.** Instructions:
  - `register_agent`
  - `create_task` (handles direct + bounty modes, SOL + USDC currencies)
  - `assign_agent`
  - `reject_assignment` (closes the direct-mode design hole)
  - `submit_deliverable`
  - `approve`
  - `claim_after_timeout`
  - `open_dispute` (poster OR `arbitrator_key` signer)
  - `resolve_dispute`
  - `expire_task`
  - `cancel_task`
- **1c.** Constants: `FEE_BPS=500`, `AUTO_RELEASE_SECONDS=86400`, `OFFER_RESPONSE_SECONDS=60`, `TREASURY`, `ARBITRATOR_KEY` (single keys at launch)
- **1d.** USDC token-account creation logic (recipient ATA created on-the-fly when needed, fee payer relevant per instruction)
- **1e.** Integration tests covering every state transition: happy path direct, happy path bounty, dispute-for-agent, dispute-for-poster, agent ghosts on dispute, deadline expiration, agent rejects assignment, cancellation, USDC + SOL paths

**Exit criteria:**
- All instructions implemented
- 100% of state transitions covered by tests
- `anchor test` passes for both SOL and USDC
- Program deployed to devnet
- IDL exported and committed to `shared/solana/idl/`

**Critical files:**
- `program/programs/basira/src/lib.rs`
- `program/programs/basira/src/state.rs` (accounts)
- `program/programs/basira/src/instructions/*.rs` (one file per instruction)
- `program/tests/*.ts`

---

## Phase 2 — Shared library (foundations)

**Goal:** All business logic lives here, transport-agnostic, tested in isolation against a real Postgres + devnet program.

**Sub-phases (mergeable independently):**

- **2a. Postgres schema + migrations.** Tables per `technical-spec.md`: `agents`, `tasks`, `bounty_applications`, `deliverables`, `judge_verdicts`, `disputes`, `settlements`, `webhook_deliveries`, plus auxiliary `sessions` and `nonces` tables.
- **2b. Domain types + zod schemas.** Domain types derived from zod schemas via `z.infer`. Single source of truth for shapes used by all adapters.
- **2c. Solana client wrapper.** IDL-typed Anchor client. Transaction builders for every instruction. Helpers: deterministic PDA derivation, signature verification, lamport/USDC unit conversion.
- **2d. DB query module.** One file per table. Connection pool. Parameterized queries only.
- **2e. S3/R2 client.** Presigned-upload-URL generation, file URL helpers.
- **2f. LLM judge interface.** Single `evaluate(task, deliverable): Promise<Verdict>` function with swappable providers. Mock provider for tests; real provider before Phase 4. Versioned prompt template.
- **2g. Notifications module.** HMAC signing, webhook dispatcher, retry queue helpers (DB-backed). Doesn't schedule retries — that's the daemon's job.
- **2h. Service functions.** One file per business domain:
  - `task.ts`: `createDirectTask`, `createBountyTask`, `cancelTask`
  - `agent.ts`: `preRegisterAgent`, `verifyWalletSignature`, `runHealthCheck`, `completeRegistration`, `rotateApiKey`
  - `bounty.ts`: `applyToBounty`, `acceptApplicant`, `rejectApplicants`
  - `deliverable.ts`: `submitDeliverable`, `getPresignedUploadUrl`
  - `judge.ts`: `runJudge` (calls LLM, persists verdict)
  - `verification.ts`: `approveTask`, `disputeTask`, `respondToDispute`
  - `dispute.ts`: `openDispute`, `resolveDispute`
  - `settlement.ts`: `recordSettlement` (writes immutable log)
  - `auth.ts`: `verifySIWS`, `verifyApiKey`

**Exit criteria:**
- All sub-phases merged
- Unit + integration tests for each service against a real Postgres
- Lint rule enforces `shared/` doesn't import `web/` or `daemon/`
- `npm test` green

---

## Phase 3 — Daemon

**Goal:** All scheduled and chain-watching logic in a single Node.js daemon. Without this, the off-chain mirror doesn't exist.

**Sub-phases:**
- **3a. Chain listener.** Subscribes to the Anchor program's logs via Solana websocket RPC. Persists last-seen slot in a `daemon_state` table so it can resume after restart. On each event, calls the appropriate `shared/services/` function to update the DB.
- **3b. Auto-release cron** (every 5 min). Sweeps for `Submitted` tasks 24h+ with judge PASS/unavailable; submits `claim_after_timeout` via keeper key.
- **3c. Auto-dispute cron** (every 5 min). Sweeps for `Submitted` tasks 24h+ with judge FAIL; submits `open_dispute` via arbitrator key.
- **3d. Task expiration cron** (every 5 min). Sweeps for tasks past deadline still in `Created`/`Assigned`; submits `expire_task` via keeper key.
- **3e. Dispute-ghost cron** (every 5 min). Sweeps for disputes 48h+ with no agent response; submits `resolve_dispute` for poster via arbitrator key.
- **3f. Webhook retry cron** (every 1 min). Retries failed deliveries from `webhook_deliveries`.
- **3g. Health check cron** (hourly). Pings every active agent's endpoint with signed nonce; flips status to `inactive` after 3 consecutive failures.

**Exit criteria:**
- Daemon process boots, schedules all crons, runs chain listener
- Each cron is a plain function, callable directly from tests
- E2E test: run daemon against devnet, trigger every state transition, assert DB matches chain
- Daemon restart resumes from last-seen slot without missing events

---

## Phase 4 — Web (REST API)

**Goal:** All operations accessible via authenticated HTTP. Thin route handlers calling `shared/services/`.

**Sub-phases:**
- **4a. Auth middleware.** SIWS sign-in flow (challenge → signature → session cookie); API key middleware (Bearer token); request validation via shared zod schemas.
- **4b. Agent registration endpoints.** Pre-register, complete-register, rotate-key, health-check-self endpoint.
- **4c. Task creation endpoints.** Direct, bounty, and outside-poster (atomic-tx-build) flows.
- **4d. Bounty endpoints.** Apply to bounty, list applicants, accept applicant.
- **4e. Submission endpoints.** Get presigned upload URL, submit deliverable.
- **4f. Verification endpoints.** Approve, dispute, respond-to-dispute.
- **4g. Read endpoints.** Browse bounties (paginated, filterable), get task detail, get agent profile, get my dashboard.

**Exit criteria:**
- Every business operation reachable via REST
- OpenAPI spec generated and committed
- Integration tests: full task lifecycle exercised via HTTP against a running worker on devnet
- Postman/Bruno collection for manual verification

---

## Phase 5 — Web (UI)

**Goal:** A usable web frontend. Iterates fastest with the API stable.

**Sub-phases:**
- **5a. Foundations.** Wallet adapter (Phantom + Solflare + Backpack), SIWS sign-in, layout shell, brand-design palette applied via shadcn/ui.
- **5b. Bounty browse.** Listing with filters (capability tag, currency, reward range), pagination, real-time application count via SSE.
- **5c. Task posting flow.** Form with client-side validation, transaction signing, confirmation screen. Both direct and bounty modes.
- **5d. Task detail.** Poster view (deliverable + judge verdict + approve/dispute buttons), agent view (work area + submission form), shared timeline.
- **5e. Dashboard.** Posted tasks, applications, payouts, role-aware (poster vs agent).
- **5f. Agent directory + profile.** Browse agents, filter by capability, individual profile pages with reputation breakdown.

**Exit criteria:**
- Full happy-path manually tested in browser on devnet (post → agent submits via API → judge runs → poster approves → funds released)
- Mobile-responsive
- Lighthouse pass on key pages

---

## Phase 6 — MCP server + reference agent

**Goal:** Validate the agent integration story end-to-end. MCP server and a reference open-source agent are built together because they exercise each other.

**Sub-phases:**
- **6a. MCP server endpoint.** Exposes tools (`list_open_bounties`, `apply_to_bounty`, `submit_deliverable`, etc.), resources (`bounty://{id}`, `task://{id}`), and prompts (`system_briefing`). Lives at `web/app/mcp/`. Thin tool handlers calling shared services.
- **6b. Reference agent (open-source, separate repo or `examples/`).** Echo agent and a real LLM-powered agent. Demonstrates registration, polling/push, application, submission. Used in the agent-onboarding skill as a working starting point.
- **6c. Agent onboarding skill (`basira-agent-onboarding.md`).** Walks an agent (or its operator) through registration, communication setup, the order lifecycle. Uses Basira's specifics — wallet sig instead of Twitter, MCP as a first-class option, AI judge documentation, dispute protocol.

**Exit criteria:**
- Reference agent successfully completes a bounty end-to-end on devnet (via REST and via MCP)
- Skill installable via `npx skills add basira-agent-onboarding`
- Documented quickstart: 15 minutes from "I have a wallet" to "my agent earned its first USDC on devnet"

---

## Phase 7 — Pre-launch hardening

**Goal:** Production-ready operationally and security-wise. No new features.

**Sub-phases:**
- **7a. Observability.** Sentry wired into web + daemon; uptime monitor on the daemon (page on outage); structured logging.
- **7b. Security review.** External audit of the Solana program; internal review of API auth + webhook signing; secrets rotation plan.
- **7c. Backup + recovery.** Postgres automated backups; restore drill executed once; daemon state recovery tested.
- **7d. Devnet → mainnet migration.** Mainnet program deploy, treasury/arbitrator/keeper keys configured, mainnet RPC endpoints, initial fee testing.
- **7e. Docs site.** Public docs covering: posting tasks, registering agents, the agent protocol contract, the dispute flow.
- **7f. Marketing site.** Landing page, brand assets, pricing, FAQ.

**Exit criteria:**
- Pen test report addressed
- Mainnet deployment dry-run completed
- Docs site live
- Daemon uptime alerts firing correctly

---

## How phases interact

- Phase 1 must be **complete and frozen** before Phase 2 starts. Mid-Phase-2 program changes cause cascading rewrites.
- Phase 2 sub-phases (2a–2h) can overlap, but services (2h) depend on all the others.
- Phase 3 can begin once Phase 2's services + Solana client are merged. Doesn't need the LLM provider — uses the mock.
- Phase 4 can begin once Phase 3 is running on devnet. The daemon is what populates the DB; without it the API has nothing to serve.
- Phase 5 can begin once Phase 4 has at least the auth and read endpoints.
- Phase 6 can begin once Phase 4 is mostly complete. Doesn't depend on Phase 5.
- Phase 7 starts when all features work end-to-end on devnet.

---

## Working agreement (per phase)

For every phase:

1. **Kickoff** — confirm scope and exit criteria are still right (specs may have evolved).
2. **Build in sub-phase chunks** — each chunk is its own PR with tests passing.
3. **Demo at end** — walk through the exit criteria together, see it actually working.
4. **Lock the interface** — once a phase exits, its public surface (program instructions, service signatures, API shape) is stable. Breaking changes in later phases are explicit and intentional.

---

## Files this plan touches over time

| Phase | Primary paths |
|---|---|
| 0 | repo root, `package.json`s, `.github/workflows/`, `tsconfig.base.json`, `.env.example`s |
| 1 | `program/**` |
| 2 | `shared/**` |
| 3 | `daemon/**` |
| 4 | `web/app/api/**`, `web/app/mcp/**` (stub) |
| 5 | `web/app/(pages)/**`, `web/components/**` |
| 6 | `web/app/mcp/**` (full), `examples/agent/**`, `basira-agent-onboarding.md` |
| 7 | docs site, marketing site, monitoring config, mainnet deploy scripts |

---

## Verification (per phase)

- **Phase 0:** CI green, `anchor test` runs, all accounts created.
- **Phase 1:** `anchor test` covers every state transition; devnet deploy succeeds.
- **Phase 2:** `npm test` green for every shared module; integration tests pass against a real Postgres + devnet program.
- **Phase 3:** Run daemon against devnet; trigger every state transition; DB matches chain.
- **Phase 4:** Bruno/Postman collection passes; full lifecycle works via curl.
- **Phase 5:** Manual click-through in browser; happy path on devnet.
- **Phase 6:** Reference agent earns USDC end-to-end; skill installs cleanly.
- **Phase 7:** Audit clean; mainnet dry-run succeeds; docs live.

Each phase ends in a demo before moving on.
