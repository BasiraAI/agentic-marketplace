import type { JudgeProvider } from "./types.js";
import { MockJudgeProvider } from "./providers/mock.js";
import { AnthropicJudgeProvider } from "./providers/anthropic.js";

export function selectProvider(): JudgeProvider {
  const name = process.env["LLM_PROVIDER"] ?? "mock";
  switch (name) {
    case "mock":
      return new MockJudgeProvider();
    case "anthropic":
      return new AnthropicJudgeProvider();
    default:
      throw new Error(`Unknown LLM_PROVIDER: "${name}"`);
  }
}
