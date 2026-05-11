import { PublicKey } from "@solana/web3.js";
import { BASIRA_PROGRAM_ID } from "./program-id.js";
import { AGENT_SEED, TASK_SEED, VAULT_SEED } from "./constants.js";

const programId = new PublicKey(BASIRA_PROGRAM_ID);

export function taskIdFromUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function uuidFromTaskId(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function agentPda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [AGENT_SEED, wallet.toBuffer()],
    programId,
  );
}

export function taskPda(taskIdBytes: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TASK_SEED, Buffer.from(taskIdBytes)],
    programId,
  );
}

export function vaultPda(taskIdBytes: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, Buffer.from(taskIdBytes)],
    programId,
  );
}
