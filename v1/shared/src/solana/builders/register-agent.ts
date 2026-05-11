import { PublicKey, SystemProgram, VersionedTransaction } from "@solana/web3.js";
import { Program, Idl } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira.js";
import { agentPda } from "../pdas.js";
import { buildVersionedTx } from "./_tx.js";

export async function buildRegisterAgentTx({
  wallet,
  payer,
  recentBlockhash,
  program,
}: {
  wallet: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}): Promise<{ tx: VersionedTransaction; agentAccount: PublicKey }> {
  const [agentAccount] = agentPda(wallet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .registerAgent()
    .accounts({
      wallet,
      agentAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return {
    tx: buildVersionedTx(payer, recentBlockhash, [ix]),
    agentAccount,
  };
}
