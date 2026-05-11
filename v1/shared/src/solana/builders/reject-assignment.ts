import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira.js";
import { taskPda, vaultPda, taskIdFromUuid } from "../pdas.js";
import { buildVersionedTx } from "./_tx.js";

interface RejectAssignmentBase {
  taskIdUuid: string;
  agent: PublicKey;
  posterWallet: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}

export async function buildRejectAssignmentSolTx({
  taskIdUuid,
  agent,
  posterWallet,
  payer,
  recentBlockhash,
  program,
}: RejectAssignmentBase): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .rejectAssignmentSol()
    .accounts({ agent, taskAccount, vault, posterWallet })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}

export async function buildRejectAssignmentUsdcTx({
  taskIdUuid,
  agent,
  posterWallet,
  payer,
  recentBlockhash,
  program,
  usdcMint,
}: RejectAssignmentBase & { usdcMint: PublicKey }): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const posterTokenAccount = getAssociatedTokenAddressSync(usdcMint, posterWallet);
  const vaultTokenAccount = getAssociatedTokenAddressSync(usdcMint, vault, true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .rejectAssignmentUsdc()
    .accounts({
      agent,
      taskAccount,
      vault,
      posterWallet,
      usdcMint,
      vaultTokenAccount,
      posterTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
