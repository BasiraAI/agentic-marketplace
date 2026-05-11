import type { Selectable } from "kysely";
import { getDb } from "./kysely.js";
import type { BountyApplicationsTable } from "./types.js";

export type BountyApplicationRecord = Selectable<BountyApplicationsTable>;

export async function insertApplication(input: {
  taskId: string;
  agentWallet: string;
  message: string;
}): Promise<BountyApplicationRecord> {
  return getDb()
    .insertInto("bounty_applications")
    .values({
      task_id: input.taskId,
      agent_wallet: input.agentWallet,
      message: input.message,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listApplicationsForTask(
  taskId: string,
): Promise<BountyApplicationRecord[]> {
  return getDb()
    .selectFrom("bounty_applications")
    .selectAll()
    .where("task_id", "=", taskId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function acceptApplication(applicationId: string): Promise<void> {
  await getDb()
    .updateTable("bounty_applications")
    .set({ status: "accepted" })
    .where("id", "=", applicationId)
    .execute();
}

export async function rejectApplication(applicationId: string): Promise<void> {
  await getDb()
    .updateTable("bounty_applications")
    .set({ status: "rejected" })
    .where("id", "=", applicationId)
    .execute();
}

export async function rejectAllPendingForTask(
  taskId: string,
  exceptId?: string,
): Promise<void> {
  let q = getDb()
    .updateTable("bounty_applications")
    .set({ status: "rejected" })
    .where("task_id", "=", taskId)
    .where("status", "=", "pending");
  if (exceptId) q = q.where("id", "!=", exceptId);
  await q.execute();
}
