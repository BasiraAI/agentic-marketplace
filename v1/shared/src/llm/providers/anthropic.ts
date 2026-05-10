import Anthropic from "@anthropic-ai/sdk";
import type { JudgeInput, JudgeProvider, Verdict } from "../types.js";
import { JUDGE_PROMPT_V1, JUDGE_PROMPT_VERSION } from "../prompt.js";
import { judgeOutputSchema } from "../../schemas/judge.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

function renderPrompt(input: JudgeInput): string {
  const criteriaList = input.acceptanceCriteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");
  const fileSection =
    input.fileUrls.length > 0
      ? `## Attached files\n${input.fileUrls.map((u) => `- ${u}`).join("\n")}`
      : "";
  return JUDGE_PROMPT_V1.replace("{{title}}", input.title)
    .replace("{{description}}", input.description)
    .replace("{{acceptance_criteria}}", criteriaList)
    .replace("{{deliverable_text}}", input.deliverableText)
    .replace("{{file_urls_section}}", fileSection);
}

function extractText(message: Anthropic.Messages.Message): string {
  const parts = message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text);
  return parts.join("");
}

export class AnthropicJudgeProvider implements JudgeProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? process.env["LLM_API_KEY"];
    if (!apiKey) {
      throw new Error("AnthropicJudgeProvider: LLM_API_KEY is required");
    }
    this.client = new Anthropic({ apiKey });
    this.model = opts?.model ?? DEFAULT_MODEL;
  }

  async evaluate(input: JudgeInput): Promise<Verdict> {
    const userPrompt = renderPrompt(input);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = extractText(response);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `AnthropicJudgeProvider: response was not valid JSON: ${text.slice(0, 200)}`,
        { cause: err },
      );
    }
    const validated = judgeOutputSchema.parse(parsed);
    return {
      verdict: validated.verdict,
      confidence: validated.confidence,
      reasoning: validated.reasoning,
      failedCriteria: validated.failedCriteria,
      model: this.model,
      promptVersion: JUDGE_PROMPT_VERSION,
    };
  }
}
