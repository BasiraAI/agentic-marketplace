import { randomUUID } from "node:crypto";
import { signWebhookBody } from "./sign";
import type { WebhookEvent, WebhookDispatchResult } from "./types";

const DISPATCH_TIMEOUT_MS = 10_000;

export interface AgentEndpoint {
  endpointUrl: string;
  webhookSecret: string;
}

export async function dispatchWebhook({
  agent,
  event,
  payload,
}: {
  agent: AgentEndpoint;
  event: WebhookEvent;
  payload: Record<string, unknown>;
}): Promise<WebhookDispatchResult> {
  const deliveryId = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(payload);
  const signature = signWebhookBody(agent.webhookSecret, timestamp, body);

  // event name → path segment: "task.offered" → "task.offered"
  const url = `${agent.endpointUrl.replace(/\/$/, "")}/basira/${event}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Basira-Event": event,
        "X-Basira-Delivery-Id": deliveryId,
        "X-Basira-Timestamp": timestamp,
        "X-Basira-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    return { delivered: response.ok, status: response.status };
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
