import type { Selectable } from "kysely";
import { getDb } from "./kysely.js";
import type { DisputesTable } from "./types.js";

export type DisputeRecord = Selectable<DisputesTable>;

export async function openDispute(input: {
  taskId: string;
  openedBy: string;
  reason: string;
}): Promise<DisputeRecord> {
  return getDb()
    .insertInto("disputes")
    .values({
      task_id: input.taskId,
      opened_by: input.openedBy,
      reason: input.reason,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function recordAgentResponse(
  taskId: string,
  response: string,
  evidenceUrls: string[],
): Promise<void> {
  await getDb()
    .updateTable("disputes")
    .set({ agent_response: response, evidence_urls: evidenceUrls })
    .where("task_id", "=", taskId)
    .where("resolved_at", "is", null)
    .execute();
}

export async function recordRuling(
  taskId: string,
  ruling: "agent" | "poster",
  notes: string,
): Promise<void> {
  await getDb()
    .updateTable("disputes")
    .set({
      ruling,
      ruling_notes: notes,
      resolved_at: new Date(),
    })
    .where("task_id", "=", taskId)
    .where("resolved_at", "is", null)
    .execute();
}

export async function getOpenDisputeForTask(
  taskId: string,
): Promise<DisputeRecord | undefined> {
  return getDb()
    .selectFrom("disputes")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("resolved_at", "is", null)
    .executeTakeFirst();
}

export async function listGhostedDisputes(
  cutoff: Date,
): Promise<DisputeRecord[]> {
  return getDb()
    .selectFrom("disputes")
    .selectAll()
    .where("resolved_at", "is", null)
    .where("agent_response", "is", null)
    .where("opened_at", "<=", cutoff)
    .execute();
}
