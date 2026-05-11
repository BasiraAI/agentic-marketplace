import { getDb } from "./kysely.js";

export async function getLastSeenSlot(): Promise<bigint> {
  const db = getDb();
  const row = await db
    .selectFrom("daemon_state")
    .select("last_seen_slot")
    .where("id", "=", 1)
    .executeTakeFirst();
  if (!row) return 0n;
  return BigInt(row.last_seen_slot);
}

export async function setLastSeenSlot(slot: bigint): Promise<void> {
  const db = getDb();
  await db
    .updateTable("daemon_state")
    .set({ last_seen_slot: slot, updated_at: new Date() })
    .where("id", "=", 1)
    .execute();
}
