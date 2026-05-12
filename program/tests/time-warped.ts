// Bankrun-based tests for time-gated paths that anchor test cannot exercise:
// - claim_after_timeout_* (needs now >= submitted_at + 24h)
// - expire_task_* (needs now >= deadline, deadline >= now+1h enforced at creation)

import * as anchor from "@coral-xyz/anchor";
import { Program, BN, Idl } from "@coral-xyz/anchor";
import { Basira } from "../target/types/basira";
import { startAnchor, BanksClient, ProgramTestContext, Clock } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

const IDL = JSON.parse(
  readFileSync(resolve(__dirname, "..", "target", "idl", "basira.json"), "utf8"),
) as Idl;

const TASK_SEED = Buffer.from("task");
const VAULT_SEED = Buffer.from("vault");
const AGENT_SEED = Buffer.from("agent");

const HOUR = 3600;
const DAY = 86_400;
const MIN_REWARD_LAMPORTS = 10_000_000;

const KEYPAIRS_DIR = resolve(__dirname, "..", "..", "keypairs");

function loadKeypair(name: string): Keypair {
  const bytes = JSON.parse(readFileSync(resolve(KEYPAIRS_DIR, name), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

const TREASURY_KP = loadKeypair("treasury.json");
const ARBITRATOR_KP = loadKeypair("arbitrator.json");
const KEEPER_KP = loadKeypair("keeper.json");

function freshTaskId(): number[] {
  return Array.from(randomBytes(16));
}

function pdaTask(programId: PublicKey, taskId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TASK_SEED, Buffer.from(taskId)],
    programId,
  );
}

function pdaVault(programId: PublicKey, taskId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(taskId)],
    programId,
  );
}

describe("basira (bankrun, time-warped)", () => {
  let context: ProgramTestContext;
  let banksClient: BanksClient;
  let provider: BankrunProvider;
  let program: Program<Basira>;

  before(async () => {
    // startAnchor reads ./Anchor.toml + ./target/deploy and loads the program.
    context = await startAnchor(
      ".",
      [],
      [
        // Pre-fund our keepers/treasury/arbitrator so they can sign.
        {
          address: TREASURY_KP.publicKey,
          info: {
            lamports: 5 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: ARBITRATOR_KP.publicKey,
          info: {
            lamports: 5 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: KEEPER_KP.publicKey,
          info: {
            lamports: 5 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
      ],
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    program = new Program(IDL, provider) as unknown as Program<Basira>;
  });

  function fund(pubkey: PublicKey, lamports = 5 * LAMPORTS_PER_SOL) {
    // Use bankrun's setAccount to directly seed lamports — no transaction
    // needed, bypasses any blockhash/fee subtleties.
    context.setAccount(pubkey, {
      lamports,
      data: Buffer.alloc(0),
      owner: anchor.web3.SystemProgram.programId,
      executable: false,
      rentEpoch: 0,
    });
  }

  async function advanceClockBy(seconds: number) {
    const current = await banksClient.getClock();
    const newClock = new Clock(
      current.slot + 1n,
      current.epochStartTimestamp,
      current.epoch,
      current.leaderScheduleEpoch,
      current.unixTimestamp + BigInt(seconds),
    );
    context.setClock(newClock);
  }

  async function nowOnChain(): Promise<number> {
    const c = await banksClient.getClock();
    return Number(c.unixTimestamp);
  }

  async function setupSubmittedDirect() {
    const poster = Keypair.generate();
    const agent = Keypair.generate();
    await fund(poster.publicKey);
    await fund(agent.publicKey);

    await program.methods
      .registerAgent()
      .accounts({ wallet: agent.publicKey })
      .signers([agent])
      .rpc();

    const taskId = freshTaskId();
    const now = await nowOnChain();
    const deadline = new BN(now + 2 * HOUR);

    await program.methods
      .createTaskSol(
        taskId,
        { direct: {} },
        new BN(MIN_REWARD_LAMPORTS),
        deadline,
        agent.publicKey,
      )
      .accounts({ poster: poster.publicKey })
      .signers([poster])
      .rpc();

    const [taskPda] = pdaTask(program.programId, taskId);
    const [vaultPda] = pdaVault(program.programId, taskId);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [AGENT_SEED, agent.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .submitDeliverable()
      .accounts({ agent: agent.publicKey, taskAccount: taskPda })
      .signers([agent])
      .rpc();

    return { poster, agent, taskId, taskPda, vaultPda, agentPda, deadline };
  }

  async function balance(pubkey: PublicKey): Promise<number> {
    return Number(await banksClient.getBalance(pubkey));
  }

  describe("claim_after_timeout_sol (time-warped happy path)", () => {
    it("succeeds after warping clock 24h+ past submitted_at", async () => {
      const { poster, agent, taskPda, vaultPda, agentPda } =
        await setupSubmittedDirect();

      // Warp 24h + 1 minute past submission.
      await advanceClockBy(DAY + 60);

      const agentBefore = await balance(agent.publicKey);
      const treasuryBefore = await balance(TREASURY_KP.publicKey);

      await program.methods
        .claimAfterTimeoutSol()
        .accounts({
          caller: KEEPER_KP.publicKey,
          taskAccount: taskPda,
          vault: vaultPda,
          posterWallet: poster.publicKey,
          agentWallet: agent.publicKey,
          agentAccount: agentPda,
          treasury: TREASURY_KP.publicKey,
        })
        .signers([KEEPER_KP])
        .rpc();

      const expectedFee = Math.floor((MIN_REWARD_LAMPORTS * 500) / 10_000);
      const expectedAgent = MIN_REWARD_LAMPORTS - expectedFee;

      const agentAfter = await balance(agent.publicKey);
      const treasuryAfter = await balance(TREASURY_KP.publicKey);

      assert.strictEqual(agentAfter - agentBefore, expectedAgent);
      assert.strictEqual(treasuryAfter - treasuryBefore, expectedFee);

      const task = await program.account.taskAccount.fetch(taskPda);
      assert.deepStrictEqual(task.status, { settled: {} });

      const agentAccount = await program.account.agentAccount.fetch(agentPda);
      assert.strictEqual(agentAccount.completedCount.toNumber(), 1);

      const vaultInfo = await banksClient.getAccount(vaultPda);
      assert.isNull(vaultInfo, "vault should be closed");
    });
  });

  describe("expire_task_sol (time-warped happy path)", () => {
    it("expires Assigned task past deadline, agent disputed_count++", async () => {
      const poster = Keypair.generate();
      const agent = Keypair.generate();
      await fund(poster.publicKey);
      await fund(agent.publicKey);

      await program.methods
        .registerAgent()
        .accounts({ wallet: agent.publicKey })
        .signers([agent])
        .rpc();

      const taskId = freshTaskId();
      const now = await nowOnChain();
      const deadline = new BN(now + 2 * HOUR);

      await program.methods
        .createTaskSol(
          taskId,
          { direct: {} },
          new BN(MIN_REWARD_LAMPORTS),
          deadline,
          agent.publicKey,
        )
        .accounts({ poster: poster.publicKey })
        .signers([poster])
        .rpc();

      const [taskPda] = pdaTask(program.programId, taskId);
      const [vaultPda] = pdaVault(program.programId, taskId);
      const [agentPda] = PublicKey.findProgramAddressSync(
        [AGENT_SEED, agent.publicKey.toBuffer()],
        program.programId,
      );

      // Warp past the deadline.
      await advanceClockBy(2 * HOUR + 60);

      const posterBefore = await balance(poster.publicKey);

      await program.methods
        .expireTaskSol()
        .accounts({
          caller: KEEPER_KP.publicKey,
          taskAccount: taskPda,
          vault: vaultPda,
          posterWallet: poster.publicKey,
          agentAccount: agentPda,
        })
        .signers([KEEPER_KP])
        .rpc();

      const task = await program.account.taskAccount.fetch(taskPda);
      assert.deepStrictEqual(task.status, { expired: {} });

      const agentAccount = await program.account.agentAccount.fetch(agentPda);
      assert.strictEqual(agentAccount.disputedCount.toNumber(), 1);

      const posterAfter = await balance(poster.publicKey);
      assert.isAbove(
        posterAfter - posterBefore,
        MIN_REWARD_LAMPORTS - 100_000,
        "poster should be refunded escrow + vault rent",
      );

      const vaultInfo = await banksClient.getAccount(vaultPda);
      assert.isNull(vaultInfo, "vault should be closed");
    });

    it("expires unassigned Bounty task past deadline, no agent penalty", async () => {
      const poster = Keypair.generate();
      await fund(poster.publicKey);

      const taskId = freshTaskId();
      const now = await nowOnChain();
      const deadline = new BN(now + 2 * HOUR);

      await program.methods
        .createTaskSol(
          taskId,
          { bounty: {} },
          new BN(MIN_REWARD_LAMPORTS),
          deadline,
          null,
        )
        .accounts({ poster: poster.publicKey })
        .signers([poster])
        .rpc();

      const [taskPda] = pdaTask(program.programId, taskId);
      const [vaultPda] = pdaVault(program.programId, taskId);

      await advanceClockBy(2 * HOUR + 60);

      await program.methods
        .expireTaskSol()
        .accounts({
          caller: KEEPER_KP.publicKey,
          taskAccount: taskPda,
          vault: vaultPda,
          posterWallet: poster.publicKey,
          agentAccount: null,
        })
        .signers([KEEPER_KP])
        .rpc();

      const task = await program.account.taskAccount.fetch(taskPda);
      assert.deepStrictEqual(task.status, { expired: {} });
    });
  });
});
