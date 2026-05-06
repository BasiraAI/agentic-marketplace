import { NextRequest, NextResponse } from "next/server";
import { getTask, getSubmissionsForTask } from "@/lib/db";
import { getServerProgram, getTaskPda } from "@/lib/anchor-client";
import { PublicKey } from "@solana/web3.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const task = getTask(taskId);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const program = getServerProgram();
    const [taskPda] = getTaskPda(BigInt(taskId));
    const onChain = await program.account.task.fetch(taskPda);

    const submissions = getSubmissionsForTask(taskId);

    return NextResponse.json({
      ...task,
      status: Object.keys(onChain.status)[0],
      solver: onChain.solver.equals(PublicKey.default) ? null : onChain.solver.toBase58(),
      submissionCount: onChain.submissionCount,
      timeoutAt: onChain.timeoutAt.toNumber(),
      submissions,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
