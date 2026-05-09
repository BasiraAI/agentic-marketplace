import { query } from '@basira/shared/db/pool';

export async function runHealthChecks() {
  console.log('[Cron] Running health checks...');

  const res = await query(`SELECT wallet, endpoint_url FROM agents WHERE status = 'active'`);
  if (res.rowCount === 0) return;

  for (const _row of res.rows) {
    // Stub. Real implementation will:
    //   1. Generate a nonce.
    //   2. Ping the agent endpoint with it.
    //   3. After 3 consecutive failures, mark the agent inactive.
  }
}
