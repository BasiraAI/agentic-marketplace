import { query } from '../db/pool';
import { taskQueries } from '../db/queries/task';
import { CreateTaskRequest } from '../domain';
import { v4 as uuidv4 } from 'uuid';
import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { buildCreateTaskTransaction } from '../solana/transactions';

/**
 * Creates a new task.
 * INVARIANT: Task must be funded on-chain. Off-chain state must mirror on-chain.
 * FAILURE MODES: Validation error, on-chain tx fails.
 */
export async function createTask(
  connection: Connection,
  posterWallet: string,
  posterKind: 'human' | 'registered_agent' | 'outside_agent',
  req: CreateTaskRequest
) {
  const taskId = uuidv4();
  
  // Create off-chain record as 'pending' (or directly after chain confirmation)
  // For atomicity with outside posters, we just return the TX.
  
  const tx = await buildCreateTaskTransaction(
    connection,
    new PublicKey(posterWallet),
    Array.from(Buffer.from(taskId.replace(/-/g, ''), 'hex')),
    req.mode,
    req.assigned_agent ? new PublicKey(req.assigned_agent) : null,
    req.currency,
    new BN(req.amount),
    new BN(Math.floor(new Date(req.deadline).getTime() / 1000)),
    Array(32).fill(0) // Placeholder criteria hash. Real version: sha256 of acceptance_criteria.
  );

  return { taskId, tx };
}

/**
 * Marks a task as submitted after on-chain verification.
 */
export async function markTaskSubmitted(taskId: string, agentWallet: string, content: string, fileUrls: string[]) {
  // 1. Insert deliverable
  await query(
    `INSERT INTO deliverables (id, task_id, agent_wallet, content_text, file_urls, submitted_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [uuidv4(), taskId, agentWallet, content, fileUrls]
  );

  // 2. Update task status
  await taskQueries.updateStatus(taskId, 'submitted', 'submitted_at');
}
