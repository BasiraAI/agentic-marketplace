# @basira/shared — Phase 2 Reference

The shared library is the transport-agnostic core that both the Phase 3 daemon and Phase 4 web app import from. No HTTP servers, no cron loops, no UI live here — only typed schemas, a Postgres layer, Solana transaction builders, storage, LLM judging, webhook notifications, and business-logic services.

---

## Design principles

**bigint everywhere for on-chain amounts.** All SOL lamports and USDC base units are `bigint` in TypeScript and `numeric` in Postgres. `BN` (Anchor/bn.js) only appears at the exact Anchor IDL boundary — builders convert `bigint → BN` in, and account fetchers convert `BN → bigint` out. `number` is never used for on-chain amounts; USDC base units exceed `Number.MAX_SAFE_INTEGER` for non-trivial values.

**Two-phase DB↔chain.** Every chain-touching service writes a `pending` DB row and returns an unsigned `VersionedTransaction`. The Phase 3 chain listener observes the confirmed transaction and flips DB state. This avoids the `(db_committed, chain_failed)` split-brain. The one exception is `completeRegistration` — credential issuance must follow chain confirmation, so it completes inline by verifying the signed tx.

**Services never insert settlements.** `settlements` rows are written only by the chain listener (Phase 3) or, during the Phase 2 demo, by the demo script standing in for the listener. `recordSettlement` is idempotent on `tx_signature UNIQUE`.

**Builders never sign.** Every builder accepts `payer: PublicKey` and `recentBlockhash: string` and returns a `VersionedTransaction` with feePayer set. Signing happens in the caller (poster wallet in web/, keeper key in daemon/, test signers in tests).

**Schemas are the single source of truth.** All domain types are `z.infer<typeof schema>` — no hand-rolled types in `domain/`. `exactOptionalPropertyTypes: true` is enforced throughout; use `prop: T | null` for nullable DB columns, not `prop?: T`.

---

## Module map

```
src/
├── schemas/        Zod schemas (primitives, task, agent, bounty, deliverable,
│                   judge, dispute, webhook, settlement, auth)
├── domain/         Re-exports z.infer<T> types for every schema
├── db/             Kysely over pg.Pool — one file per table
│   ├── pool.ts     Singleton Pool from DATABASE_URL
│   ├── kysely.ts   Kysely<Database> instance
│   ├── types.ts    Database interface — exact SQL mirror
│   ├── agents.ts
│   ├── tasks.ts
│   ├── bounty-applications.ts
│   ├── deliverables.ts
│   ├── judge-verdicts.ts
│   ├── disputes.ts
│   ├── webhook-deliveries.ts
│   ├── settlements.ts
│   ├── sessions.ts
│   └── nonces.ts
├── solana/
│   ├── connection.ts   Cached Connection from SOLANA_RPC_URL
│   ├── program.ts      Read-only Program<Basira> for account fetches
│   ├── pdas.ts         agentPda, taskPda, vaultPda, taskIdFromUuid, uuidFromTaskId
│   ├── units.ts        solToLamports, lamportsToSol, usdcToBaseUnits, baseUnitsToUsdc
│   ├── constants.ts    Program constants mirroring constants.rs
│   ├── accounts.ts     fetchAgentAccount, fetchTaskAccount
│   ├── sig.ts          verifyEd25519Signature, buildSiwsMessage
│   └── builders/       One file per instruction group (18 instructions total)
├── storage/
│   ├── client.ts       S3Client from R2_* env; mock mode when R2_ENDPOINT absent
│   └── presigned.ts    getPresignedUploadUrl — presigned PUT, 50 MB cap, 15 min TTL
├── llm/
│   ├── types.ts        JudgeInput, Verdict, JudgeProvider interface
│   ├── prompt.ts       JUDGE_PROMPT_V1 constant + JUDGE_PROMPT_VERSION = "judge-v1"
│   ├── evaluate.ts     Top-level wrapper with retry (3 attempts, 1s/4s/16s backoff)
│   └── providers/
│       ├── mock.ts     Deterministic: "PASS_ME" → pass, "FAIL_ME" → fail
│       └── anthropic.ts  Stub: throws NotImplementedError ("Phase 3 implements this")
├── notifications/
│   ├── sign.ts         signWebhookBody (HMAC-SHA256), verifyWebhookSignature
│   ├── dispatch.ts     dispatchWebhook — POST to agent endpoint, 10 s timeout
│   ├── scheduler.ts    scheduleNextRetry — 1s/4s/16s, permanent failure after 3
│   └── types.ts
└── services/           One file per business domain
    ├── task.ts         createDirectTask, createBountyTask, cancelTask
    ├── agent.ts        preRegisterAgent, verifyWalletSignature, runHealthCheck,
    │                   completeRegistration, rotateApiKey
    ├── bounty.ts       applyToBounty, acceptApplicant, rejectApplicants
    ├── deliverable.ts  getPresignedUploadUrl, submitDeliverable
    ├── judge.ts        runJudge
    ├── verification.ts approveTask, disputeTask, respondToDispute
    ├── dispute.ts      openDisputeAuto, resolveDispute
    ├── settlement.ts   recordSettlement (listener-only writer)
    └── auth.ts         verifySIWS, verifyApiKey
```

---

## DB schema

11 tables in a single migration (`migrations/1700000000001_init.sql`).

Key design choices:
- All amounts are `numeric` (unbounded) — Postgres `bigint` is signed 63-bit, can't hold `u64::MAX`.
- All timestamps are `timestamptz`.
- `settlements.tx_signature TEXT UNIQUE` — idempotent inserts from the listener on restart-replay.
- `nonces.value UNIQUE` — single-use nonces; `consumeNonce` is atomic insert-if-not-seen, returns false on replay.
- `agents.api_key_hash UNIQUE WHERE api_key_hash IS NOT NULL` — partial index; pre-registered agents have no key yet.
- `webhook_deliveries(status, next_retry_at)` index — retry worker scans this.
- `tasks(status, submitted_at)` and `tasks(status, deadline)` — cron sweep indexes.
- `bounty_applications(task_id, agent_wallet) UNIQUE` — rejects duplicate applications at DB level.
- `webhook_secret` column has a SQL comment marking it sensitive; excluded from default-projection selects.

---

## Solana builders

Each builder returns `{ tx: VersionedTransaction, ...pdas }`. All 18 on-chain instructions are covered:

| Instruction | Builder |
|---|---|
| register_agent | buildRegisterAgentTx |
| create_task_sol / create_task_usdc | buildCreateTaskSolTx / buildCreateTaskUsdcTx |
| cancel_task_sol / cancel_task_usdc | buildCancelTaskSolTx / buildCancelTaskUsdcTx |
| assign_agent | buildAssignAgentTx |
| reject_assignment_sol / _usdc | buildRejectAssignmentSolTx / buildRejectAssignmentUsdcTx |
| submit_deliverable | buildSubmitDeliverableTx |
| approve_sol / approve_usdc | buildApproveSolTx / buildApproveUsdcTx |
| claim_after_timeout_sol / _usdc | buildClaimAfterTimeoutSolTx / buildClaimAfterTimeoutUsdcTx |
| open_dispute | buildOpenDisputeTx |
| resolve_dispute_sol / _usdc | buildResolveDisputeSolTx / buildResolveDisputeUsdcTx |
| expire_task_sol / _usdc | buildExpireTaskSolTx / buildExpireTaskUsdcTx |

**BN ESM gotcha.** `import { BN } from "@coral-xyz/anchor"` fails at runtime in Node ESM (named export not present). Use `import anchor from "@coral-xyz/anchor"; const { BN } = anchor;` for runtime construction. `import { type BN }` works fine for type annotations only.

**USDC ATA derivation.** Vault token accounts use `getAssociatedTokenAddressSync(usdcMint, vaultPda, true)` — the `true` flag allows off-curve (PDA) owners.

---

## LLM judge

The judge interface is locked at Phase 2. Only the mock provider is implemented; the Anthropic provider stub throws `NotImplementedError` and will be wired in Phase 3.

The prompt (`JUDGE_PROMPT_V1`) is a versioned TS constant — it travels with the deploy artifact, not a file read. A new prompt requires a new version ID; the old one is never mutated.

`evaluate()` retries 3 times (1 s / 4 s / 16 s backoff) then returns `verdict: "unavailable"` rather than throwing, so the calling service can record the unavailability and schedule a re-run.

The judge module is pure: input → verdict. It never touches the DB. `services/judge.ts` is the persistence layer.

---

## Webhook notifications

HMAC-SHA256 over `${timestamp}.${body}`. The verifier rejects timestamps older than 5 minutes. Both the signing and verification functions live in `notifications/sign.ts` so the same logic ships to the agent SDK.

Retry policy: 3 attempts (1 s / 4 s / 16 s). After the third failure the delivery is marked `permanently_failed`. The Phase 3 retry worker calls `claimReadyForRetry` → `dispatchWebhook` in a sweep; there is no loop in this library.

---

## Settlement row mapping

For downstream Phase 3 listener reference:

| On-chain instruction | Settlement rows |
|---|---|
| approve_sol / approve_usdc | `release` (to agent) + `fee` (to treasury) |
| claim_after_timeout_sol / _usdc | `release` (to agent) + `fee` (to treasury) |
| resolve_dispute_*_for_agent | `release` (to agent) + `fee` (to treasury) |
| cancel_task_sol / _usdc | `refund` (to poster) |
| reject_assignment_sol / _usdc | `refund` (to poster) |
| expire_task_sol / _usdc | `refund` (to poster) |
| resolve_dispute_*_for_poster | `refund` (to poster) |

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `SOLANA_RPC_URL` | no | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_CLUSTER` | no | `devnet` | `mainnet-beta` switches USDC mint |
| `R2_ENDPOINT` | no | — | S3/R2 endpoint; absent → mock storage |
| `R2_ACCESS_KEY_ID` | no | — | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | no | — | R2 credentials |
| `R2_BUCKET` | no | `basira-deliverables` | Bucket name |
| `LLM_PROVIDER` | no | `mock` | `mock` or `anthropic` |

---

## Testing strategy

- **Schemas** (`test/schemas.test.ts`): one valid + one invalid per schema; discriminated union edge cases.
- **DB** (`test/db.test.ts`): round-trip per table against Docker Compose Postgres; `consumeNonce` idempotency; `recordSettlement` idempotency.
- **Solana units** (`test/solana/units.test.ts`): pure conversion functions.
- **Solana PDAs** (`test/solana/pdas.test.ts`): PDA derivation round-trips.
- **Bankrun** (`test/solana.bankrun.test.ts`): loads `program/target/deploy/basira.so`; exercises register, create, cancel, assign, submit, approve via builders → sign → process → assert account state.
- **Storage** (`test/storage.test.ts`): mock-mode presigned URL generation; filename sanitization.
- **LLM** (`test/llm.test.ts`): mock provider determinism; retry exhaustion → `unavailable`.
- **Notifications** (`test/notifications.test.ts`): HMAC round-trip; live `http.createServer` dispatch; retry scheduling.
- **Services** (`test/services.test.ts`): happy path per service function; runs against bankrun + Postgres.

Run with: `DATABASE_URL=... npm run -w @basira/shared test`

---

## Demo harness

`scripts/demo-e2e.ts` runs 8 steps against devnet + local Postgres:

1. Reset DB (drop + re-migrate)
2. Load keypairs from `v1/keypairs/treasury.json` (poster) and `v1/keypairs/keeper.json` (agent)
3. Pre-register → verify wallet signature → register_agent on-chain → complete registration
4. Create direct SOL task → submit to devnet
5. Submit deliverable → submit to devnet
6. Run mock judge (PASS_ME → pass, confidence 1.0)
7. Approve task → submit to devnet + write 2 settlement rows
8. Print DB state + explorer links for each tx

The script is idempotent on the agent registration: if the agent PDA already exists on-chain (from a prior run), it skips the `register_agent` transaction and proceeds with the existing on-chain state.

Run with:
```bash
DATABASE_URL=postgresql://basira:basira@localhost:5432/basira \
SOLANA_RPC_URL=https://api.devnet.solana.com \
SOLANA_CLUSTER=devnet \
npm run -w @basira/shared demo:e2e
```

Settlements in the demo are written by the script directly as a stand-in for the Phase 3 chain listener. In production the listener observes `approve_sol` and writes the rows.

---

## Quickstart

```bash
cd v1
docker compose up -d postgres
cp .env.example .env       # set DATABASE_URL
npm install
npm run -w @basira/shared db:migrate
npm run -w @basira/shared test
npm run -w @basira/shared demo:e2e
```
