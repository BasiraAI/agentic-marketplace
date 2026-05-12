/**
 * Airdrops SOL to demo keypairs on devnet.
 * Falls back gracefully if already funded.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RPC = process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
const KEYPAIRS_DIR = resolve(__dirname, "..", "..", "keypairs");
const MIN_BALANCE = 0.1 * LAMPORTS_PER_SOL;
const TARGET_BALANCE = 1 * LAMPORTS_PER_SOL;

function loadKeypair(name: string): Keypair {
  const bytes = JSON.parse(readFileSync(resolve(KEYPAIRS_DIR, name), "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function fundIfLow(connection: Connection, kp: Keypair, label: string): Promise<void> {
  const balance = await connection.getBalance(kp.publicKey);
  if (balance >= MIN_BALANCE) {
    console.log(`  ${label}: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL — already funded`);
    return;
  }
  const needed = TARGET_BALANCE - balance;
  console.log(`  ${label}: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL — requesting airdrop…`);
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, needed);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    const after = await connection.getBalance(kp.publicKey);
    console.log(`  ${label}: funded → ${(after / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  } catch (err) {
    console.warn(`  ${label}: airdrop failed (rate-limited?) — ${err instanceof Error ? err.message : err}`);
  }
}

async function main(): Promise<void> {
  const connection = new Connection(RPC, "confirmed");
  const posterKp = loadKeypair("treasury.json");
  const agentKp = loadKeypair("keeper.json");

  console.log("Funding devnet keypairs…");
  await fundIfLow(connection, posterKp, "poster (treasury)");
  await fundIfLow(connection, agentKp, "agent  (keeper)");
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
