import nacl from "tweetnacl";
import bs58 from "bs58";

export function verifyEd25519Signature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export interface SiwsMessageParams {
  domain: string;
  wallet: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

export function buildSiwsMessage({
  domain,
  wallet,
  nonce,
  issuedAt,
  expiresAt,
}: SiwsMessageParams): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to Basira",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");
}

export function decodeBase58(encoded: string): Uint8Array {
  return bs58.decode(encoded);
}
