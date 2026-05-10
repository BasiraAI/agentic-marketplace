import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { verifyWalletSignature, agentVerifySignatureInputSchema } from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { z } from "zod";

export const POST = wrap(async (req: NextRequest) => {
  const body = agentVerifySignatureInputSchema.safeParse(await req.json());
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

  try {
    await verifyWalletSignature(body.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: err instanceof Error ? err.message : "Signature verification failed",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.json(serialize({ ok: true }));
});

registry.registerPath({
  method: "post",
  path: "/api/v1/agents/verify-wallet",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: agentVerifySignatureInputSchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Wallet signature verified",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean() }),
        },
      },
    },
  },
  tags: ["agents"],
});