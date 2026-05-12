import * as settlementsDb from "../db/settlements";

export async function recordSettlement(input: {
  taskId: string;
  kind: "release" | "refund" | "fee";
  recipientWallet: string;
  currency: "SOL" | "USDC";
  amount: bigint;
  txSignature: string;
}): Promise<void> {
  await settlementsDb.recordSettlement(input);
}
