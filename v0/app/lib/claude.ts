import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a code verifier for a task marketplace. Determine whether submitted code satisfies the task specification. Be objective and strict. Base your verdict solely on functional correctness — ignore style, comments, or anything outside the spec.`;

export type Verdict = "pass" | "fail" | "inconclusive";

export interface VerificationResult {
  verdict: Verdict;
  reason: string;
}

export async function verifyCode(
  description: string,
  testSpec: string,
  code: string
): Promise<VerificationResult> {
  const prompt = `${SYSTEM_PROMPT}

## Task Description
${description}

## Verification Spec
${testSpec}

## Submitted Code
\`\`\`
${code}
\`\`\`

Does this code satisfy the task spec? Respond ONLY with valid JSON in this exact format:
{"verdict": "pass" | "fail" | "inconclusive", "reason": "one sentence explanation"}

Use "inconclusive" only if evaluation requires running external dependencies that cannot be determined by reading the code.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean) as { verdict: string; reason: string };

    const verdict = ["pass", "fail", "inconclusive"].includes(parsed.verdict)
      ? (parsed.verdict as Verdict)
      : "inconclusive";

    return { verdict, reason: parsed.reason || "No reason provided" };
  } catch {
    return { verdict: "inconclusive", reason: "Verification error — treating as inconclusive" };
  }
}
