import type { VersionedTransaction, PublicKey } from "@solana/web3.js";

/**
 * Recursively walks an object and converts:
 *  - bigint → base-10 string
 *  - PublicKey → base58 string (via toBase58())
 *  - VersionedTransaction → base64 string (serialized message + signatures)
 *  - Date → ISO string
 *  - Buffer / Uint8Array → base64 string
 *
 * Plain objects and arrays are recursed into.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(value: any): any {
  if (value === null || value === undefined) return value;

  if (typeof value === "bigint") return value.toString();

  if (typeof value !== "object") return value;

  if (value instanceof Date) return value.toISOString();

  // PublicKey duck-typing (it has toBase58)
  if (typeof (value as { toBase58?: unknown }).toBase58 === "function") {
    return (value as PublicKey).toBase58();
  }

  // VersionedTransaction duck-typing (it has .serialize() returning Uint8Array)
  if (
    typeof (value as { serialize?: unknown }).serialize === "function" &&
    "message" in value &&
    "signatures" in value
  ) {
    const bytes = (value as VersionedTransaction).serialize();
    return Buffer.from(bytes).toString("base64");
  }

  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");

  if (Array.isArray(value)) return value.map((v) => serialize(v));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
  return out;
}

export function serializeTx(tx: VersionedTransaction): string {
  return Buffer.from(tx.serialize()).toString("base64");
}
