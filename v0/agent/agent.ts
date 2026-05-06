/**
 * Demo agent: polls the task marketplace for open tasks,
 * calls Gemini to generate a solution, and submits it.
 *
 * Usage:
 *   GEMINI_API_KEY=... AGENT_WALLET_SECRET=[...] MARKETPLACE_URL=http://localhost:3000 npx ts-node agent.ts
 */

import Groq from "groq-sdk";

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || "http://localhost:3000";
const AGENT_WALLET = process.env.AGENT_WALLET_SECRET
  ? JSON.parse(process.env.AGENT_WALLET_SECRET)
  : null;

async function getAgentPublicKey(): Promise<string> {
  const { Keypair } = await import("@solana/web3.js");
  if (!AGENT_WALLET) throw new Error("AGENT_WALLET_SECRET not set");
  const kp = Keypair.fromSecretKey(Uint8Array.from(AGENT_WALLET));
  return kp.publicKey.toBase58();
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Task {
  taskId: string;
  title: string;
  description: string;
  testSpec: string;
  rewardSol: number;
  status: string;
}

async function fetchOpenTasks(): Promise<Task[]> {
  const res = await fetch(`${MARKETPLACE_URL}/api/tasks`);
  const tasks = await res.json() as Task[];
  return tasks.filter((t) => t.status === "open" || t.status === "failed");
}

async function generateSolution(description: string, testSpec: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: `You are an expert programmer. Write code that satisfies the following task.
Return ONLY the code, no explanation, no markdown fences.

## Task Description
${description}

## Requirements / Spec
${testSpec}

Write clean, correct code that passes these requirements.`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function submitSolution(taskId: string, solver: string, code: string) {
  const res = await fetch(`${MARKETPLACE_URL}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, solver, code }),
  });
  return res.json();
}

const attemptedTasks = new Set<string>();

async function tick(agentPublicKey: string) {
  const tasks = await fetchOpenTasks();

  for (const task of tasks) {
    if (attemptedTasks.has(task.taskId)) continue;

    console.log(`\n[Agent] Found task #${task.taskId}: "${task.title}" (${task.rewardSol} SOL)`);

    try {
      console.log(`[Agent] Generating solution with Gemini...`);
      const code = await generateSolution(task.description, task.testSpec);
      console.log(`[Agent] Solution generated (${code.length} chars). Submitting...`);

      const result = await submitSolution(task.taskId, agentPublicKey, code) as any;
      console.log(`[Agent] Verdict: ${result.verdict} — ${result.reason}`);

      if (result.verdict === "pass") {
        console.log(`[Agent] ✓ SOL released to agent wallet!`);
      }

      attemptedTasks.add(task.taskId);
    } catch (err) {
      console.error(`[Agent] Error processing task #${task.taskId}:`, err);
    }
  }
}

async function main() {
  const agentPublicKey = await getAgentPublicKey();
  console.log(`[Agent] Starting. Wallet: ${agentPublicKey}`);
  console.log(`[Agent] Polling ${MARKETPLACE_URL} every 10 seconds...\n`);

  await tick(agentPublicKey);
  setInterval(() => tick(agentPublicKey), 10_000);
}

main().catch(console.error);
