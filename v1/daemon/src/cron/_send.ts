import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import type { Logger } from "pino";

export interface SignAndSendResult {
  signature: string;
}

/**
 * Re-fetches a fresh blockhash, attaches it to the unsigned tx, signs with the
 * given signers, broadcasts and confirms. Cron callers may have built the tx
 * with a stale blockhash; this overrides whatever was set.
 *
 * Note: VersionedTransaction holds the blockhash inside its compiled message.
 * We rebuild the message in a new transaction with the fresh hash via
 * `tx.message.recentBlockhash = …` (mutable on V0 messages).
 */
export async function signAndBroadcast(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Keypair[],
  log: Logger,
): Promise<SignAndSendResult> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  // V0 message has a mutable recentBlockhash field.
  tx.message.recentBlockhash = blockhash;
  tx.sign(signers);
  const signature = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  log.info({ signature }, "tx confirmed");
  return { signature };
}
