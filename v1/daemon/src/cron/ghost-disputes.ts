import { Connection } from "@solana/web3.js";
import { disputesDb, resolveDispute } from "@basira/shared";
import { getLogger } from "../log.js";
import { loadArbitratorKeypair } from "../keys.js";
import { signAndBroadcast } from "./_send.js";

const GHOST_HOURS = 48;

export interface SweepResult {
  swept: number;
  sent: number;
  skipped: number;
}

export async function runGhostDisputeSweep(
  connection: Connection,
): Promise<SweepResult> {
  const log = getLogger().child({ cron: "ghost-disputes" });
  const cutoff = new Date(Date.now() - GHOST_HOURS * 3_600_000);
  const ghosts = await disputesDb.listGhostedDisputes(cutoff);
  let sent = 0;
  let skipped = 0;

  if (ghosts.length === 0) return { swept: 0, sent: 0, skipped: 0 };

  const arbitrator = loadArbitratorKeypair();

  for (const dispute of ghosts) {
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const { unsignedTx } = await resolveDispute({
        taskId: dispute.task_id,
        ruling: "forPoster",
        notes: "Agent did not respond within 48h",
        recentBlockhash: blockhash,
      });
      await signAndBroadcast(connection, unsignedTx, [arbitrator], log);
      sent++;
    } catch (err) {
      log.error({ err, taskId: dispute.task_id }, "ghost-dispute tx failed");
      skipped++;
    }
  }

  log.info({ swept: ghosts.length, sent, skipped }, "ghost-dispute sweep done");
  return { swept: ghosts.length, sent, skipped };
}
