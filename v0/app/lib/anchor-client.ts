import * as anchor from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/esm/nodewallet.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "./idl.json";
import type { TaskMarketplace } from "./idl-types";

export const PROGRAM_ID = new PublicKey("9Re1qpCeqaVAU984Au3YSCnGLQvkYc1UzVHqmeSNVi4A");
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";

export function getVerifierKeypair(): Keypair {
  const secret = JSON.parse(process.env.VERIFIER_KEYPAIR_SECRET!);
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function getServerProgram(): anchor.Program<TaskMarketplace> {
  const verifier = getVerifierKeypair();
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new NodeWallet(verifier);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new anchor.Program<TaskMarketplace>(idl as TaskMarketplace, provider);
}

export function getRegistryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID);
}

export function getTaskPda(taskId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync([Buffer.from("task"), buf], PROGRAM_ID);
}

export function getEscrowPda(taskId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(taskId);
  return PublicKey.findProgramAddressSync([Buffer.from("escrow"), buf], PROGRAM_ID);
}
