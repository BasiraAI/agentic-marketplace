import type { Selectable } from "kysely";
import { getDb } from "./kysely";
import type { JudgeVerdictsTable } from "./types";

export type JudgeVerdictRecord = Selectable<JudgeVerdictsTable>;

export async function insertVerdict(input: {
  taskId: string;
  verdict: "pass" | "fail" | "unavailable";
  confidence: number;
  reasoning: string;
  failedCriteria: string[];
  model: string;
  promptVersion: string;
}): Promise<JudgeVerdictRecord> {
  return getDb()
    .insertInto("judge_verdicts")
    .values({
      task_id: input.taskId,
      verdict: input.verdict,
      confidence: input.confidence.toString(),
      reasoning: input.reasoning,
      failed_criteria: input.failedCriteria,
      model: input.model,
      prompt_version: input.promptVersion,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function getLatestVerdictForTask(
  taskId: string,
): Promise<JudgeVerdictRecord | undefined> {
  return getDb()
    .selectFrom("judge_verdicts")
    .selectAll()
    .where("task_id", "=", taskId)
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
}
