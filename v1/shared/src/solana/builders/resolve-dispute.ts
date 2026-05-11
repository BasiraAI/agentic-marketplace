import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import type { Basira } from "../idl/basira";
import { taskPda, vaultPda, agentPda, taskIdFromUuid } from "../pdas";
import { TREASURY_ADDRESS, ARBITRATOR_ADDRESS } from "../constants";
import { buildVersionedTx } from "./_tx";

interface ResolveDisputeBase {
  taskIdUuid: string;
  posterWallet: PublicKey;
  agentWallet: PublicKey;
  ruling: "forAgent" | "forPoster";
  payer: PublicKey;
  recentBlockhash: string;
  program: Program<Basira>;
}

export async function buildResolveDisputeSolTx({
  taskIdUuid,
  posterWallet,
  agentWallet,
  ruling,
  payer,
  recentBlockhash,
  program,
}: ResolveDisputeBase): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const [agentAccount] = agentPda(agentWallet);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .resolveDisputeSol(ruling === "forAgent" ? { forAgent: {} } : { forPoster: {} })
    .accounts({
      arbitrator: ARBITRATOR_ADDRESS,
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

export async function buildResolveDisputeUsdcTx({
  taskIdUuid,
  posterWallet,
  agentWallet,
  ruling,
  payer,
  recentBlockhash,
  program,
  usdcMint,
}: ResolveDisputeBase & { usdcMint: PublicKey }): Promise<{ tx: VersionedTransaction }> {
  const taskIdBytes = taskIdFromUuid(taskIdUuid);
  const [taskAccount] = taskPda(taskIdBytes);
  const [vault] = vaultPda(taskIdBytes);
  const [agentAccount] = agentPda(agentWallet);
  const vaultTokenAccount = getAssociatedTokenAddressSync(usdcMint, vault, true);
  const agentTokenAccount = getAssociatedTokenAddressSync(usdcMint, agentWallet);
  const posterTokenAccount = getAssociatedTokenAddressSync(usdcMint, posterWallet);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(usdcMint, TREASURY_ADDRESS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ix = await (program.methods as any)
    .resolveDisputeUsdc(ruling === "forAgent" ? { forAgent: {} } : { forPoster: {} })
    .accounts({
      arbitrator: ARBITRATOR_ADDRESS,
      taskAccount,
      vault,
      posterWallet,
      agentWallet,
      agentAccount,
      treasury: TREASURY_ADDRESS,
      usdcMint,
      vaultTokenAccount,
      agentTokenAccount,
      posterTokenAccount,
      treasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
    })
    .instruction();

  return { tx: buildVersionedTx(payer, recentBlockhash, [ix]) };
}
