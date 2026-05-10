import type { WebhookDeliveryRecord } from "../db/webhook-deliveries.js";
import {
  recordRetry,
  markPermanentlyFailed,
} from "../db/webhook-deliveries.js";

const RETRY_DELAYS_MS = [1_000, 4_000, 16_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

export async function scheduleNextRetry(
  delivery: WebhookDeliveryRecord,
  error: string,
): Promise<void> {
  const attempts = delivery.attempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await markPermanentlyFailed(delivery.id, error);
    return;
  }

  const delayMs = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  const nextRetryAt = new Date(Date.now() + delayMs);
  await recordRetry(delivery.id, attempts, nextRetryAt, error);
}
