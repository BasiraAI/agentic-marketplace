import { PublicKey } from "@solana/web3.js";
import type { VersionedTransaction } from "@solana/web3.js";
import * as tasksDb from "../db/tasks.js";
import * as disputesDb from "../db/disputes.js";
import { getConnection } from "../solana/connection.js";
import { getProgram } from "../solana/program.js";
import {
  buildOpenDisputeTx,
  buildResolveDisputeSolTx,
  buildResolveDisputeUsdcTx,
} from "../solana/builders/index.js";
import { ARBITRATOR_ADDRESS, USDC_MINT_DEVNET } from "../solana/constants.js";

function usdcMint(): PublicKey {
  return process.env["SOLANA_CLUSTER"] === "mainnet-beta"
    ? new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    : USDC_MINT_DEVNET;
}

export async function openDisputeAuto(input: {
  taskId: string;
  reason: string;
  recentBlockhash: string;
}): Promise<{ unsignedTx: VersionedTransaction }> {
  const task = await tasksDb.getTaskById(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);

  const connection = getConnection();
  const program = getProgram(connection);

  const { tx } = await buildOpenDisputeTx({
    taskIdUuid: input.taskId,
    signer: ARBITRATOR_ADDRESS,
    payer: ARBITRATOR_ADDRESS,
    recentBlockhash: input.recentBlockhash,
    program,
  });

  await disputesDb.openDispute({
    taskId: input.taskId,
    openedBy: ARBITRATOR_ADDRESS.toBase58(),
    reason: input.reason,
  });

  return { unsignedTx: tx };
}

export async function resolveDispute(input: {
  taskId: string;
  ruling: "forAgent" | "forPoster";
  notes: string;
  recentBlockhash: string;
}): Promise<{ unsignedTx: VersionedTransaction }> {
  const task = await tasksDb.getTaskById(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  if (task.status !== "disputed") throw new Error(`Task is not disputed: ${task.status}`);
  if (!task.assigned_agent) throw new Error("No assigned agent on task");

  const posterWallet = new PublicKey(task.poster_wallet);
  const agentWallet = new PublicKey(task.assigned_agent);
  const connection = getConnection();
  const program = getProgram(connection);

  const base = {
    taskIdUuid: input.taskId,
    posterWallet,
    agentWallet,
    ruling: input.ruling,
    payer: ARBITRATOR_ADDRESS,
    recentBlockhash: input.recentBlockhash,
    program,
  };

  let tx: VersionedTransaction;
  if (task.currency === "SOL") {
    ({ tx } = await buildResolveDisputeSolTx(base));
  } else {
    ({ tx } = await buildResolveDisputeUsdcTx({ ...base, usdcMint: usdcMint() }));
  }

  const dbRuling = input.ruling === "forAgent" ? "agent" : "poster";
  await disputesDb.recordRuling(input.taskId, dbRuling, input.notes);

  return { unsignedTx: tx };
}
