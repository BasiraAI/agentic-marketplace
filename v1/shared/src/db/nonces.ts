import { getDb } from "./kysely.js";

/**
 * Atomically claims a nonce. Returns true if this is the first time the
 * nonce has been used, false if it was already consumed.
 */
export async function consumeNonce(value: string): Promise<boolean> {
  const result = await getDb()
    .insertInto("nonces")
    .values({ value })
    .onConflict((oc) => oc.column("value").doNothing())
    .executeTakeFirst();
  return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
}
