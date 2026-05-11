import { getDb } from "./kysely.js";

export interface RecordSettlementInput {
  taskId: string;
  kind: "release" | "refund" | "fee";
  recipientWallet: string;
  currency: "SOL" | "USDC";
  amount: bigint;
  txSignature: string;
}

/**
 * Idempotent. The (tx_signature, kind, recipient_wallet) tuple is unique;
 * a duplicate insert (e.g. on listener replay) is a no-op.
 */
export async function recordSettlement(
  input: RecordSettlementInput,
): Promise<void> {
  await getDb()
    .insertInto("settlements")
    .values({
      task_id: input.taskId,
      kind: input.kind,
      recipient_wallet: input.recipientWallet,
      currency: input.currency,
      amount: input.amount.toString(),
      tx_signature: input.txSignature,
    })
    .onConflict((oc) =>
      oc.columns(["tx_signature", "kind", "recipient_wallet"]).doNothing(),
    )
    .execute();
}

export async function listSettlementsForTask(taskId: string): Promise<
  {
    kind: string;
    recipientWallet: string;
    currency: string;
    amount: string;
    txSignature: string;
    createdAt: Date;
  }[]
> {
  const rows = await getDb()
    .selectFrom("settlements")
    .select([
      "kind",
      "recipient_wallet as recipientWallet",
      "currency",
      "amount",
      "tx_signature as txSignature",
      "created_at as createdAt",
    ])
    .where("task_id", "=", taskId)
    .orderBy("created_at", "asc")
    .execute();
  return rows;
}
