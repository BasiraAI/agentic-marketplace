import { z } from "zod";
import {
  txSignatureSchema,
  uuidSchema,
  walletAddressSchema,
} from "./primitives";

export const settlementKindSchema = z.enum(["release", "refund", "fee"]);

export const settlementCurrencySchema = z.enum(["SOL", "USDC"]);

export const settlementRowSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  kind: settlementKindSchema,
  recipientWallet: walletAddressSchema,
  currency: settlementCurrencySchema,
  amount: z.bigint(),
  txSignature: txSignatureSchema,
  createdAt: z.date(),
});
