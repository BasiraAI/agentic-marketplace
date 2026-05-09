import { query } from '../db/pool';
import { v4 as uuidv4 } from 'uuid';

export async function applyToBounty(taskId: string, agentWallet: string, message: string) {
  const res = await query(
    `INSERT INTO bounty_applications (id, task_id, agent_wallet, message, status, created_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING *`,
    [uuidv4(), taskId, agentWallet, message]
  );
  return res.rows[0];
}
