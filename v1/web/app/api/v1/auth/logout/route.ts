import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { sessionsDb } from "@basira/shared";
import { serialize } from "@/lib/serialize";
import { registry } from "@/lib/openapi";
import { SESSION_COOKIE_NAME, requireSiws } from "@/lib/auth";
import { z } from "zod";

export const POST = wrap(async (req: NextRequest) => {
  // Auth check — must be logged in to log out
  await requireSiws(req);

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await sessionsDb.deleteSession(token);
  }

  const response = NextResponse.json(serialize({ ok: true }));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  security: [{ cookieAuth: [] }],
  responses: {
    "200": {
      description: "Session cleared",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean() }),
        },
      },
    },
  },
  tags: ["auth"],
});