import { query } from '@basira/shared/db/pool';
// import { buildOpenDisputeTransaction } from '@basira/shared/solana/transactions';
import { Connection } from '@solana/web3.js';

export async function runAutoDispute(_connection: Connection) {
  console.log('[Cron] Running auto-dispute sweep...');

  // 1. Query tasks submitted > 24h ago with judge verdict = 'fail' and no poster action
  const res = await query(`
    SELECT t.task_id, t.poster_wallet 
    FROM tasks t
    JOIN judge_verdicts j ON t.task_id = j.task_id
    WHERE t.status = 'submitted'
      AND t.submitted_at < NOW() - INTERVAL '24 hours'
      AND j.verdict = 'fail'
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.task_id = t.task_id)
  `);

  if (res.rowCount === 0) return;

  for (const row of res.rows) {
    try {
      // 2. Build and send open_dispute transaction via Arbitrator key
      // const tx = await buildOpenDisputeTransaction(...)
      // await connection.sendTransaction(tx, [arbitratorKeypair]);
      console.log(`Auto-disputed task ${row.task_id}`);
    } catch (err) {
      console.error(`Failed to auto-dispute task ${row.task_id}:`, err);
    }
  }
}
