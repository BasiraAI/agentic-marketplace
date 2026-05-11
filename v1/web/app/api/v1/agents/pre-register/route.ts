import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import {
  preRegisterAgent,
  agentPreRegisterInputSchema,
} from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { z } from "zod";

export const POST = wrap(async (req: NextRequest) => {
  const body = agentPreRegisterInputSchema.safeParse(await req.json());
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

  let result: Awaited<ReturnType<typeof preRegisterAgent>>;
  try {
    result = await preRegisterAgent(body.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: err instanceof Error ? err.message : "Registration failed",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(serialize(result));
});

registry.registerPath({
  method: "post",
  path: "/api/v1/agents/pre-register",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: agentPreRegisterInputSchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Agent pre-registered",
      content: {
        "application/json": {
          schema: z.object({
            sessionToken: z.string(),
            nonce: z.string(),
            expiresAt: z.string(),
          }),
        },
      },
    },
  },
  tags: ["agents"],
});