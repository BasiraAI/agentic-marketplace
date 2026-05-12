import { z } from "zod";
import { walletAddressSchema } from "./primitives";

export const siwsMessageSchema = z.object({
  domain: z.string().min(1),
  wallet: walletAddressSchema,
  nonce: z.string().min(8),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const siwsVerifyInputSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  publicKey: walletAddressSchema,
});
