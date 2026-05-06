import { NextRequest, NextResponse } from "next/server";
import { getTask, saveSubmission, updateSubmissionVerdict } from "@/lib/db";
import { verifyCode } from "@/lib/claude";
import {
  getServerProgram,
  getTaskPda,
  getEscrowPda,
  getRegistryPda,
} from "@/lib/anchor-client";
import { PublicKey } from "@solana/web3.js";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { taskId, solver, code } = await req.json();

    if (!taskId || !solver || !code) {
      return NextResponse.json({ error: "Missing taskId, solver, or code" }, { status: 400 });
    }

    const task = getTask(String(taskId));
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const submissionId = randomUUID();
    saveSubmission({
      submissionId,
      taskId: String(taskId),
      solver,
      code,
      submittedAt: new Date().toISOString(),
      verdict: "pending",
      claudeReason: "",
    });

    const program = getServerProgram();
    const solverPubkey = new PublicKey(solver);
    const taskIdBigInt = BigInt(taskId);
    const [registryPda] = getRegistryPda();
    const [taskPda] = getTaskPda(taskIdBigInt);
    const [escrowPda] = getEscrowPda(taskIdBigInt);
    const authority = program.provider.publicKey!;

    // Record submission on-chain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (program.methods.submitSolution(solverPubkey) as any)
      .accountsPartial({ authority, registry: registryPda, task: taskPda })
      .rpc();

    // Claude verification
    const { verdict, reason } = await verifyCode(task.description, task.testSpec, code);
    const finalVerdict = verdict === "inconclusive" ? "fail" : verdict;

    if (finalVerdict === "pass") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods.markVerified() as any)
        .accountsPartial({ authority, registry: registryPda, task: taskPda })
        .rpc();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods.releaseToSolver() as any)
        .accountsPartial({
          authority,
          registry: registryPda,
          task: taskPda,
          escrow: escrowPda,
          solver: solverPubkey,
        })
        .rpc();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods.markFailed() as any)
        .accountsPartial({ authority, registry: registryPda, task: taskPda })
        .rpc();
    }

    updateSubmissionVerdict(submissionId, finalVerdict as "pass" | "fail", reason);

    return NextResponse.json({ submissionId, verdict: finalVerdict, reason });
  } catch (err) {
    console.error("Submission error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
