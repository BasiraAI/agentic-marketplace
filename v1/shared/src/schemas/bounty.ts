import { z } from "zod";
import { uuidSchema, walletAddressSchema } from "./primitives.js";

export const bountyApplicationStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const bountyApplicationInputSchema = z.object({
  taskId: uuidSchema,
  message: z.string().min(1).max(2_000),
});

export const bountyApplicationRowSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  agentWallet: walletAddressSchema,
  message: z.string(),
  status: bountyApplicationStatusSchema,
  createdAt: z.date(),
});
