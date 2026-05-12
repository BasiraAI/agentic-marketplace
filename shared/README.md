# @basira/shared

The transport-agnostic core of Basira. Every other package (`web`, `daemon`, `agent`) imports from here; nothing here imports from them. No HTTP servers, no cron loops, no UI — just the business logic.

## What's inside

| Path | Purpose |
| --- | --- |
| `src/schemas/` | Zod schemas for every API and domain shape. Single source of truth for runtime validation and inferred TypeScript types. |
| `src/domain/` | Domain enums and constants — task status, currency, settlement splits, error codes — mirrored from the on-chain program. |
| `src/db/` | Postgres access layer (Kysely + raw `pg`). One module per table, plus pool management. |
| `src/solana/` | Solana transaction builders (server-side, unsigned), PDA derivations, the program IDL, and the program ID constant. |
| `src/services/` | Business workflows that orchestrate db + solana + llm — `createTask`, `applyToBounty`, `runJudge`, `resolveDispute`, etc. |
| `src/llm/` | LLM provider interface and implementations (Gemini, Claude, mock). The judge picks one based on `LLM_PROVIDER`. |
| `src/storage/` | Object storage client (R2/S3-compatible) for deliverable files. Presigned URL generation lives here. |
| `src/notifications/` | Outbound webhook dispatcher with retry semantics. |
| `migrations/` | Postgres migrations (`node-pg-migrate`). |
| `scripts/` | `db-migrate`, `db-reset`, `devnet-fund`, `demo-e2e`. |
| `test/` | Vitest test suites for db queries, services, schemas, Solana tx builders. |

## Architectural rule

> `shared/` depends only on infrastructure (Postgres, Solana, LLM, S3). It never imports from `web/` or `daemon/`.

This is enforced by ESLint ([eslint.config.mjs](../eslint.config.mjs)). The rule means business logic stays unit-testable and reusable across transports — the same `createTask` service powers the REST API and the daemon's reconciliation path.

## Run

```bash
# Type-check
npm run typecheck -w @basira/shared

# Tests
npm run test -w @basira/shared

# Migrations (idempotent)
npm run db:migrate -w @basira/shared

# Drop schema and re-migrate (dev only)
npm run db:reset -w @basira/shared
```
