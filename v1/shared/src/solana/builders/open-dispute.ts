import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira";
import { taskPda, taskIdFromUuid } from "../pdas";
import { buildVersionedTx } from "./_tx";

export async function buildOpenDisputeTx({
  taskIdUuid,
  signer,
  payer,
  recentBlockhash,
  program,
}: {
  taskIdUuid: string;
  signer: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .openDispute()
    .accounts({ signer, taskAccount })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
