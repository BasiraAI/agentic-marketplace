import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { approveTask, getConnection } from "@basira/shared";

export const POST = wrap(async (
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;
  const posterWallet = req.headers.get("x-poster-wallet");
  if (!posterWallet) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Missing X-Poster-Wallet header" } },
      { status: 401 },
    );
  }

  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash();

  const result = await approveTask(taskId, posterWallet, blockhash);
  return NextResponse.json(serialize(result));
});
