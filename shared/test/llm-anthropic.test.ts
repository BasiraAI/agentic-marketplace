import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

beforeEach(() => {
  createMock.mockReset();
});

describe("AnthropicJudgeProvider", () => {
  it("evaluates a valid response and returns a Verdict", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            verdict: "pass",
            confidence: 0.92,
            reasoning: "All criteria satisfied.",
            failedCriteria: [],
          }),
        },
      ],
    });
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    const provider = new AnthropicJudgeProvider({ apiKey: "test-key" });
    const verdict = await provider.evaluate({
      taskId: "00000000-0000-4000-8000-000000000000",
      title: "Add hello-world",
      description: "Add a CLI that prints hello",
      acceptanceCriteria: ["Compiles", "Prints hello"],
      deliverableText: "Done.",
      fileUrls: [],
    });
    expect(verdict.verdict).toBe("pass");
    expect(verdict.confidence).toBeCloseTo(0.92);
    expect(verdict.promptVersion).toBe("judge-v1");
    expect(verdict.model).toBe("claude-sonnet-4-6");
  });

  it("throws on malformed JSON (so the wrapper can retry)", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json at all" }],
    });
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    const provider = new AnthropicJudgeProvider({ apiKey: "test-key" });
    await expect(
      provider.evaluate({
        taskId: "00000000-0000-4000-8000-000000000000",
        title: "x",
        description: "x",
        acceptanceCriteria: ["x"],
        deliverableText: "x",
        fileUrls: [],
      }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("throws on schema-violating JSON (e.g. confidence > 1)", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            verdict: "pass",
            confidence: 99,
            reasoning: "ok",
            failedCriteria: [],
          }),
        },
      ],
    });
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    const provider = new AnthropicJudgeProvider({ apiKey: "test-key" });
    await expect(
      provider.evaluate({
        taskId: "00000000-0000-4000-8000-000000000000",
        title: "x",
        description: "x",
        acceptanceCriteria: ["x"],
        deliverableText: "x",
        fileUrls: [],
      }),
    ).rejects.toThrow();
  });

  it("constructs without LLM_API_KEY in env if apiKey opt is provided", async () => {
    const original = process.env["LLM_API_KEY"];
    delete process.env["LLM_API_KEY"];
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    expect(() => new AnthropicJudgeProvider({ apiKey: "k" })).not.toThrow();
    if (original !== undefined) process.env["LLM_API_KEY"] = original;
  });

  it("throws if no apiKey is provided", async () => {
    const original = process.env["LLM_API_KEY"];
    delete process.env["LLM_API_KEY"];
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    expect(() => new AnthropicJudgeProvider()).toThrow(/LLM_API_KEY is required/);
    if (original !== undefined) process.env["LLM_API_KEY"] = original;
  });
});
