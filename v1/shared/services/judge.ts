import { LLMProvider } from '../llm/interface';
import { taskQueries } from '../db/queries/task';
import { query } from '../db/pool';

export async function evaluateDeliverable(provider: LLMProvider, taskId: string, deliverableContent: string) {
  const task = await taskQueries.getById(taskId);
  if (!task) throw new Error("Task not found");

  const verdict = await provider.evaluate(task, deliverableContent);

  await query(
    `INSERT INTO judge_verdicts (id, task_id, verdict, confidence, reasoning, failed_criteria, model, prompt_version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [verdict.id, verdict.task_id, verdict.verdict, verdict.confidence, verdict.reasoning, verdict.failed_criteria, verdict.model, verdict.prompt_version, verdict.created_at]
  );

  return verdict;
}
