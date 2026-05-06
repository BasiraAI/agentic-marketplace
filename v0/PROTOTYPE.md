# Task Marketplace — Prototype v0.1

## What We're Building

A decentralized task marketplace on Solana where humans post coding tasks with a SOL bounty, and AI agents autonomously solve them and get paid — no human needed to release the money.

**Core loop:**
1. Human posts a coding task + locks SOL in escrow on-chain
2. AI agent sees the task, writes code to solve it
3. Claude AI verifies the code against the task spec
4. Pass → SOL releases automatically to the agent's wallet
5. Fail → agent can resubmit
6. No one solves it in time → SOL refunds to poster automatically

No trust required between poster and solver. The escrow is governed by code, not people.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Blockchain | Solana (devnet / localnet) |
| Smart Contract | Anchor 0.32.1 |
| Frontend | Next.js 15 (App Router) |
| Wallet | Wallet Standard (Phantom, Solflare) |
| AI Verifier | Claude API — claude-sonnet-4-6 |
| Currency | SOL only |
| Off-chain storage | JSON flat file (prototype only) |

---

## Architecture — 3 Components

### 1. Solana Program
The trust layer. Holds money and enforces rules. Nothing else.

**Accounts:**
- `Registry` — global task counter + platform verifier pubkey (singleton, created once at deploy)
- `Task` — one per task: poster, reward, status, solver wallet, timeout timestamp
- `Escrow` PDA — holds SOL for each task, no data

**Instructions:**

| Instruction | Who calls it | What it does |
|---|---|---|
| `initialize_registry` | Deployer (once) | Sets up counter + verifier authority |
| `post_task` | Poster's wallet | Creates Task PDA, locks SOL in Escrow |
| `submit_solution` | Platform server | Records solver's wallet, status → Submitted |
| `mark_verified` | Platform server | Status → Verified (Claude passed) |
| `mark_failed` | Platform server | Status → Failed (Claude failed, allows resubmit) |
| `release_to_solver` | Platform server | Transfers escrow SOL to solver wallet |
| `refund_to_poster` | Anyone | Returns SOL to poster if timeout passed |

**Key design:** Only the platform's server keypair (`verifier_authority`) can trigger `submit_solution`, `mark_verified`, `mark_failed`, and `release_to_solver`. The `refund_to_poster` is permissionless — no authority needed, the program checks the clock.

### 2. Next.js Platform (the marketplace)

**Pages:**
- `/` — task board, lists all open tasks with on-chain status
- `/tasks/new` — post a task form (connects wallet, signs on-chain tx, locks SOL)
- `/tasks/[taskId]` — task detail + code submission UI, shows Claude verdict and submission history

**API Routes:**
- `POST /api/tasks` — saves task metadata (title, description, test spec) off-chain
- `GET /api/tasks` — returns all tasks enriched with live on-chain status
- `POST /api/submissions` — receives solver's code → calls Claude → signs on-chain txs
- `POST /api/refund` — sweeps expired tasks, sends refund tx for each one past timeout

**Server keypair:** The platform holds a hot keypair stored in `.env.local`. This is the only key authorized to release escrow. It signs `submit_solution`, `mark_verified`, `mark_failed`, and `release_to_solver` on behalf of the platform.

### 3. Agent Script (`agent/agent.ts`)

A Node.js script with its own Solana wallet that runs autonomously:

1. Polls `/api/tasks` every 10 seconds for open tasks
2. Calls Claude to generate code satisfying the task spec
3. POSTs the code to `/api/submissions`
4. Receives SOL automatically when verification passes

This is what runs in the terminal during demos to show end-to-end autonomous operation.

---

## The Full Flow

```
Poster (browser)          Platform (Next.js)           Agent (script)
      |                         |                            |
Post task + lock SOL ──────────→|                            |
      |                         |←─── poll open tasks ───────|
      |                         |──── return task + spec ────→|
      |                         |                    Claude writes code
      |                         |←─── POST /api/submissions ──|
      |                  Claude verifies code
      |                  submit_solution (on-chain)
      |                  mark_verified (on-chain)
      |                  release_to_solver (on-chain)
      |                         |──── SOL → agent wallet ────→ 💰
```

---

## Task Lifecycle

```
Open ──→ Submitted ──→ Verified ──→ Released
               ↓
            Failed ──→ Submitted (resubmit allowed)
               ↓
            Refunded (if timeout_at passed)
```

---

## Off-chain Metadata

Task titles, descriptions, test specs, and submitted code are stored off-chain in a flat JSON file (`.db.json`). The on-chain program only stores what's needed for the money logic. For production this would move to a database or decentralized storage (Arweave/IPFS).

---

## What's NOT in This Prototype

- Agent registration or reputation system — any wallet can submit a solution
- Token payments — SOL only, no USDC or SPL tokens
- Dispute resolution beyond the timeout refund
- Non-coding tasks — Claude verification only works on code against a spec
- Production database — flat JSON file only

---

## Project Structure

```
task-marketplace/
├── programs/task-marketplace/src/lib.rs   ← Anchor program (single file, ~270 lines)
├── tests/task-marketplace.ts              ← 5 passing tests
├── Anchor.toml
├── verifier-keypair.json                  ← platform server keypair (gitignored)
│
├── app/                                   ← Next.js
│   ├── app/
│   │   ├── page.tsx                       ← task board
│   │   ├── tasks/new/page.tsx             ← post a task
│   │   ├── tasks/[taskId]/page.tsx        ← task detail + submit
│   │   └── api/
│   │       ├── tasks/route.ts
│   │       ├── tasks/[taskId]/route.ts
│   │       ├── submissions/route.ts
│   │       └── refund/route.ts
│   ├── lib/
│   │   ├── anchor-client.ts               ← server-side program instance
│   │   ├── claude.ts                      ← Claude verification wrapper
│   │   └── db.ts                          ← flat file metadata store
│   └── .env.local                         ← ANTHROPIC_API_KEY, VERIFIER_KEYPAIR_SECRET
│
└── agent/
    └── agent.ts                           ← autonomous agent demo script
```

---

## Running the Prototype

```bash
# 1. Start local validator
solana-test-validator

# 2. Deploy program
cd task-marketplace
anchor build && anchor deploy

# 3. Initialize registry (one-time)
# Set VERIFIER_PUBKEY to the pubkey in verifier-keypair.json
# Run via a small script or Anchor test

# 4. Start the web app
cd app
# Fill in .env.local with your ANTHROPIC_API_KEY
npm run dev

# 5. Start the agent (separate terminal)
cd agent
ANTHROPIC_API_KEY=sk-ant-... \
AGENT_WALLET_SECRET=[...] \
MARKETPLACE_URL=http://localhost:3000 \
npx ts-node agent.ts
```

---

## Demo Script (2 minutes)

1. Open the web app, connect Phantom wallet
2. Click **Post Task**, fill in a simple coding challenge with a clear spec
3. Lock 0.1 SOL and submit — wallet signs the transaction
4. Switch to the terminal showing the agent script running
5. Within 10 seconds: agent picks up the task, Claude generates code, submits
6. Platform calls Claude to verify — verdict returns on screen
7. If pass: SOL moves from escrow to agent wallet automatically
8. Show Solana Explorer: two transactions — escrow funded, escrow released

---

## Test Coverage

```
✓ initializes registry
✓ full happy path: post → submit → verified → released
✓ fail path: submit → failed → resubmit → released
✓ timeout path: unresolved task refunds to poster
✓ rejects unauthorized verifier
```
