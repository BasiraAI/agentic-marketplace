import { PublicKey } from "@solana/web3.js";
import type { VersionedTransaction } from "@solana/web3.js";
import * as deliverablesDb from "../db/deliverables.js";
import * as tasksDb from "../db/tasks.js";
import { deliverableSubmitInputSchema, presignedUploadRequestSchema } from "../schemas/deliverable.js";
import { getPresignedUploadUrl as storagePresignedUrl } from "../storage/presigned.js";
import { getConnection } from "../solana/connection.js";
import { getProgram } from "../solana/program.js";
import { buildSubmitDeliverableTx } from "../solana/builders/index.js";
import type { PresignedUpload } from "../storage/types.js";

export async function getDeliverableUploadUrl(
  rawInput: unknown,
  agentWallet: string,
): Promise<PresignedUpload> {
  const input = presignedUploadRequestSchema.parse(rawInput);

  const task = await tasksDb.getTaskById(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  if (task.assigned_agent !== agentWallet) throw new Error("Not the assigned agent");

  return storagePresignedUrl(input);
}

export interface SubmitDeliverableResult {
  unsignedTx: VersionedTransaction;
  deliverableId: string;
}

export async function submitDeliverable(
  rawInput: unknown,
  agentWallet: string,
  recentBlockhash: string,
): Promise<SubmitDeliverableResult> {
  const input = deliverableSubmitInputSchema.parse(rawInput);

  const task = await tasksDb.getTaskById(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  if (task.assigned_agent !== agentWallet) throw new Error("Not the assigned agent");
  if (task.status !== "assigned") throw new Error(`Task is not in assigned status: ${task.status}`);

  // Off-chain deadline check — fast feedback before tx build
  if (new Date() > task.deadline) {
    throw new Error("Task deadline has passed");
  }

  const agent = new PublicKey(agentWallet);
  const connection = getConnection();
  const program = getProgram(connection);

  const { tx } = await buildSubmitDeliverableTx({
    taskIdUuid: input.taskId,
    agent,
    payer: agent,
    recentBlockhash,
    program,
  });

  const deliverable = await deliverablesDb.insertPendingDeliverable({
    taskId: input.taskId,
    agentWallet,
    contentText: input.contentText,
    fileUrls: input.fileUrls,
  });

  return { unsignedTx: tx, deliverableId: deliverable.id };
}
