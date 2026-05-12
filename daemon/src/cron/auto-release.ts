import { Connection, PublicKey } from "@solana/web3.js";
import {
  tasksDb,
  judgeVerdictsDb,
  disputesDb,
  getProgram,
  buildClaimAfterTimeoutSolTx,
  buildClaimAfterTimeoutUsdcTx,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from "@basira/shared";
import { getLogger } from "../log.js";
import { loadKeeperKeypair } from "../keys.js";
import { signAndBroadcast } from "./_send.js";

const AUTO_RELEASE_HOURS = 24;

export interface SweepResult {
  swept: number;
  sent: number;
  skipped: number;
}

function getUsdcMint(): PublicKey {
  return process.env["SOLANA_CLUSTER"] === "mainnet-beta"
    ? USDC_MINT_MAINNET
    : USDC_MINT_DEVNET;
}

export async function runAutoReleaseSweep(
  connection: Connection,
): Promise<SweepResult> {
  const log = getLogger().child({ cron: "auto-release" });
  const cutoff = new Date(Date.now() - AUTO_RELEASE_HOURS * 3_600_000);
  const tasks = await tasksDb.listSubmittedOlderThan(cutoff);
  let sent = 0;
  let skipped = 0;

  if (tasks.length === 0) {
    log.debug("no candidate tasks");
    return { swept: 0, sent: 0, skipped: 0 };
  }

  const keeper = loadKeeperKeypair();
  const program = getProgram(connection);

  for (const task of tasks) {
    try {
      // Skip if a dispute is open.
      const dispute = await disputesDb.getOpenDisputeForTask(task.task_id);
      if (dispute) {
        skipped++;
        continue;
      }

      const verdict = await judgeVerdictsDb.getLatestVerdictForTask(task.task_id);
      // Treat absent verdict as "unavailable" → still proceed (judge crashed).
      const v = verdict?.verdict ?? "unavailable";
      if (v === "fail") {
        skipped++;
        continue;
      }

      // Status race: re-check that task is still submitted.
      const fresh = await tasksDb.getTaskById(task.task_id);
      if (!fresh || fresh.status !== "submitted") {
        skipped++;
        continue;
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      if (!fresh.assigned_agent) {
        log.warn({ taskId: fresh.task_id }, "submitted task without assigned agent — skipping");
        skipped++;
        continue;
      }
      const base = {
        taskIdUuid: fresh.task_id,
        caller: keeper.publicKey,
        posterWallet: new PublicKey(fresh.poster_wallet),
        agentWallet: new PublicKey(fresh.assigned_agent),
        payer: keeper.publicKey,
        recentBlockhash: blockhash,
        program,
      };
      const { tx } =
        fresh.currency === "SOL"
          ? await buildClaimAfterTimeoutSolTx(base)
          : await buildClaimAfterTimeoutUsdcTx({ ...base, usdcMint: getUsdcMint() });

      await signAndBroadcast(connection, tx, [keeper], log);
      sent++;
    } catch (err) {
      log.error({ err, taskId: task.task_id }, "auto-release tx failed");
    }
  }

  log.info({ swept: tasks.length, sent, skipped }, "auto-release sweep done");
  return { swept: tasks.length, sent, skipped };
}
