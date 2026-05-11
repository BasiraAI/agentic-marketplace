import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

export function buildVersionedTx(
  payer: PublicKey,
  recentBlockhash: string,
  instructions: TransactionInstruction[],
): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash,
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
