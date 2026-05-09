import { query } from '@basira/shared/db/pool';
import { dispatchWebhook } from '@basira/shared/notifications/webhook';

export async function runRetryWebhooks() {
  console.log('[Cron] Running webhook retries...');

  const res = await query(`
    SELECT w.id, w.agent_wallet, w.event, w.payload, w.attempts, a.endpoint_url, a.webhook_secret
    FROM webhook_deliveries w
    JOIN agents a ON w.agent_wallet = a.wallet
    WHERE w.status = 'failed' AND w.attempts < 3
  `);

  if (res.rowCount === 0) return;

  for (const row of res.rows) {
    try {
      await dispatchWebhook(
        row.agent_wallet,
        row.endpoint_url,
        row.webhook_secret,
        row.event,
        row.payload,
        row.id, // increment attempts on the existing row instead of inserting a new one
      );
      console.log(`Retried webhook ${row.id}`);
    } catch (err) {
      console.error(`Retry failed for webhook ${row.id}:`, err);
    }
  }
}
