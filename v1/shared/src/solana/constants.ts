import { PublicKey } from "@solana/web3.js";

export const FEE_BPS = 500;
export const AUTO_RELEASE_SECONDS = 86_400;
export const OFFER_RESPONSE_SECONDS = 60;
export const MIN_DEADLINE_BUFFER_SECONDS = 3_600;
export const MIN_REWARD_LAMPORTS = 10_000_000n;
export const MIN_REWARD_USDC_BASE_UNITS = 1_000_000n;

// Mirrors program/programs/basira/src/constants.rs — keep in sync manually.
export const TREASURY_ADDRESS = new PublicKey(
  "Bddo2ek21cs8SmArWa7c3GTu8VQnAiKzs7fc1T3AF2hc",
);
export const ARBITRATOR_ADDRESS = new PublicKey(
  "5Gb5kQe83EEQoUgEWtLShUpidb1R589g6yC6V26ANhLR",
);

// USDC mint addresses — program accepts whichever is passed; callers pick based on cluster.
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export const AGENT_SEED = Buffer.from("agent");
export const TASK_SEED = Buffer.from("task");
export const VAULT_SEED = Buffer.from("vault");
