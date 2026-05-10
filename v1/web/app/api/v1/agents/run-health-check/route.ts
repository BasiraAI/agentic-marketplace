import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { runHealthCheck } from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { z } from "zod";

const RunHealthCheckBodySchema = z.object({
  sessionToken: z.string().min(16),
});

export const POST = wrap(async (req: NextRequest) => {
  const body = RunHealthCheckBodySchema.safeParse(await req.json());
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
    await runHealthCheck(body.data.sessionToken);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: err instanceof Error ? err.message : "Health check failed",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(serialize({ ok: true }));
});

registry.registerPath({
  method: "post",
  path: "/api/v1/agents/run-health-check",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RunHealthCheckBodySchema,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Health check completed",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean() }),
        },
      },
    },
  },
  tags: ["agents"],
});