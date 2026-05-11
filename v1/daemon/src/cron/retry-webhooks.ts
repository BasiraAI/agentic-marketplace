import {
  webhookDeliveriesDb,
  agentsDb,
  dispatchWebhook,
  scheduleNextRetry,
  type WebhookEvent,
} from "@basira/shared";
import { getLogger } from "../log.js";

export interface SweepResult {
  swept: number;
  delivered: number;
  retried: number;
  failed: number;
}

const BATCH = 50;

export async function runWebhookRetrySweep(): Promise<SweepResult> {
  const log = getLogger().child({ cron: "retry-webhooks" });
  const due = await webhookDeliveriesDb.claimReadyForRetry(new Date(), BATCH);
  let delivered = 0;
  let retried = 0;
  let failed = 0;

  if (due.length === 0) return { swept: 0, delivered, retried, failed };

  for (const delivery of due) {
    try {
      const agent = await agentsDb.getAgentByWallet(delivery.agent_wallet);
      if (!agent || !agent.endpoint_url || !agent.webhook_secret) {
        await webhookDeliveriesDb.markPermanentlyFailed(
          delivery.id,
          "Agent endpoint or secret missing",
        );
        failed++;
        continue;
      }
      const result = await dispatchWebhook({
        agent: { endpointUrl: agent.endpoint_url, webhookSecret: agent.webhook_secret },
        event: delivery.event as WebhookEvent,
        payload: delivery.payload as Record<string, unknown>,
      });
      if (result.delivered) {
        await webhookDeliveriesDb.markDelivered(delivery.id);
        delivered++;
      } else {
        await scheduleNextRetry(delivery, result.error ?? `status ${result.status}`);
        // After-state may be either pending (with next_retry_at) or failed
        // (if attempts == MAX_ATTEMPTS). We don't recheck — categorize by attempts.
        if (delivery.attempts + 1 >= 3) failed++;
        else retried++;
      }
    } catch (err) {
      log.error({ err, deliveryId: delivery.id }, "retry-webhook iteration failed");
      await scheduleNextRetry(delivery, err instanceof Error ? err.message : String(err));
    }
  }

  log.info({ swept: due.length, delivered, retried, failed }, "webhook retry sweep done");
  return { swept: due.length, delivered, retried, failed };
}
