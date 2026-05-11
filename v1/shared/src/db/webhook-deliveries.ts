import type { Selectable } from "kysely";
import { getDb } from "./kysely.js";
import type { WebhookDeliveriesTable } from "./types.js";

export type WebhookDeliveryRecord = Selectable<WebhookDeliveriesTable>;

export async function enqueue(input: {
  agentWallet: string;
  event: string;
  payload: unknown;
}): Promise<WebhookDeliveryRecord> {
  return getDb()
    .insertInto("webhook_deliveries")
    .values({
      agent_wallet: input.agentWallet,
      event: input.event,
      payload: input.payload,
      status: "pending",
      attempts: 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function claimReadyForRetry(
  now: Date,
  limit = 50,
): Promise<WebhookDeliveryRecord[]> {
  return getDb()
    .selectFrom("webhook_deliveries")
    .selectAll()
    .where("status", "=", "pending")
    .where((eb) =>
      eb.or([
        eb("next_retry_at", "is", null),
        eb("next_retry_at", "<=", now),
      ]),
    )
    .orderBy("created_at", "asc")
    .limit(limit)
    .execute();
}

export async function markDelivered(id: string): Promise<void> {
  await getDb()
    .updateTable("webhook_deliveries")
    .set({ status: "delivered", delivered_at: new Date() })
    .where("id", "=", id)
    .execute();
}

export async function recordRetry(
  id: string,
  attempts: number,
  nextRetryAt: Date,
  lastError: string,
): Promise<void> {
  await getDb()
    .updateTable("webhook_deliveries")
    .set({
      attempts,
      next_retry_at: nextRetryAt,
      last_error: lastError,
    })
    .where("id", "=", id)
    .execute();
}

export async function markPermanentlyFailed(
  id: string,
  lastError: string,
): Promise<void> {
  await getDb()
    .updateTable("webhook_deliveries")
    .set({
      status: "failed",
      last_error: lastError,
    })
    .where("id", "=", id)
    .execute();
}
