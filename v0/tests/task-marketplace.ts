import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskMarketplace } from "../target/types/task_marketplace";
import { expect } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("task-marketplace", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.TaskMarketplace as Program<TaskMarketplace>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const poster = Keypair.generate();
  const solver = Keypair.generate();
  const verifier = Keypair.generate(); // simulates the platform server keypair

  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    program.programId
  );

  function getTaskPda(taskId: number) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync([Buffer.from("task"), buf], program.programId);
  }

  function getEscrowPda(taskId: number) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync([Buffer.from("escrow"), buf], program.programId);
  }

  before(async () => {
    await Promise.all([
      provider.connection.requestAirdrop(poster.publicKey, 2 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(solver.publicKey, LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(verifier.publicKey, LAMPORTS_PER_SOL),
    ]);
    await new Promise((r) => setTimeout(r, 2000));
  });

  it("initializes registry", async () => {
    await program.methods
      .initializeRegistry(verifier.publicKey)
      .accounts({ payer: provider.wallet.publicKey, registry: registryPda })
      .rpc();

    const registry = await program.account.registry.fetch(registryPda);
    expect(registry.taskCount.toNumber()).to.equal(0);
    expect(registry.verifierAuthority.toBase58()).to.equal(verifier.publicKey.toBase58());
    console.log("✓ Registry initialized, verifier authority set");
  });

  it("full happy path: post → submit → verified → released", async () => {
    const registry = await program.account.registry.fetch(registryPda);
    const taskId = registry.taskCount.toNumber();
    const [taskPda] = getTaskPda(taskId);
    const [escrowPda] = getEscrowPda(taskId);

    const rewardLamports = new anchor.BN(100_000_000); // 0.1 SOL
    const timeoutSeconds = new anchor.BN(86400); // 1 day

    // 1. Poster creates task + funds escrow
    await program.methods
      .postTask(new anchor.BN(taskId), rewardLamports, timeoutSeconds)
      .accounts({
        poster: poster.publicKey,
        registry: registryPda,
        task: taskPda,
        escrow: escrowPda,
      })
      .signers([poster])
      .rpc();

    let task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("open");
    expect(task.rewardLamports.toNumber()).to.equal(100_000_000);
    console.log(`✓ Task #${taskId} posted, 0.1 SOL locked in escrow`);

    // 2. Verifier records solver submission on-chain
    await program.methods
      .submitSolution(solver.publicKey)
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier])
      .rpc();

    task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("submitted");
    expect(task.submissionCount).to.equal(1);
    console.log("✓ Solution submitted on-chain, status = Submitted");

    // 3. Claude says pass → mark verified
    await program.methods
      .markVerified()
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier])
      .rpc();

    task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("verified");
    console.log("✓ Claude verdict: pass → status = Verified");

    // 4. Release escrow to solver
    const solverBalanceBefore = await provider.connection.getBalance(solver.publicKey);

    await program.methods
      .releaseToSolver()
      .accounts({
        authority: verifier.publicKey,
        registry: registryPda,
        task: taskPda,
        escrow: escrowPda,
        solver: solver.publicKey,
      })
      .signers([verifier])
      .rpc();

    const solverBalanceAfter = await provider.connection.getBalance(solver.publicKey);
    const earned = (solverBalanceAfter - solverBalanceBefore) / LAMPORTS_PER_SOL;

    task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("released");
    expect(earned).to.be.approximately(0.1, 0.01);
    console.log(`✓ SOL released. Solver earned ${earned.toFixed(4)} SOL`);
  });

  it("fail path: submit → failed → resubmit → released", async () => {
    const registry = await program.account.registry.fetch(registryPda);
    const taskId = registry.taskCount.toNumber();
    const [taskPda] = getTaskPda(taskId);
    const [escrowPda] = getEscrowPda(taskId);

    await program.methods
      .postTask(new anchor.BN(taskId), new anchor.BN(50_000_000), new anchor.BN(86400))
      .accounts({ poster: poster.publicKey, registry: registryPda, task: taskPda, escrow: escrowPda })
      .signers([poster])
      .rpc();

    // First attempt — fails
    await program.methods.submitSolution(solver.publicKey)
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier]).rpc();

    await program.methods.markFailed()
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier]).rpc();

    let task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("failed");
    expect(task.submissionCount).to.equal(1);
    console.log("✓ First attempt failed, solver can resubmit");

    // Second attempt — passes
    await program.methods.submitSolution(solver.publicKey)
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier]).rpc();

    await program.methods.markVerified()
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda })
      .signers([verifier]).rpc();

    await program.methods.releaseToSolver()
      .accounts({ authority: verifier.publicKey, registry: registryPda, task: taskPda, escrow: escrowPda, solver: solver.publicKey })
      .signers([verifier]).rpc();

    task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("released");
    expect(task.submissionCount).to.equal(2);
    console.log("✓ Second attempt passed, SOL released after 2 attempts");
  });

  it("timeout path: unresolved task refunds to poster", async () => {
    const registry = await program.account.registry.fetch(registryPda);
    const taskId = registry.taskCount.toNumber();
    const [taskPda] = getTaskPda(taskId);
    const [escrowPda] = getEscrowPda(taskId);

    // Post with 1-second timeout so we can test refund immediately
    await program.methods
      .postTask(new anchor.BN(taskId), new anchor.BN(50_000_000), new anchor.BN(1))
      .accounts({ poster: poster.publicKey, registry: registryPda, task: taskPda, escrow: escrowPda })
      .signers([poster])
      .rpc();

    await new Promise((r) => setTimeout(r, 2000));

    const posterBalanceBefore = await provider.connection.getBalance(poster.publicKey);

    await program.methods
      .refundToPoster()
      .accounts({ poster: poster.publicKey, task: taskPda, escrow: escrowPda })
      .rpc();

    const posterBalanceAfter = await provider.connection.getBalance(poster.publicKey);
    const refunded = (posterBalanceAfter - posterBalanceBefore) / LAMPORTS_PER_SOL;

    const task = await program.account.task.fetch(taskPda);
    expect(Object.keys(task.status)[0]).to.equal("refunded");
    expect(refunded).to.be.approximately(0.05, 0.01);
    console.log(`✓ Timeout reached, poster refunded ${refunded.toFixed(4)} SOL`);
  });

  it("rejects unauthorized verifier", async () => {
    const fakeVerifier = Keypair.generate();
    await provider.connection.requestAirdrop(fakeVerifier.publicKey, LAMPORTS_PER_SOL);
    await new Promise((r) => setTimeout(r, 1000));

    const registry = await program.account.registry.fetch(registryPda);
    const taskId = registry.taskCount.toNumber();
    const [taskPda] = getTaskPda(taskId);
    const [escrowPda] = getEscrowPda(taskId);

    await program.methods
      .postTask(new anchor.BN(taskId), new anchor.BN(10_000_000), new anchor.BN(86400))
      .accounts({ poster: poster.publicKey, registry: registryPda, task: taskPda, escrow: escrowPda })
      .signers([poster])
      .rpc();

    try {
      await program.methods.submitSolution(solver.publicKey)
        .accounts({ authority: fakeVerifier.publicKey, registry: registryPda, task: taskPda })
        .signers([fakeVerifier])
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.message).to.include("NotVerifierAuthority");
      console.log("✓ Unauthorized verifier correctly rejected");
    }
  });
});
