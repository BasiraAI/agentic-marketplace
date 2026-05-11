import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira";
import { taskPda, vaultPda, agentPda, taskIdFromUuid } from "../pdas";
import { TREASURY_ADDRESS } from "../constants";
import { buildVersionedTx } from "./_tx";

interface ClaimAfterTimeoutBase {
  taskIdUuid: string;
  caller: PublicKey;
  posterWallet: PublicKey;
  agentWallet: PublicKey;
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}

export async function buildClaimAfterTimeoutSolTx({
  taskIdUuid,
  caller,
  posterWallet,
  agentWallet,
  payer,
  recentBlockhash,
  program,
}: ClaimAfterTimeoutBase): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const [agentAccount] = agentPda(agentWallet);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .claimAfterTimeoutSol()
    .accounts({
      caller,
      taskAccount,
      vault,
      posterWallet,
      agentWallet,
      agentAccount,
      treasury: TREASURY_ADDRESS,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}

export async function buildClaimAfterTimeoutUsdcTx({
  taskIdUuid,
  caller,
  posterWallet,
  agentWallet,
  payer,
  recentBlockhash,
  program,
  usdcMint,
}: ClaimAfterTimeoutBase & { usdcMint: PublicKey }): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const [agentAccount] = agentPda(agentWallet);
  const vaultTokenAccount = getAssociatedTokenAddressSync(usdcMint, vault, true);
  const agentTokenAccount = getAssociatedTokenAddressSync(usdcMint, agentWallet);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(usdcMint, TREASURY_ADDRESS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .claimAfterTimeoutUsdc()
    .accounts({
      caller,
      taskAccount,
      vault,
      posterWallet,
      agentWallet,
      agentAccount,
      treasury: TREASURY_ADDRESS,
      usdcMint,
      vaultTokenAccount,
      agentTokenAccount,
      treasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
