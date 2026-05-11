import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { submitDeliverable, getConnection } from "@basira/shared";

export const POST = wrap(async (
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;
  const body = await req.json();

  const agentWallet = req.headers.get("x-agent-wallet");
  if (!agentWallet) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Missing X-Agent-Wallet header" } },
      { status: 401 },
    );
  }

  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash();

  const result = await submitDeliverable(
    {
      taskId,
      contentText: body.contentText ?? "",
      fileUrls: Array.isArray(body.fileUrls) ? body.fileUrls : [],
    },
    agentWallet,
    blockhash,
  );

  return NextResponse.json(serialize(result));
});
