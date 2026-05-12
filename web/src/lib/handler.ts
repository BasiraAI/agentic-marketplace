import type { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "./errors";

type Handler<C = unknown> = (
  req: NextRequest,
  ctx: C,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler so any thrown error becomes a structured JSON response.
 * Use as: `export const POST = wrap(async (req, ctx) => { ... });`
 */
export function wrap<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
