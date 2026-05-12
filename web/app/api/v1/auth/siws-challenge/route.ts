import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { wrap } from "@/lib/handler";
import {
  buildSiwsMessage,
  sessionsDb,
  noncesDb,
} from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { z } from "zod";

const SIWS_MESSAGE_TTL_MS = 5 * 60 * 1000;

const ChallengeBodySchema = z.object({
  wallet: z.string().min(1),
});

export const POST = wrap(async (req: NextRequest) => {
  const body = ChallengeBodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Invalid request body",
          details: body.error.issues,
        },
      },
      { status: 400 },
    );
  }

  const { wallet } = body.data;
  const nonce = randomBytes(16).toString("base64url");
  const issuedAt = new Date();
  const expiresAt = new Date(Date.now() + SIWS_MESSAGE_TTL_MS);

  const consumed = await noncesDb.consumeNonce(nonce);
  if (!consumed) {
    return NextResponse.json(
      { error: { code: "conflict", message: "Nonce already exists" } },
      { status: 409 },
    );
  }

  const sessionToken = `nonce_${randomBytes(16).toString("hex")}`;
  await sessionsDb.issueSession({
    token: sessionToken,
    kind: "siws",
    wallet,
    data: { stage: "challenge", nonce },
    expiresAt,
  });

  const domain =
    process.env["SIWS_DOMAIN"] ?? req.headers.get("host") ?? "localhost";
  const message = buildSiwsMessage({
    domain,
    wallet,
    nonce,
    issuedAt,
    expiresAt,
  });

  return NextResponse.json(
    serialize({ message, nonce, expiresAt, sessionToken }),
  );
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/siws-challenge",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChallengeBodySchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "SIWS challenge generated",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            nonce: z.string(),
            expiresAt: z.string(),
            sessionToken: z.string(),
          }),
        },
      },
    },
  },
  tags: ["auth"],
});