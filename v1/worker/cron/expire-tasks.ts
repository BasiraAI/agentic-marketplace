import { query } from '@basira/shared/db/pool';
import { Connection } from '@solana/web3.js';

export async function runExpireTasks(_connection: Connection) {
  console.log('[Cron] Running expire-tasks sweep...');

  const res = await query(`
    SELECT task_id, poster_wallet 
    FROM tasks
    WHERE status IN ('created', 'assigned')
      AND deadline < NOW()
  `);

  if (res.rowCount === 0) return;

  for (const row of res.rows) {
    try {
      // Build and send expire_task via Keeper key
      console.log(`Expired task ${row.task_id}`);
    } catch (err) {
      console.error(`Failed to expire task ${row.task_id}:`, err);
    }
  }
}
