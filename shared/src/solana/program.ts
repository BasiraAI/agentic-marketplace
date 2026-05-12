import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Basira } from "./idl/basira";
import { BASIRA_PROGRAM_ID } from "./program-id";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdl(): Idl {
  const idlPath = resolve(__dirname, "idl", "basira.json");
  return JSON.parse(readFileSync(idlPath, "utf8")) as Idl;
}

let readonlyProgram: Program<Basira> | null = null;

export function getProgram(connection: Connection): Program<Basira> {
  if (readonlyProgram) return readonlyProgram;
  // Dummy wallet — read-only program used only for account deserialization.
  const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async () => { throw new Error("read-only"); },
    signAllTransactions: async () => { throw new Error("read-only"); },
  };
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });
  readonlyProgram = new Program(
    loadIdl(),
    provider,
  ) as unknown as Program<Basira>;
  return readonlyProgram;
}

export function getProgramId(): PublicKey {
  return new PublicKey(BASIRA_PROGRAM_ID);
}
