import bs58 from "bs58";
import { z } from "zod";

export const walletAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .refine(
    (s) => {
      try {
        return bs58.decode(s).length === 32;
      } catch {
        return false;
      }
    },
    { message: "must be a base58-encoded 32-byte Solana address" },
  );

export const uuidSchema = z.string().uuid();

export const lamportsSchema = z.bigint().positive();

export const usdcBaseUnitsSchema = z.bigint().positive();

export const unixSecondsSchema = z.bigint().positive();

export const acceptanceCriteriaSchema = z
  .array(z.string().min(1).max(500))
  .min(1)
  .max(20);

export const urlSchema = z.string().url();

export const txSignatureSchema = z
  .string()
  .min(64)
  .max(96)
  .refine((s) => {
    try {
      const len = bs58.decode(s).length;
      return len === 64;
    } catch {
      return false;
    }
  }, { message: "must be a base58-encoded 64-byte signature" });
