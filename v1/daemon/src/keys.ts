import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";
import { getEnv } from "./env.js";

let keeperCache: Keypair | null = null;
let arbitratorCache: Keypair | null = null;

function load(path: string): Keypair {
  const absolute = resolve(path);
  const raw = readFileSync(absolute, "utf8");
  const bytes = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function loadKeeperKeypair(): Keypair {
  if (keeperCache) return keeperCache;
  keeperCache = load(getEnv().KEEPER_KEYPAIR_PATH);
  return keeperCache;
}

export function loadArbitratorKeypair(): Keypair {
  if (arbitratorCache) return arbitratorCache;
  arbitratorCache = load(getEnv().ARBITRATOR_KEYPAIR_PATH);
  return arbitratorCache;
}
