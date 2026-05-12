import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluate } from "../src/llm/evaluate";
import { MockJudgeProvider } from "../src/llm/providers/mock";
import { JUDGE_PROMPT_VERSION } from "../src/llm/prompt";
import type { JudgeInput, JudgeProvider } from "../src/llm/types";

const BASE_INPUT: JudgeInput = {
  taskId: "test-task-1",
  title: "Build a thing",
  description: "Build a small thing that compiles",
  acceptanceCriteria: ["compiles", "runs"],
  deliverableText: "Here is the code",
  fileUrls: [],
};

describe("MockJudgeProvider", () => {
  const provider = new MockJudgeProvider();

  it("PASS_ME in deliverable → pass with confidence 1.0", async () => {
    const result = await provider.evaluate({
      ...BASE_INPUT,
      deliverableText: "PASS_ME the work is done",
    });
    expect(result.verdict).toBe("pass");
    expect(result.confidence).toBe(1.0);
    expect(result.failedCriteria).toHaveLength(0);
  });

  it("FAIL_ME in deliverable → fail with all criteria failed", async () => {
    const result = await provider.evaluate({
      ...BASE_INPUT,
      deliverableText: "FAIL_ME nothing works",
    });
    expect(result.verdict).toBe("fail");
    expect(result.confidence).toBe(1.0);
    expect(result.failedCriteria).toEqual(BASE_INPUT.acceptanceCriteria);
  });

  it("default → pass with confidence 0.7", async () => {
    const result = await provider.evaluate(BASE_INPUT);
    expect(result.verdict).toBe("pass");
    expect(result.confidence).toBe(0.7);
  });

  it("promptVersion is always included", async () => {
    const result = await provider.evaluate(BASE_INPUT);
    expect(result.promptVersion).toBe(JUDGE_PROMPT_VERSION);
  });

  it("model is 'mock'", async () => {
    const result = await provider.evaluate(BASE_INPUT);
    expect(result.model).toBe("mock");
  });
});

describe("evaluate() retry logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result immediately on first success", async () => {
    const provider = new MockJudgeProvider();
    const promise = evaluate(BASE_INPUT, provider);
    // Advance timers to flush any microtasks — should resolve without delays
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.verdict).toBe("pass");
  });

  it("returns unavailable after 3 consecutive failures", async () => {
    let calls = 0;
    const alwaysFails: JudgeProvider = {
      async evaluate() {
        calls++;
        throw new Error("provider down");
      },
    };

    const promise = evaluate(BASE_INPUT, alwaysFails);
    // Advance through all retry delays (1s + 4s + 16s)
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.verdict).toBe("unavailable");
    expect(result.promptVersion).toBe(JUDGE_PROMPT_VERSION);
    expect(calls).toBe(3);
  });

  it("succeeds on second attempt after one failure", async () => {
    let calls = 0;
    const failOnceThenPass: JudgeProvider = {
      async evaluate(input) {
        calls++;
        if (calls === 1) throw new Error("transient error");
        return new MockJudgeProvider().evaluate(input);
      },
    };

    const promise = evaluate(BASE_INPUT, failOnceThenPass);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.verdict).toBe("pass");
    expect(calls).toBe(2);
  });
});

describe("AnthropicJudgeProvider", () => {
  it("requires LLM_API_KEY (or apiKey opt) at construction", async () => {
    const original = process.env["LLM_API_KEY"];
    delete process.env["LLM_API_KEY"];
    const { AnthropicJudgeProvider } = await import(
      "../src/llm/providers/anthropic.js"
    );
    expect(() => new AnthropicJudgeProvider()).toThrow(/LLM_API_KEY is required/);
    if (original !== undefined) process.env["LLM_API_KEY"] = original;
  });
});

describe("selectProvider", () => {
  it("returns MockJudgeProvider when LLM_PROVIDER=mock", async () => {
    process.env["LLM_PROVIDER"] = "mock";
    const { selectProvider } = await import("../src/llm/select.js");
    const provider = selectProvider();
    expect(provider).toBeInstanceOf(MockJudgeProvider);
    delete process.env["LLM_PROVIDER"];
  });

  it("throws on unknown provider", async () => {
    process.env["LLM_PROVIDER"] = "unknown-provider";
    const { selectProvider } = await import("../src/llm/select.js");
    expect(() => selectProvider()).toThrow("Unknown LLM_PROVIDER");
    delete process.env["LLM_PROVIDER"];
  });
});
