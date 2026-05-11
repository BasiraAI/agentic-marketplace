import { z } from "zod";
import { uuidSchema } from "./primitives";

export const judgeVerdictSchema = z.enum(["pass", "fail", "unavailable"]);

export const judgeOutputSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(10_000),
  failedCriteria: z.array(z.string()).default([]),
});

export const judgeVerdictRowSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  verdict: judgeVerdictSchema,
  confidence: z.number(),
  reasoning: z.string(),
  failedCriteria: z.array(z.string()),
  model: z.string(),
  promptVersion: z.string(),
  createdAt: z.date(),
});
