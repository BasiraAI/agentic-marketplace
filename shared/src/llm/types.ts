export interface JudgeInput {
  taskId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  deliverableText: string;
  fileUrls: string[];
}

export interface Verdict {
  verdict: "pass" | "fail" | "unavailable";
  confidence: number;
  reasoning: string;
  failedCriteria: string[];
  model: string;
  promptVersion: string;
}

export interface JudgeProvider {
  evaluate(input: JudgeInput): Promise<Verdict>;
}
