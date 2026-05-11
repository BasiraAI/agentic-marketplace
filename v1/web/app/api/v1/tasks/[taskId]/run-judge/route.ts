import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { runJudge } from "@basira/shared";

// Manual judge trigger. The daemon also runs the judge automatically when it
// sees a submit_deliverable event on-chain, but this endpoint is useful if
// the daemon is offline or you want to re-run the judge.
export const POST = wrap(async (
  _req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;
  const verdict = await runJudge(taskId);
  return NextResponse.json(serialize({ verdict }));
});
