import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import {
  agentsDb,
  signWebhookBody,
  verifyEd25519Signature,
} from "@basira/shared";
import { getLogger } from "../log.js";
import { loadArbitratorKeypair } from "../keys.js";

const HEALTH_TIMEOUT_MS = 10_000;
const MAX_FAILURES = 3;

export interface SweepResult {
  checked: number;
  ok: number;
  failed: number;
  deactivated: number;
}

interface AgentHealthResponse {
  protocol_version?: string;
  status?: string;
  signed_nonce?: string;
}

async function pingAgent(
  endpointUrl: string,
  body: { nonce: string; timestamp: string; signature: string },
): Promise<AgentHealthResponse> {
  const url = `${endpointUrl.replace(/\/$/, "")}/basira/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    return (await response.json()) as AgentHealthResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function runHealthCheckSweep(): Promise<SweepResult> {
  const log = getLogger().child({ cron: "health-check" });
  const agents = await agentsDb.listActiveAgents();
  let ok = 0;
  let failed = 0;
  let deactivated = 0;

  if (agents.length === 0) return { checked: 0, ok, failed, deactivated };

  const arbitrator = loadArbitratorKeypair();

  for (const agent of agents) {
    try {
      const nonce = randomBytes(16).toString("hex");
      const timestamp = String(Math.floor(Date.now() / 1000));
      // Basira's signature: HMAC over `${timestamp}.${nonce}` keyed by agent's webhook_secret.
      // (Matches webhook signing — agent verifies with its copy of the secret.)
      const sigInput = signWebhookBody(agent.webhook_secret ?? "", timestamp, nonce);

      const response = await pingAgent(agent.endpoint_url, {
        nonce,
        timestamp,
        signature: sigInput,
      });

      if (response.status !== "ok" || !response.signed_nonce) {
        throw new Error("agent did not return signed_nonce");
      }
      // Verify the agent's signature over the nonce against its wallet.
      const sigBytes = bs58.decode(response.signed_nonce);
      const ok2 = verifyEd25519Signature(
        new TextEncoder().encode(nonce),
        sigBytes,
        bs58.decode(agent.wallet),
      );
      if (!ok2) throw new Error("invalid signature on nonce");

      await agentsDb.recordHealthCheck(agent.wallet, new Date());
      ok++;
      // Suppress unused-var warning for arbitrator (reserved for future use as
      // the registrar key; currently we sign with the agent's own webhook secret).
      void arbitrator;
    } catch (err) {
      const failures = await agentsDb.incrementHealthFailure(agent.wallet);
      log.warn(
        { wallet: agent.wallet, err: err instanceof Error ? err.message : String(err), failures },
        "health-check failed",
      );
      failed++;
      if (failures >= MAX_FAILURES) {
        await agentsDb.setStatus(agent.wallet, "inactive");
        deactivated++;
      }
    }
  }

  log.info({ checked: agents.length, ok, failed, deactivated }, "health-check sweep done");
  return { checked: agents.length, ok, failed, deactivated };
}
