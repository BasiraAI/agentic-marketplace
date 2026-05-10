import { randomUUID } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { taskCreateInputSchema } from "../schemas/task.js";
import * as tasksDb from "../db/tasks.js";
import { getConnection } from "../solana/connection.js";
import { getProgram } from "../solana/program.js";
import { taskIdFromUuid } from "../solana/pdas.js";
import {
  buildCreateTaskSolTx,
  buildCreateTaskUsdcTx,
  buildCancelTaskSolTx,
  buildCancelTaskUsdcTx,
} from "../solana/builders/index.js";
import { USDC_MINT_DEVNET } from "../solana/constants.js";
import type { VersionedTransaction } from "@solana/web3.js";

function usdcMint(): PublicKey {
  return process.env["SOLANA_CLUSTER"] === "mainnet-beta"
    ? new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    : USDC_MINT_DEVNET;
}

export interface CreateTaskResult {
  unsignedTx: VersionedTransaction;
  taskId: string;
  taskAccount: PublicKey;
  vault: PublicKey;
}

export async function createDirectTask(
  rawInput: unknown,
  posterWallet: string,
  recentBlockhash: string,
): Promise<CreateTaskResult> {
  const input = taskCreateInputSchema.parse(rawInput);
  if (input.mode !== "direct") throw new Error("Expected direct mode task");

  const taskId = randomUUID();
  const poster = new PublicKey(posterWallet);
  const connection = getConnection();
  const program = getProgram(connection);

  const base = {
    taskIdUuid: taskId,
    mode: "direct" as const,
    amount: input.amount,
    deadlineUnix: Number(input.deadline),
    assignedAgent: new PublicKey(input.assignedAgent),
    poster,
    payer: poster,
    recentBlockhash,
    program,
  };

  let result: { tx: VersionedTransaction; taskAccount: PublicKey; vault: PublicKey };
  if (input.currency === "SOL") {
    const r = await buildCreateTaskSolTx(base);
    result = { tx: r.tx, taskAccount: r.taskAccount, vault: r.vault };
  } else {
    const r = await buildCreateTaskUsdcTx({ ...base, usdcMint: usdcMint() });
    result = { tx: r.tx, taskAccount: r.taskAccount, vault: r.vault };
  }

  await tasksDb.insertTask({
    taskId,
    posterWallet,
    posterKind: "human",
    assignedAgent: input.assignedAgent,
    mode: "direct",
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    currency: input.currency,
    amount: input.amount,
    deadline: new Date(Number(input.deadline) * 1000),
    status: "assigned",
    taskPda: result.taskAccount.toBase58(),
  });

  return { unsignedTx: result.tx, taskId, taskAccount: result.taskAccount, vault: result.vault };
}

export async function createBountyTask(
  rawInput: unknown,
  posterWallet: string,
  recentBlockhash: string,
): Promise<CreateTaskResult> {
  const input = taskCreateInputSchema.parse(rawInput);
  if (input.mode !== "bounty") throw new Error("Expected bounty mode task");

  const taskId = randomUUID();
  const poster = new PublicKey(posterWallet);
  const connection = getConnection();
  const program = getProgram(connection);

  const base = {
    taskIdUuid: taskId,
    mode: "bounty" as const,
    amount: input.amount,
    deadlineUnix: Number(input.deadline),
    assignedAgent: null,
    poster,
    payer: poster,
    recentBlockhash,
    program,
  };

  let result: { tx: VersionedTransaction; taskAccount: PublicKey; vault: PublicKey };
  if (input.currency === "SOL") {
    const r = await buildCreateTaskSolTx(base);
    result = { tx: r.tx, taskAccount: r.taskAccount, vault: r.vault };
  } else {
    const r = await buildCreateTaskUsdcTx({ ...base, usdcMint: usdcMint() });
    result = { tx: r.tx, taskAccount: r.taskAccount, vault: r.vault };
  }

  await tasksDb.insertTask({
    taskId,
    posterWallet,
    posterKind: "human",
    assignedAgent: null,
    mode: "bounty",
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    currency: input.currency,
    amount: input.amount,
    deadline: new Date(Number(input.deadline) * 1000),
    status: "created",
    taskPda: result.taskAccount.toBase58(),
  });

  return { unsignedTx: result.tx, taskId, taskAccount: result.taskAccount, vault: result.vault };
}

export async function cancelTask(
  taskId: string,
  posterWallet: string,
  recentBlockhash: string,
): Promise<{ unsignedTx: VersionedTransaction }> {
  const task = await tasksDb.getTaskById(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.poster_wallet !== posterWallet) throw new Error("Not the task poster");
  if (!["created", "assigned"].includes(task.status)) {
    throw new Error(`Cannot cancel task in status: ${task.status}`);
  }

  const poster = new PublicKey(posterWallet);
  const connection = getConnection();
  const program = getProgram(connection);

  const base = { taskIdUuid: taskId, poster, payer: poster, recentBlockhash, program };

  if (task.currency === "SOL") {
    const { tx } = await buildCancelTaskSolTx(base);
    return { unsignedTx: tx };
  } else {
    const { tx } = await buildCancelTaskUsdcTx({ ...base, usdcMint: usdcMint() });
    return { unsignedTx: tx };
  }
}
