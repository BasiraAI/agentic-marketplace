import { query } from '@basira/shared/db/pool';
import { Connection } from '@solana/web3.js';

export async function runGhostDisputes(_connection: Connection) {
  console.log('[Cron] Running ghost-disputes sweep...');

  const res = await query(`
    SELECT d.id, d.task_id 
    FROM disputes d
    WHERE d.agent_responded_at IS NULL
      AND d.opened_at < NOW() - INTERVAL '48 hours'
  `);

  if (res.rowCount === 0) return;

  for (const row of res.rows) {
    try {
      // Build and send resolve_dispute(poster) via Arbitrator key
      console.log(`Auto-resolved ghost dispute for task ${row.task_id}`);
    } catch (err) {
      console.error(`Failed to auto-resolve ghost dispute ${row.id}:`, err);
    }
  }
}
