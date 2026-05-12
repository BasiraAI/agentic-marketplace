import crypto from 'crypto';
import { query } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

/**
 * Send a webhook to an agent and record the delivery attempt.
 * - First-time send: pass `existingDeliveryId = undefined` → inserts a new row.
 * - Retry of an earlier failed send: pass the previous `id` → increments attempts.
 *
 * Returns true on 2xx response, false otherwise.
 */
export async function dispatchWebhook(
  agentWallet: string,
  endpointUrl: string,
  secret: string,
  event: string,
  payload: unknown,
  existingDeliveryId?: string,
): Promise<boolean> {
  const deliveryId = existingDeliveryId ?? uuidv4();
  const timestamp = Date.now().toString();
  const rawBody = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  let status: 'delivered' | 'failed' = 'failed';
  let lastError: string | null = null;

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Basira-Event': event,
        'X-Basira-Delivery-Id': deliveryId,
        'X-Basira-Signature': signature,
        'X-Basira-Timestamp': timestamp,
      },
      body: rawBody,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status = 'delivered';
  } catch (err: unknown) {
    status = 'failed';
    lastError = err instanceof Error ? err.message : String(err);
  }

  const deliveredAt = status === 'delivered' ? new Date() : null;

  if (existingDeliveryId) {
    // Retry path: bump attempts on the existing row.
    await query(
      `UPDATE webhook_deliveries
         SET status = $1,
             attempts = attempts + 1,
             last_error = $2,
             delivered_at = $3
       WHERE id = $4`,
      [status, lastError, deliveredAt, deliveryId],
    );
  } else {
    // First send.
    await query(
      `INSERT INTO webhook_deliveries
         (id, agent_wallet, event, payload, status, attempts, last_error, created_at, delivered_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), $7)`,
      [deliveryId, agentWallet, event, rawBody, status, lastError, deliveredAt],
    );
  }

  return status === 'delivered';
}
