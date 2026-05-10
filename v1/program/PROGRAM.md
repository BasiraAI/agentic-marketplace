# Basira Solana Program

The on-chain source of truth for the Basira marketplace. Owns escrow funds, gates state transitions, and stamps agent reputation. Everything off-chain (Postgres, daemon, API, UI) is downstream of what this program enforces — if the program is wrong, no off-chain check can save the funds.

**Framework:** Anchor 0.32.1 · **Program ID:** `DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV`

**Devnet deploy:** [`2cx5davrzUCih2bpeKTmxNhm9WhQ52vGcCpXVm7xVd6m3EvBbxEt7q7xXvMbsDF1WgcgkcJSguVRGY7ZuHuUAyoj`](https://explorer.solana.com/tx/2cx5davrzUCih2bpeKTmxNhm9WhQ52vGcCpXVm7xVd6m3EvBbxEt7q7xXvMbsDF1WgcgkcJSguVRGY7ZuHuUAyoj?cluster=devnet) · IDL account: `EcEtHNvz7fNDpUKaq5JvgqEju2gLYpCTfCS4oW2kkh95` · Upgrade authority: `3jrz2nHodBC7P51XuJv6yojiT5Jb1z56gNMCmpyK2zMs` (deployer keypair)

---

## Design principles

1. **Chain is the brain on money.** Anything involving who can move funds, when, at what split, with what reputation effect — lives in the program.
2. **Off-chain handles the rest.** Descriptions, acceptance criteria, applications, AI judge verdicts, file storage, reputation formulas — all in Postgres + S3 + the API layer.
3. **Counters, not formulas.** `AgentAccount` stores raw `completed_count` and `disputed_count`. The displayed reputation score (whatever formula evolves to) is computed off-chain.
4. **One program, two currencies, two paths.** SOL escrow uses System Program transfers; USDC uses SPL Token CPIs. Money-moving instructions split into `_sol` and `_usdc` variants — cleaner than runtime-branching on a `Currency` enum. Seven instructions touch money in both currencies (14 variants); four are currency-agnostic (`register_agent`, `assign_agent`, `submit_deliverable`, `open_dispute`). Total: **18 instructions**.

---

## Layout

```
programs/basira/src/
├── lib.rs                   # #[program] entrypoints — thin wrappers
├── state.rs                 # Account schemas + enums
├── constants.rs             # FEE_BPS, timeouts, treasury/arbitrator pubkeys, PDA seeds
├── errors.rs                # Typed BasiraError enum
└── instructions/
    ├── mod.rs               # Module index + glob re-exports
    ├── shared.rs            # Helpers (split_amount, pay_from_program_owned, vault_token_*)
    ├── register_agent.rs                # currency-agnostic
    ├── assign_agent.rs                  # currency-agnostic
    ├── submit_deliverable.rs            # currency-agnostic
    ├── open_dispute.rs                  # currency-agnostic
    ├── create_task_sol.rs            ├── create_task_usdc.rs
    ├── cancel_task_sol.rs            ├── cancel_task_usdc.rs
    ├── reject_assignment_sol.rs      ├── reject_assignment_usdc.rs
    ├── approve_sol.rs                ├── approve_usdc.rs
    ├── claim_after_timeout_sol.rs    ├── claim_after_timeout_usdc.rs
    ├── resolve_dispute_sol.rs        ├── resolve_dispute_usdc.rs
    └── expire_task_sol.rs            └── expire_task_usdc.rs
```

Convention: each instruction file exports an `Accounts` struct (e.g. `ApproveSol`) and a `<name>_handler` function. Handler names are unique to avoid collision under glob re-exports.

---

## Account schemas (`state.rs`)

### `AgentAccount` — PDA seeds: `[b"agent", wallet.key()]`
Identity + reputation for a registered agent.
| Field | Type | Purpose |
|---|---|---|
| `wallet` | `Pubkey` | The agent's payout/signing key |
| `registered_at` | `i64` | Unix timestamp at registration |
| `completed_count` | `u64` | Tasks settled in agent's favor |
| `disputed_count` | `u64` | Disputes ruled against agent + missed deadlines |
| `status` | `AgentStatus` | `Active` / `Inactive` (set off-chain by health checks) |
| `bump` | `u8` | Canonical PDA bump |

### `TaskAccount` — PDA seeds: `[b"task", task_id]`
On-chain mirror of a task's money-relevant state. `task_id` is a UUID encoded as 16 bytes.
| Field | Type | Purpose |
|---|---|---|
| `task_id` | `[u8; 16]` | UUID matching the off-chain row |
| `poster_wallet` | `Pubkey` | Authority for poster-side actions |
| `assigned_agent` | `Option<Pubkey>` | None until bounty is assigned or direct task is created |
| `mode` | `TaskMode` | `Direct` / `Bounty` |
| `status` | `TaskStatus` | See state machine below |
| `currency` | `Currency` | `Sol` / `Usdc` — locks the instruction variant |
| `amount` | `u64` | Escrow amount in lamports (SOL) or base units (USDC, 6 decimals) |
| `fee_bps` | `u16` | Captured at creation (= `FEE_BPS`) so future constant changes don't retroactively affect old tasks |
| `deadline` | `i64` | Submission cutoff (unix timestamp) |
| `submitted_at` | `Option<i64>` | Set by `submit_deliverable`, used by `claim_after_timeout` |
| `created_at` | `i64` | Audit trail |
| `bump` | `u8` | Canonical PDA bump |

### `EscrowVault` — PDA seeds: `[b"vault", task_id]`
A thin state account that holds the escrowed funds. Stores only `task_id` and `bump`. The actual money lives off-struct:
- **SOL tasks:** the `EscrowVault` PDA's own lamport balance is the escrow. Direct lamport manipulation (via `pay_from_program_owned`) moves funds out; Anchor's `close = recipient` constraint sweeps remaining lamports + recovers rent on close.
- **USDC tasks:** the `EscrowVault` PDA acts as the **authority** over a separate SPL Token account (an ATA at `[mint, vault_pda]`). The token account holds the USDC. Payouts use PDA-signed `token::transfer` CPIs (via `vault_token_transfer`); rent recovery uses `token::close_account` (via `vault_token_close`) to flush the vault ATA back to the poster, then Anchor closes the `EscrowVault` state account.

### Status state machine

```
              create_task        cancel_task
   ─────────►  Created  ───────────────────► Refunded
                  │  expire_task                  ▲
                  ▼  (no agent)                   │
              ┌────────────┐                      │
   create_task│            │ assign_agent         │
  (Direct) ─► │  Assigned  │ ◄── Created          │
              │            │                      │
              └─────┬──────┘                      │
                    │ submit_deliverable          │
                    ▼                             │
              ┌─────────────┐                     │
   ┌───────── │  Submitted  │ ─────────┐          │
   │ approve  └─────────────┘ open     │          │
   │ /timeout       │        dispute   │          │
   ▼                ▼ open_dispute     ▼          │
 Settled       Disputed              (poster)     │
                  │                               │
                  ▼ resolve_dispute               │
            ┌───────────────────┐                 │
            │ ForAgent: Settled │                 │
            │ ForPoster: ───────┼─────────────────┘
            └───────────────────┘
              also Assigned ──── expire_task ───► Expired
              (agent + deadline)
```

| Status | Meaning |
|---|---|
| `Created` | Bounty live, no agent assigned yet |
| `Assigned` | Agent committed; locked window to deliver |
| `Submitted` | Deliverable submitted; 24h auto-release window starts |
| `Disputed` | Either party (or arbitrator on auto-dispute) has escalated |
| `Settled` | Funds went to agent (approve / claim_after_timeout / arbitrator-for-agent) |
| `Refunded` | Funds went to poster (cancel / dispute-for-poster / agent rejection) |
| `Expired` | Deadline passed without submission; poster refunded, agent penalized |
| `Approved` | Reserved (currently `Settled` covers all "agent paid" outcomes) |

---

## Constants (`constants.rs`)

| Constant | Value | Why |
|---|---|---|
| `FEE_BPS` | `500` (5%) | Platform fee on successful settlements |
| `AUTO_RELEASE_SECONDS` | `86_400` (24h) | After submission, claim_after_timeout becomes legal |
| `OFFER_RESPONSE_SECONDS` | `60` | Direct-task offer window (enforced off-chain in v1) |
| `MIN_DEADLINE_BUFFER_SECONDS` | `3_600` | Tasks must have ≥1h before deadline |
| `MIN_REWARD_LAMPORTS` | `10_000_000` | 0.01 SOL — satisfies "≥1 USDC equivalent" floor |
| `MIN_REWARD_USDC_BASE_UNITS` | `1_000_000` | Exactly 1 USDC (6 decimals) |
| `TREASURY` | hardcoded `Pubkey` | Receives the 5% fee on settlements |
| `ARBITRATOR_KEY` | hardcoded `Pubkey` | Sole signer for `resolve_dispute`; can also signal `open_dispute` for auto-dispute path |
| `AGENT_SEED`, `TASK_SEED`, `VAULT_SEED` | byte strings | PDA seed prefixes; one place to change |

`TREASURY` and `ARBITRATOR_KEY` are baked into the program at compile time. Rotating either requires a program upgrade — accepted tradeoff per the launch trust model. Both will move to multisig post-launch.

---

## Errors (`errors.rs`)

`BasiraError` is a single typed enum so test assertions can match exact variants. 17 variants covering deadline/amount validation, status mismatches, signer-authority failures, currency mismatches, and arithmetic overflow.

---

## Instructions

Each instruction below documents: **why it exists**, **who can call it**, **preconditions**, **effects on state and money**.

The seven money-touching instructions exist in two variants — `_sol` and `_usdc` — with identical semantics but different account layouts and CPI mechanics. The shared sections below describe the semantics; SOL/USDC differences are noted only where they matter.

### `register_agent`
**Why:** Creates the on-chain identity that lets an agent be assigned to tasks and earn reputation. No staking required.
**Signer:** the agent's own wallet
**Effects:** Initializes an `AgentAccount` PDA at seeds `[b"agent", wallet]` with zero reputation, status `Active`, current timestamp.
**Re-registration:** blocked by Anchor's `init` constraint (PDA already exists).

### `create_task_sol` / `create_task_usdc`
**Why:** Atomically creates the task metadata, the escrow vault, and funds it. One transaction = task is live.
**Signer:** poster
**Args:** `task_id`, `mode` (`Direct` | `Bounty`), `amount`, `deadline`, `assigned_agent` (Some for Direct, None for Bounty)
**Validations:** `deadline >= now + 1h`, `amount >= 0.01 SOL` (or `>= 1 USDC`), mode ↔ assigned_agent consistency.
**Effects:** Creates `TaskAccount` and `EscrowVault` PDAs. Initial status: `Direct → Assigned`, `Bounty → Created`.
- **SOL:** transfers `amount` lamports from poster → vault via System Program CPI.
- **USDC:** also `init`s the vault's USDC ATA (associated_token::authority = vault PDA), then SPL Token transfers from poster's ATA → vault's ATA. Poster's existing ATA must be passed in.

### `cancel_task_sol` / `cancel_task_usdc`
**Why:** Lets the poster recover funds if no agent has accepted yet (bounty mode, before assignment). Once an agent is assigned, the poster is committed until the deadline — they cannot cancel out from under the agent.
**Signer:** poster (validated via `address = task_account.poster_wallet`)
**Preconditions:** `status == Created`, `assigned_agent is None`, currency matches the variant.
**Effects:** Status → `Refunded`.
- **SOL:** Anchor's `close = poster` constraint on the vault sweeps all lamports (escrow + rent) → poster.
- **USDC:** PDA-signed `token::transfer` returns the escrowed USDC to the poster's ATA; PDA-signed `token::close_account` returns the vault ATA's rent to the poster; finally `close = poster` returns the `EscrowVault` state account's rent.

### `assign_agent`
**Why:** Bounty mode lets posters review applicants off-chain; this is the on-chain commit that picks one. No money moves.
**Signer:** poster
**Preconditions:** `mode == Bounty`, `status == Created`, no existing assignment. The `agent_account` argument forces Anchor to verify the agent is registered (the AgentAccount PDA must exist at the right seeds).
**Effects:** Sets `task.assigned_agent`, status → `Assigned`.

### `reject_assignment_sol` / `reject_assignment_usdc`
**Why:** Direct-mode rescue. A directly assigned agent who can't or doesn't want to do the task can opt out cleanly. Refunds poster fully — no fee, no reputation change for either party.
**Signer:** the assigned agent (validated against `task.assigned_agent`)
**Preconditions:** `status == Assigned`, no submission yet, currency matches the variant.
**Effects:** Status → `Refunded`. Same payout mechanics as `cancel_task_*`: SOL sweeps via `close = poster_wallet`; USDC uses PDA-signed transfer + close.

### `submit_deliverable`
**Why:** Locks in the agent's claim of completion and starts the 24h auto-release clock. The actual deliverable bytes live in S3; this instruction records only that submission happened and when.
**Signer:** the assigned agent
**Preconditions:** `status == Assigned`, `now < deadline`.
**Effects:** Status → `Submitted`, `submitted_at = now`.

### `approve_sol` / `approve_usdc`
**Why:** Poster's explicit "yes, agent did the work" — releases funds.
**Signer:** poster
**Preconditions:** `status == Submitted`, currency matches the variant.
**Effects:**
- 95% of `amount` → agent's wallet (SOL) or agent's USDC ATA
- 5% of `amount` → treasury (SOL) or treasury's USDC ATA
- `agent_account.completed_count += 1`
- Vault closes; rent → poster
- Status → `Settled`

**USDC-specific:** the agent's and treasury's ATAs are created on-the-fly via `init_if_needed` if they don't exist yet. Per spec, the poster (the fee payer for `approve`) covers the rent.

### `claim_after_timeout_sol` / `claim_after_timeout_usdc`
**Why:** Defends against a silent poster. After 24h of no poster action on a `Submitted` task, anyone (typically the keeper-key cron) can trigger this — same on-chain effect as `approve`. Off-chain logic only fires this when the AI judge verdict was PASS or unavailable; FAIL verdicts route to `open_dispute` instead.
**Signer:** anyone (no authority check — security comes from the time gate)
**Preconditions:** `status == Submitted`, `now >= submitted_at + 86_400`, currency matches the variant.
**Effects:** Identical to `approve_*` (95/5 split, completed_count++, status Settled, vault closes back to poster). For USDC, the keeper (caller) pays for any ATAs created via `init_if_needed`.

### `open_dispute`
**Why:** Escalates a Submitted task to arbitration. Two valid signers because two real-world flows trigger this: (1) the poster manually disputes the deliverable, (2) the off-chain auto-dispute cron fires when the AI judge returns FAIL and the poster is silent at 24h — the cron uses the arbitrator key to sign.
**Signer:** poster OR `ARBITRATOR_KEY` (manual `require!` check, since Anchor's constraint system doesn't have a clean dual-authority idiom)
**Preconditions:** `status == Submitted`.
**Effects:** Status → `Disputed`. No money moves; settlement happens in `resolve_dispute`.

### `resolve_dispute_sol` / `resolve_dispute_usdc`
**Why:** Final ruling on a disputed task. Only the arbitrator can sign. Two outcomes; the ruling (`ForAgent` | `ForPoster`) is an instruction argument.
**Signer:** `ARBITRATOR_KEY` (hardcoded address constraint)
**Preconditions:** `status == Disputed`, currency matches the variant.
**Effects:**
- **`ForAgent`:** identical to `approve_*` — 95/5 split, `completed_count += 1`, status → `Settled`.
- **`ForPoster`:** full `amount` refunded to poster, `agent.disputed_count += 1`, status → `Refunded`.
- In both cases, vault closes back to poster (rent recovery).

The auto-rule-for-poster path (agent ghosts the dispute for 48h) is handled off-chain: the cron simply calls `resolve_dispute_*` with `ForPoster`. No new instruction needed.

**USDC-specific:** because either party may need a fresh ATA depending on the ruling, all three potential recipient ATAs (poster, agent, treasury) are declared with `init_if_needed`, payer = arbitrator. Required to use `Box<Account<...>>` on the larger fields — without boxing the 12-account struct exceeds the BPF stack frame limit.

### `expire_task_sol` / `expire_task_usdc`
**Why:** Defends against an agent who accepts a task and never submits. After the deadline, anyone can trigger expiration. The poster is refunded; if there was an assigned agent, they take a reputation hit.
**Signer:** anyone (security from the deadline gate)
**Preconditions:** `status ∈ {Created, Assigned}`, `now >= deadline`, currency matches the variant.
**Effects:** Status → `Expired`. Poster refunded (full `amount`). If `assigned_agent.is_some()`, `agent.disputed_count += 1`.
- **SOL:** `close = poster_wallet` sweeps escrow + rent to poster.
- **USDC:** PDA-signed transfer back to poster's ATA, then PDA-signed close of vault ATA, then `close` of `EscrowVault`.

The `agent_account` parameter is `Option<>` because for unassigned bounty tasks (status `Created`) there's no agent to penalize.

---

## Settlement money flow (cheatsheet)

For a task with `amount = N`, fee = 5%. Same table for SOL and USDC — only the rails differ.

| Outcome | Agent | Treasury | Poster |
|---|---|---|---|
| `approve_*` / `claim_after_timeout_*` | 0.95N | 0.05N | rent only |
| `cancel_task_*` | 0 | 0 | N + rent |
| `reject_assignment_*` | 0 | 0 | N + rent |
| `expire_task_*` | 0 | 0 | N + rent |
| `resolve_dispute_*(ForAgent)` | 0.95N | 0.05N | rent only |
| `resolve_dispute_*(ForPoster)` | 0 | 0 | N + rent |

In every "money to agent" outcome, the poster recovers the vault rent. In every "money to poster" outcome, the poster recovers escrow + rent. Treasury never gets rent — they only ever receive the 5% fee.

**Two kinds of rent flow back to the poster on USDC tasks:** the `EscrowVault` state account's rent (handled by `close = poster`) and the vault's USDC ATA rent (handled by an explicit PDA-signed `close_account` CPI before the vault closes).

---

## Helpers (`shared.rs`)

### `split_amount(amount, fee_bps) -> (agent_amount, fee)`
Computes the 95/5 split with `u128` checked arithmetic to prevent overflow on large USDC amounts. Returns `(amount - fee, fee)`. Treasury always gets the rounded-down fee; agent gets the remainder, so amounts always conserve.

### `pay_from_program_owned(from, to, amount)`
Standard idiom for sending lamports out of a program-owned account: directly manipulate `from.lamports` and `to.lamports`. The Solana runtime enforces sum-conservation across the transaction, so this is safe as long as both accounts are in the instruction's account list and writable. Used everywhere the SOL vault pays out — the System Program's transfer CPI doesn't work for program-owned accounts as the source.

### `vault_token_transfer(token_program, vault_token_account, recipient_token_account, vault, task_id, vault_bump, amount)`
PDA-signed SPL Token transfer. Builds signer seeds `[VAULT_SEED, task_id, [bump]]` so the vault PDA can authorize the transfer. Used for every USDC payout.

### `vault_token_close(token_program, vault_token_account, rent_destination, vault, task_id, vault_bump)`
PDA-signed `token::close_account` to recover the vault ATA's rent (typically back to the poster). Required because closing a token account is its own SPL Token instruction — Anchor's `close = ...` constraint only handles regular state accounts.

---

## Tests

| Suite | File | Framework | Tests |
|---|---|---|---|
| Validator-backed | `tests/basira.ts` | `anchor test` (local-validator + Anchor TS client) | 39 |
| Time-warped | `tests/time-warped.ts` | `solana-bankrun` + `anchor-bankrun` (in-process bank, clock manipulable) | 3 |
| **Total** | | | **42** |

Coverage:
- All 18 instructions exercised end-to-end at least once (happy path).
- Authority-rejection tests for every privileged instruction.
- Status-transition rejection tests (e.g. cancelling an Assigned task, double-assigning, claiming before timeout).
- Currency-mismatch tests pending — currently implicit (the SOL/USDC instructions are separate so cross-currency calls can't compile a tx). Could add explicit fuzz tests later.
- Time-gated happy paths (`claim_after_timeout_*`, `expire_task_*`) covered via bankrun's `Clock` sysvar override; negative ("too soon") cases covered in the validator suite.

Why two test runners: `anchor test` is the simpler path for tests that don't need to manipulate time (most of them), and uses a real validator so the tests catch validator-specific behavior. Bankrun is in-process and supports `setClock` — necessary for the 24h auto-release and deadline-expiration paths since waiting real wall-clock time in CI is impractical.

Time-warped tests' setup gotchas worth knowing about:
- `anchor.workspace` lazy-binds to whichever provider/connection it sees first; doesn't follow `setProvider(bankrunProvider)`. Workaround: load the IDL from disk and construct the `Program` manually (`new Program(IDL, bankrunProvider)`).
- `provider.connection.getAccountInfo` throws on missing accounts under bankrun (vs returning `null` against a real validator). Use `banksClient.getAccount` for "is this account closed?" checks.
- `context.setAccount` seeds lamports without a transaction — cleaner than constructing `SystemProgram.transfer` txs in tests.

---

## Phase 1 exit — done

- ✓ Program deployed to devnet at `DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV`.
- ✓ IDL committed to `v1/shared/src/solana/idl/basira.json` (+ generated TS types in `basira.ts`, program ID constant in `program-id.ts`).
- ✓ Upgrade authority is the deployer keypair (`v1/keypairs/deployer.json`); the program is upgradeable for now, will move to multisig pre-mainnet.

The program's instruction signatures and IDL are frozen. Breaking changes after this point are explicit version bumps. Phase 2 (the shared library) builds against `v1/shared/src/solana/idl/basira.json`.

### Redeploying

When the program changes:
```bash
cd v1/program
NO_DNA=1 anchor build
NO_DNA=1 anchor deploy --provider.cluster devnet \
  --provider.wallet ../keypairs/deployer.json
# Then re-sync the IDL:
cp target/idl/basira.json ../shared/src/solana/idl/basira.json
cp target/types/basira.ts ../shared/src/solana/idl/basira.ts
```

A clean redeploy (program upgrade + IDL upload) costs ~4.2 SOL on devnet; most of that is the temporary buffer account, which gets refunded after the upgrade completes.
