import { query } from '@basira/shared/db/pool';
// import { buildClaimAfterTimeoutTransaction } from '@basira/shared/solana/transactions';
import { Connection } from '@solana/web3.js';

export async function runAutoRelease(_connection: Connection) {
  console.log('[Cron] Running auto-release sweep...');

  // 1. Query for tasks submitted > 24h ago with judge verdict = 'pass' or 'unavailable'
  const res = await query(`
    SELECT t.task_id, t.poster_wallet 
    FROM tasks t
    LEFT JOIN judge_verdicts j ON t.task_id = j.task_id
    WHERE t.status = 'submitted'
      AND t.submitted_at < NOW() - INTERVAL '24 hours'
      AND (j.verdict = 'pass' OR j.verdict = 'unavailable')
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.task_id = t.task_id)
  `);

  if (res.rowCount === 0) return;

  for (const row of res.rows) {
    try {
      // 2. Build and send claim_after_timeout transaction via Keeper key
      // const tx = await buildClaimAfterTimeoutTransaction(...)
      // await connection.sendTransaction(tx, [keeperKeypair]);
      console.log(`Auto-released task ${row.task_id}`);
    } catch (err) {
      console.error(`Failed to auto-release task ${row.task_id}:`, err);
    }
  }
}
