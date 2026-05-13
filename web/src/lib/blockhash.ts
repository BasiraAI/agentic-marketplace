import { getLatestBlockhashWithRetry } from "@basira/shared";

export async function getRecentBlockhash(): Promise<string> {
  return getLatestBlockhashWithRetry();
}
