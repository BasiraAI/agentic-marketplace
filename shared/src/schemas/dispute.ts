import { z } from "zod";
import { urlSchema, uuidSchema, walletAddressSchema } from "./primitives";

export const disputeRulingSchema = z.enum(["agent", "poster"]);

export const disputeOpenInputSchema = z.object({
  taskId: uuidSchema,
  reason: z.string().min(1).max(5_000),
});

export const disputeResponseInputSchema = z.object({
  taskId: uuidSchema,
  response: z.string().min(1).max(5_000),
  evidenceUrls: z.array(urlSchema).max(20).default([]),
});

export const disputeResolveInputSchema = z.object({
  taskId: uuidSchema,
  ruling: disputeRulingSchema,
  notes: z.string().max(5_000),
});

export const disputeRowSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  openedBy: walletAddressSchema,
  reason: z.string(),
  agentResponse: z.string().nullable(),
  ruling: disputeRulingSchema.nullable(),
  rulingNotes: z.string().nullable(),
  openedAt: z.date(),
  resolvedAt: z.date().nullable(),
});
