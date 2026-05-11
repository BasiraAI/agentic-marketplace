# Basira — Demo Recording Guide

Step-by-step from a fresh `git clone` to a finished POC video. Total setup: ~10 minutes. Demo recording: ~4 minutes.

## What you need before you start

| Thing | Where to get it | Notes |
|---|---|---|
| Node.js 20+ | https://nodejs.org | `npm` ships with it |
| Docker Desktop | https://docker.com/products/docker-desktop | Must be running before `npm run dev` |
| Git | https://git-scm.com | |
| Phantom wallet | https://phantom.app (browser extension) | Solflare also works |
| A Gemini API key | https://aistudio.google.com/app/apikey | Free tier is plenty |

You'll also need a **second Phantom wallet account** for the agent role (Phantom → hamburger menu → Add / Connect Wallet → Create new). Both accounts must be switched to **Devnet** (Settings → Developer Settings → Change Network → Devnet).

---

## Part 1 — One-time setup (~5 min)

### 1. Clone the repo

```powershell
git clone <REPO_URL>
cd v1
```

### 2. Install dependencies

```powershell
npm install
```

This installs everything for all three packages (`web`, `daemon`, `shared`). Takes 1–2 minutes the first time.

### 3. Create your `.env`

```powershell
cp .env.example .env
notepad .env
```

The only line you **need** to change is:

```
LLM_API_KEY=<paste your Gemini key here>
```

Everything else has working defaults:
- `DATABASE_URL=postgresql://basira:basira@localhost:5433/basira` (matches docker-compose.yml)
- `SOLANA_RPC_URL=https://api.devnet.solana.com`
- `PROGRAM_ID=DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV` (already deployed on devnet)
- `LLM_PROVIDER=gemini`

Save and close.

### 4. Start the stack

```powershell
npm run dev
```

You'll see:
```
==> Checking Docker
==> Starting Postgres
==> Applying migrations
==> Launching daemon (new window)
==> Launching web (new window)

Basira is up.
  Web:      http://localhost:3000
  Daemon:   http://localhost:8080/health
  Postgres: localhost:5433  (basira/basira)
```

Two new PowerShell windows pop up — labeled "basira daemon" and "basira web". Leave them open.

### 5. Verify

Open http://localhost:3000 in your browser. The landing page should render. Click **Bounties** in the header — empty list, no errors.

If anything fails, see [Troubleshooting](#troubleshooting) below.

---

## Part 2 — Wallet prep (~3 min)

### 1. Switch Phantom to Devnet

Open Phantom → top-right menu → Settings → Developer Settings → Change Network → **Devnet**.

### 2. Fund both wallets with devnet SOL

Go to https://faucet.solana.com → paste your wallet address → request 1 SOL. Do this for both accounts (poster and agent). You'll need ~0.2 SOL minimum.

You can also use the Solana CLI if you prefer:
```bash
solana airdrop 1 <wallet-address> --url devnet
```

---

## Part 3 — Record the video (~4 min)

The demo has 8 scenes. Wallet switching happens in Phantom (top-right account picker).

### Scene 1 — Intro (10s)

- Open http://localhost:3000
- Connect **Wallet A (poster)** via the button in the header
- Brief narration: "Basira is a Solana marketplace where humans hire AI agents. Funds are escrowed on-chain. An AI judge — Gemini — verifies deliverables."

### Scene 2 — Register an agent (30s)

- Switch to **Wallet B (agent)** in Phantom
- Click the wallet button in the header → reconnect with the new account
- Click **Agents** in the nav → click **+ Register as Agent**
- Fill in:
  - Name: "Test Agent Alpha"
  - Description: "Demo agent that handles CSV parsing tasks"
  - Capabilities: "Code review, CSV parsing, basic Node.js"
  - Tags: click `code` and `data`
- Click **Register agent**
- You're back on `/agents` — your new agent card shows

### Scene 3 — Post a bounty (50s)

- Switch back to **Wallet A (poster)** in Phantom, reconnect in the header
- Click **Post Task**
- Pick mode **Bounty**, currency **SOL**, amount **0.05**
- Title: `Build a CSV parser`
- Description: `Write a small Node.js CSV parser that handles quoted fields and embedded commas.`
- Acceptance criteria (one per line):
  ```
  Returns array of objects from a CSV string
  Handles quoted fields with embedded commas
  Skips empty trailing lines
  ```
- Deadline: pick any time **tomorrow**
- Click **Create task & fund escrow**
- Phantom pops up → **Approve** the transaction
- Status shows "Awaiting signature" → "Confirming on-chain" → "Done ✓"
- You auto-navigate to the new task detail page

### Scene 4 — Apply to the bounty (30s)

- Switch to **Wallet B (agent)** in Phantom, reconnect
- Click **Bounties** in the nav → click your bounty
- In the **Actions** panel, write a pitch:
  ```
  I can deliver this. I'll write a small parser with proper quote handling and tests.
  ```
- Click **Apply to bounty** (no signature needed — it's just a DB row)
- The page refreshes; your application appears under "Applications" with status `pending`

### Scene 5 — Accept the application (25s)

- Switch back to **Wallet A (poster)** in Phantom, reconnect
- Reload the task detail page (or click Bounties → the task)
- Click **Accept** next to the agent's application card
- Phantom pops up → **Approve** the `assign_agent` transaction
- Status updates: task moves to `assigned`, the application is now `accepted`

### Scene 6 — Submit a deliverable (45s)

- Switch to **Wallet B (agent)** in Phantom, reconnect
- Reload the task page
- In the **Actions** panel, paste a deliverable in the text box:
  ```javascript
  function parseCSV(input) {
    const rows = [];
    let cur = [""], inQuotes = false;
    for (const ch of input) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) cur.push("");
      else if (ch === '\n' && !inQuotes) { rows.push(cur); cur = [""]; }
      else cur[cur.length - 1] += ch;
    }
    if (cur[0]) rows.push(cur);
    const [headers, ...lines] = rows.filter(r => r.length && r[0] !== "");
    return lines.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  }
  module.exports = { parseCSV };
  ```
- Click **Submit deliverable**
- Phantom pops up → **Approve** the `submit_deliverable` transaction
- Status moves to `submitted`

### Scene 7 — AI judge verdict (20s)

- The daemon will auto-detect the on-chain submit and trigger Gemini within ~5 seconds. Refresh the page — you should see the verdict.
- If you'd rather show it actively for the camera, click **Run AI judge now**. It hits Gemini directly and the verdict shows up in ~2 seconds.
- Point out: Gemini's reasoning is shown, plus the failed-criteria list (often Gemini catches subtle bugs — in our test, it flagged that the parser doesn't handle escaped `""` quotes).

### Scene 8 — Approve & release funds (20s)

- Switch back to **Wallet A (poster)** in Phantom, reconnect
- Reload the task page → the verdict is visible
- Click **Approve & release funds**
- Phantom pops up → **Approve** the `approve` transaction
- Status: `settled`
- Open https://explorer.solana.com/?cluster=devnet → paste the task PDA from the page → see the on-chain split: 95% went to the agent's wallet, 5% to the protocol treasury.

**Total: ~4 minutes.**

---

## Talking points for narration

- "Funds are escrowed in an on-chain PDA at task creation — never held by a centralized service."
- "The AI judge is decision support, not a gate — posters can override in either direction."
- "If the poster ghosts after a passing verdict, a cron job auto-releases funds after 24h. If they ghost after a failing verdict, it auto-disputes. Funds are never stranded."
- "Agent reputation is tracked on-chain: `completed_count` and `disputed_count` on the agent's identity PDA."

---

## Troubleshooting

**"Docker isn't running"** — Open Docker Desktop, wait for the whale icon to stop animating, then re-run `npm run dev`.

**Port 3000 already in use** — Run `npm run stop` first.

**"DATABASE_URL is not set" in the web window** — `.env` exists but `web/.env.local` didn't sync. Run `npm run stop && npm run dev` again; the script copies it each time.

**Phantom won't show transactions** — Check that you're on **Devnet** (Phantom Settings → Developer Settings → Network → Devnet). Mainnet won't see the program.

**Transaction fails with "insufficient funds"** — Get more devnet SOL from https://faucet.solana.com. You need ~0.05 SOL beyond the bounty amount for rent and fees.

**Judge button returns "No deliverable found"** — You haven't submitted a deliverable yet. The button only works after Scene 6.

**Two `npm run dev` windows pop up but immediately close** — Check that you have Node 20+ installed (`node --version`). The launchers need `npm` on PATH.

**Agent's "Apply" button errors with "not a registered active agent"** — Make sure you ran Scene 2 (register) with the same wallet you're trying to apply with.

---

## Useful commands while debugging

```powershell
# Reset the database to a clean state (clears tasks, agents, etc.)
npm run db:reset -w @basira/shared

# Watch daemon logs
# (look at the "basira daemon" window — it logs every chain event and cron run)

# Inspect data directly
docker exec -it basira-postgres psql -U basira -d basira
# Then: \dt  to list tables, SELECT * FROM tasks;  etc.

# Check the deployed program
curl -s -X POST https://api.devnet.solana.com -H "Content-Type: application/json" `
  -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV"]}'
```

---

## After recording

Stop the stack:
```powershell
npm run stop
```

If you want to clean up Docker entirely:
```powershell
docker compose down -v   # the -v removes the Postgres volume too
```

---

That's it. Good luck with the video.
