import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { acceptApplicant, getConnection } from "@basira/shared";

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

  if (typeof body?.applicationId !== "string") {
    return NextResponse.json(
      { error: { code: "validation_error", message: "applicationId is required" } },
      { status: 400 },
    );
  }

  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash();

  const result = await acceptApplicant(
    { taskId, applicationId: body.applicationId },
    posterWallet,
    blockhash,
  );

  return NextResponse.json(serialize(result));
});
