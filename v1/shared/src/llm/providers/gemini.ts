import type { JudgeInput, JudgeProvider, Verdict } from "../types";
import { JUDGE_PROMPT_V1, JUDGE_PROMPT_VERSION } from "../prompt";
import { judgeOutputSchema } from "../../schemas/judge";

const DEFAULT_MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

export class GeminiJudgeProvider implements JudgeProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? process.env["LLM_API_KEY"];
    if (!apiKey) {
      throw new Error("GeminiJudgeProvider: LLM_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.model = opts?.model ?? DEFAULT_MODEL;
  }

  async evaluate(input: JudgeInput): Promise<Verdict> {
    const userPrompt = renderPrompt(input);
    const url = `${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GeminiJudgeProvider: HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as GeminiResponse;
    if (json.error) {
      throw new Error(`GeminiJudgeProvider: ${json.error.message ?? "unknown error"}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      throw new Error("GeminiJudgeProvider: empty response");
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `GeminiJudgeProvider: response was not valid JSON: ${text.slice(0, 200)}`,
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
