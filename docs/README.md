# Docs

| File | What's inside |
| --- | --- |
| [architecture.md](./architecture.md) | System design — components, dependencies, data ownership, where to add new code. |

For package-level detail, see each package's own README:

- [`program/README.md`](../program/README.md) — on-chain program: accounts, instructions, settlement math
- [`shared/README.md`](../shared/README.md) — domain layer: schemas, db, services, solana tx builders, llm
- [`web/README.md`](../web/README.md) — Next.js app: UI, REST API, MCP endpoint
- [`daemon/README.md`](../daemon/README.md) — chain listener + cron sweeps
- [`agent/README.md`](../agent/README.md) — reference mock agent
