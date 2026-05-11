import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { requireApiKey } from "@/lib/auth";
import { rotateApiKey, agentRotateApiKeyInputSchema } from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { z } from "zod";

export const POST = wrap(async (req: NextRequest) => {
  const { wallet } = await requireApiKey(req);

  const body = agentRotateApiKeyInputSchema.safeParse(await req.json());
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

  if (body.data.wallet !== wallet) {
    return NextResponse.json(
      {
        error: {
          code: "forbidden",
          message: "API key does not match the wallet",
        },
      },
      { status: 403 },
    );
  }

  let result: Awaited<ReturnType<typeof rotateApiKey>>;
  try {
    result = await rotateApiKey(body.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: err instanceof Error ? err.message : "Key rotation failed",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(serialize(result));
});

registry.registerPath({
  method: "post",
  path: "/api/v1/agents/rotate-api-key",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: agentRotateApiKeyInputSchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "API key rotated",
      content: {
        "application/json": {
          schema: z.object({ apiKey: z.string() }),
        },
      },
    },
  },
  tags: ["agents"],
});