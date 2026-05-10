import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira.js";
import { taskPda, vaultPda, agentPda, taskIdFromUuid } from "../pdas.js";
import { buildVersionedTx } from "./_tx.js";

interface ExpireTaskBase {
  taskIdUuid: string;
  caller: PublicKey;
  posterWallet: PublicKey;
  agentWallet: PublicKey | null;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}

export async function buildExpireTaskSolTx({
  taskIdUuid,
  caller,
  posterWallet,
  agentWallet,
  payer,
  recentBlockhash,
  program,
}: ExpireTaskBase): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  // agent_account is optional in expire_task_sol (only present when task was assigned)
  const agentAccountOpt = agentWallet ? agentPda(agentWallet)[0] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .expireTaskSol()
    .accounts({
      caller,
      taskAccount,
      vault,
      posterWallet,
      agentAccount: agentAccountOpt,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}

export async function buildExpireTaskUsdcTx({
  taskIdUuid,
  caller,
  posterWallet,
  agentWallet,
  payer,
  recentBlockhash,
  program,
  usdcMint,
}: ExpireTaskBase & { usdcMint: PublicKey }): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const vaultTokenAccount = getAssociatedTokenAddressSync(usdcMint, vault, true);
  const posterTokenAccount = getAssociatedTokenAddressSync(usdcMint, posterWallet);
  const agentAccountOpt = agentWallet ? agentPda(agentWallet)[0] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .expireTaskUsdc()
    .accounts({
      caller,
      taskAccount,
      vault,
      posterWallet,
      usdcMint,
      vaultTokenAccount,
      posterTokenAccount,
      agentAccount: agentAccountOpt,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
