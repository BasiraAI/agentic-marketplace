import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookBody(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export interface WebhookHeaders {
  "x-basira-timestamp"?: string;
  "x-basira-signature"?: string;
  [key: string]: string | undefined;
}

const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhookSignature(
  secret: string,
  headers: WebhookHeaders,
  rawBody: string,
): boolean {
  const timestamp = headers["x-basira-timestamp"];
  const signature = headers["x-basira-signature"];
  if (!timestamp || !signature) return false;

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > TOLERANCE_SECONDS) return false;

  const expected = signWebhookBody(secret, timestamp, rawBody);
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
