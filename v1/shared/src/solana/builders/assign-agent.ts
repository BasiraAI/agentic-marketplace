import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira.js";
import { taskPda, agentPda, taskIdFromUuid } from "../pdas.js";
import { buildVersionedTx } from "./_tx.js";

export async function buildAssignAgentTx({
  taskIdUuid,
  poster,
  agentWallet,
  payer,
  recentBlockhash,
  program,
}: {
  taskIdUuid: string;
  poster: PublicKey;
  agentWallet: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [agentAccount] = agentPda(agentWallet);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .assignAgent()
    .accounts({ poster, taskAccount, agentAccount })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
