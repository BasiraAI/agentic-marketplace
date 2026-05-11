import type { JudgeInput, JudgeProvider, Verdict } from "./types.js";
import { JUDGE_PROMPT_VERSION } from "./prompt.js";

const RETRY_DELAYS_MS = [1_000, 4_000, 16_000];

export async function evaluate(
  input: JudgeInput,
  provider: JudgeProvider,
): Promise<Verdict> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await provider.evaluate(input);
    } catch (err) {
      lastError = err;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined && attempt < RETRY_DELAYS_MS.length - 1) {
        await sleep(delay);
      }
    }
  }

  console.error("Judge evaluate failed after all retries:", lastError);
  return {
    verdict: "unavailable",
    confidence: 0,
    reasoning: "Judge unavailable after retries.",
    failedCriteria: [],
    model: "none",
    promptVersion: JUDGE_PROMPT_VERSION,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
