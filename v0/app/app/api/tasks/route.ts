import { NextRequest, NextResponse } from "next/server";
import { saveTask, getAllTasks } from "@/lib/db";
import { getServerProgram, getRegistryPda, getTaskPda } from "@/lib/anchor-client";
import { PublicKey } from "@solana/web3.js";

export async function GET() {
  try {
    const tasks = getAllTasks();
    const program = getServerProgram();

    // Enrich with on-chain status
    const enriched = await Promise.all(
      tasks.map(async (task) => {
        try {
          const [taskPda] = getTaskPda(BigInt(task.taskId));
          const onChain = await program.account.task.fetch(taskPda);
          return {
            ...task,
            status: Object.keys(onChain.status)[0],
            solver: onChain.solver.equals(PublicKey.default) ? null : onChain.solver.toBase58(),
            submissionCount: onChain.submissionCount,
            timeoutAt: onChain.timeoutAt.toNumber(),
          };
        } catch {
          return { ...task, status: "unknown" };
        }
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, title, description, testSpec, rewardSol, poster } = body;

    if (!taskId || !title || !description || !testSpec || !rewardSol || !poster) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    saveTask({
      taskId: String(taskId),
      title,
      description,
      testSpec,
      rewardSol: Number(rewardSol),
      poster,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, taskId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
