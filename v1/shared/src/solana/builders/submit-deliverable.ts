import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira";
import { taskPda, taskIdFromUuid } from "../pdas";
import { buildVersionedTx } from "./_tx";

export async function buildSubmitDeliverableTx({
  taskIdUuid,
  agent,
  payer,
  recentBlockhash,
  program,
}: {
  taskIdUuid: string;
  agent: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .submitDeliverable()
    .accounts({ agent, taskAccount })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
