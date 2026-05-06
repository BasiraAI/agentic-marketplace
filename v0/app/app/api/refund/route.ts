import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/db";
import { getServerProgram, getTaskPda, getEscrowPda } from "@/lib/anchor-client";
import { PublicKey } from "@solana/web3.js";

// Permissionless — call this on a cron or manually to sweep expired tasks
export async function POST() {
  const program = getServerProgram();
  const tasks = getAllTasks();
  const now = Math.floor(Date.now() / 1000);
  const results: { taskId: string; result: string }[] = [];

  for (const task of tasks) {
    try {
      const taskIdBigInt = BigInt(task.taskId);
      const [taskPda] = getTaskPda(taskIdBigInt);
      const [escrowPda] = getEscrowPda(taskIdBigInt);

      const onChain = await program.account.task.fetch(taskPda);
      const status = Object.keys(onChain.status)[0];

      if (status === "released" || status === "refunded") continue;
      if (onChain.timeoutAt.toNumber() > now) continue;

      const posterPubkey = new PublicKey(task.poster);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods.refundToPoster() as any)
        .accountsPartial({
          poster: posterPubkey,
          task: taskPda,
          escrow: escrowPda,
        })
        .rpc();

      results.push({ taskId: task.taskId, result: "refunded" });
    } catch (err) {
      results.push({ taskId: task.taskId, result: `error: ${err}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
