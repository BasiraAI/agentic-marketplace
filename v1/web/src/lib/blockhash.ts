import { Connection } from "@solana/web3.js";

let cached: Connection | null = null;

function getConnection(): Connection {
  if (cached) return cached;
  const url = process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
  cached = new Connection(url, "confirmed");
  return cached;
}

export async function getRecentBlockhash(): Promise<string> {
  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  return blockhash;
}
