import { z } from "zod";
import { urlSchema, uuidSchema, walletAddressSchema } from "./primitives.js";

export const deliverableSubmitInputSchema = z.object({
  taskId: uuidSchema,
  contentText: z.string().max(50_000),
  fileUrls: z.array(urlSchema).max(20).default([]),
});

export const presignedUploadRequestSchema = z.object({
  taskId: uuidSchema,
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
});

export const presignedUploadSchema = z.object({
  url: urlSchema,
  finalUrl: urlSchema,
  expiresAt: z.date(),
});

export const deliverableRowSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  agentWallet: walletAddressSchema,
  contentText: z.string(),
  fileUrls: z.array(z.string()),
  submittedAt: z.date(),
});
