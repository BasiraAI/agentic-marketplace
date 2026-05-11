import {
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira";
import { taskPda, vaultPda, taskIdFromUuid } from "../pdas";
import { buildVersionedTx } from "./_tx";

interface CancelTaskBase {
  taskIdUuid: string;
  poster: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}

export async function buildCancelTaskSolTx({
  taskIdUuid,
  poster,
  payer,
  recentBlockhash,
  program,
}: CancelTaskBase): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .cancelTaskSol()
    .accounts({ poster, taskAccount, vault })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}

export async function buildCancelTaskUsdcTx({
  taskIdUuid,
  poster,
  payer,
  recentBlockhash,
  program,
  usdcMint,
}: CancelTaskBase & { usdcMint: PublicKey }): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const posterTokenAccount = getAssociatedTokenAddressSync(usdcMint, poster);
  const vaultTokenAccount = getAssociatedTokenAddressSync(usdcMint, vault, true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .cancelTaskUsdc()
    .accounts({
      poster,
      taskAccount,
      vault,
      usdcMint,
      vaultTokenAccount,
      posterTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
