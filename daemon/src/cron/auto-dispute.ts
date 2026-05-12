import { Connection } from "@solana/web3.js";
import {
  tasksDb,
  judgeVerdictsDb,
  disputesDb,
  openDisputeAuto,
} from "@basira/shared";
import { getLogger } from "../log.js";
import { loadArbitratorKeypair } from "../keys.js";
import { signAndBroadcast } from "./_send.js";

const AUTO_DISPUTE_HOURS = 24;

export interface SweepResult {
  swept: number;
  sent: number;
  skipped: number;
}

export async function runAutoDisputeSweep(
  connection: Connection,
): Promise<SweepResult> {
  const log = getLogger().child({ cron: "auto-dispute" });
  const cutoff = new Date(Date.now() - AUTO_DISPUTE_HOURS * 3_600_000);
  const tasks = await tasksDb.listSubmittedOlderThan(cutoff);
  let sent = 0;
  let skipped = 0;

  if (tasks.length === 0) return { swept: 0, sent: 0, skipped: 0 };

  const arbitrator = loadArbitratorKeypair();

  for (const task of tasks) {
    try {
      const dispute = await disputesDb.getOpenDisputeForTask(task.task_id);
      if (dispute) {
        skipped++;
        continue;
      }
      const verdict = await judgeVerdictsDb.getLatestVerdictForTask(task.task_id);
      if (verdict?.verdict !== "fail") {
        skipped++;
        continue;
      }
      const fresh = await tasksDb.getTaskById(task.task_id);
      if (!fresh || fresh.status !== "submitted") {
        skipped++;
        continue;
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const reason = `Auto-dispute: judge verdict FAIL — ${verdict.reasoning.slice(0, 200)}`;
      const { unsignedTx } = await openDisputeAuto({
        taskId: fresh.task_id,
        reason,
        recentBlockhash: blockhash,
      });

      await signAndBroadcast(connection, unsignedTx, [arbitrator], log);
      sent++;
    } catch (err) {
      log.error({ err, taskId: task.task_id }, "auto-dispute tx failed");
    }
  }

  log.info({ swept: tasks.length, sent, skipped }, "auto-dispute sweep done");
  return { swept: tasks.length, sent, skipped };
}
