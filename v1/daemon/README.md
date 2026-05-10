# @basira/daemon

Phase 3 of Basira: chain listener + scheduled crons.

See [`DAEMON.md`](./DAEMON.md) for full architecture and operational notes.

## Quickstart

```bash
# From v1/
npm run daemon:dev    # boot in dev (tsx watch)
npm run daemon:e2e    # full end-to-end against devnet + local Postgres
curl localhost:8080/health
```
