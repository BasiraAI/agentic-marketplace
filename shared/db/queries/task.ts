import { query } from '../pool';
import { Task } from '../../domain';

export const taskQueries = {
  async getById(taskId: string): Promise<Task | null> {
    const res = await query('SELECT * FROM tasks WHERE task_id = $1', [taskId]);
    return res.rows[0] || null;
  },

  async create(task: Task): Promise<Task> {
    const res = await query(
      `INSERT INTO tasks (
        task_id, poster_wallet, poster_kind, assigned_agent, mode, title, 
        description, acceptance_criteria, currency, amount, deadline, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        task.task_id, task.poster_wallet, task.poster_kind, task.assigned_agent,
        task.mode, task.title, task.description, task.acceptance_criteria,
        task.currency, task.amount, task.deadline, task.status, task.created_at
      ]
    );
    return res.rows[0];
  },

  async updateStatus(taskId: string, status: string, timestampField?: string): Promise<void> {
    if (timestampField) {
      await query(`UPDATE tasks SET status = $1, ${timestampField} = NOW() WHERE task_id = $2`, [status, taskId]);
    } else {
      await query(`UPDATE tasks SET status = $1 WHERE task_id = $2`, [status, taskId]);
    }
  }
};
