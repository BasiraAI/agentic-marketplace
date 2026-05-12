import { Connection, PublicKey } from "@solana/web3.js";
import {
  tasksDb,
  getProgram,
  buildExpireTaskSolTx,
  buildExpireTaskUsdcTx,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from "@basira/shared";
import { getLogger } from "../log.js";
import { loadKeeperKeypair } from "../keys.js";
import { signAndBroadcast } from "./_send.js";

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

export async function runExpireSweep(connection: Connection): Promise<SweepResult> {
  const log = getLogger().child({ cron: "expire" });
  const tasks = await tasksDb.listAssignedOrCreatedPastDeadline(new Date());
  let sent = 0;
  let skipped = 0;

  if (tasks.length === 0) return { swept: 0, sent: 0, skipped: 0 };

  const keeper = loadKeeperKeypair();
  const program = getProgram(connection);

  for (const task of tasks) {
    try {
      const fresh = await tasksDb.getTaskById(task.task_id);
      if (!fresh || !["created", "assigned"].includes(fresh.status)) {
        skipped++;
        continue;
      }
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const base = {
        taskIdUuid: fresh.task_id,
        caller: keeper.publicKey,
        posterWallet: new PublicKey(fresh.poster_wallet),
        agentWallet: fresh.assigned_agent ? new PublicKey(fresh.assigned_agent) : null,
        payer: keeper.publicKey,
        recentBlockhash: blockhash,
        program,
      };
      const { tx } =
        fresh.currency === "SOL"
          ? await buildExpireTaskSolTx(base)
          : await buildExpireTaskUsdcTx({ ...base, usdcMint: getUsdcMint() });

      await signAndBroadcast(connection, tx, [keeper], log);
      sent++;
    } catch (err) {
      log.error({ err, taskId: task.task_id }, "expire tx failed");
    }
  }

  log.info({ swept: tasks.length, sent, skipped }, "expire sweep done");
  return { swept: tasks.length, sent, skipped };
}
