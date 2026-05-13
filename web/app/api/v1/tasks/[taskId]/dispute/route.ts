import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { disputeTask, getLatestBlockhashWithRetry } from "@basira/shared";

export const POST = wrap(async (
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;
  const body = await req.json();

  const posterWallet = req.headers.get("x-poster-wallet");
  if (!posterWallet) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Missing X-Poster-Wallet header" } },
      { status: 401 },
    );
  }

  if (typeof body?.reason !== "string" || body.reason.length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "reason is required" } },
      { status: 400 },
    );
  }

  const blockhash = await getLatestBlockhashWithRetry();

  const result = await disputeTask({ taskId, reason: body.reason }, posterWallet, blockhash);
  return NextResponse.json(serialize(result));
});
