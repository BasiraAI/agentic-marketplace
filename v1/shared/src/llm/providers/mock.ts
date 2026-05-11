import type { JudgeInput, JudgeProvider, Verdict } from "../types";
import { JUDGE_PROMPT_VERSION } from "../prompt";

export class MockJudgeProvider implements JudgeProvider {
  async evaluate(input: JudgeInput): Promise<Verdict> {
    const text = input.deliverableText;

    if (text.includes("FAIL_ME")) {
      return {
        verdict: "fail",
        confidence: 1.0,
        reasoning: "Deliverable explicitly requested failure.",
        failedCriteria: input.acceptanceCriteria,
        model: "mock",
        promptVersion: JUDGE_PROMPT_VERSION,
      };
    }

    if (text.includes("PASS_ME")) {
      return {
        verdict: "pass",
        confidence: 1.0,
        reasoning: "Deliverable explicitly requested pass.",
        failedCriteria: [],
        model: "mock",
        promptVersion: JUDGE_PROMPT_VERSION,
      };
    }

    return {
      verdict: "pass",
      confidence: 0.7,
      reasoning: "Mock provider default: pass with moderate confidence.",
      failedCriteria: [],
      model: "mock",
      promptVersion: JUDGE_PROMPT_VERSION,
    };
  }
}
