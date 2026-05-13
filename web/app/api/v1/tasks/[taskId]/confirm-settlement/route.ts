import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { tasksDb, settlementsDb } from "@basira/shared";
import { FEE_BPS, TREASURY_ADDRESS } from "@basira/shared";

export const POST = wrap(async (
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;
  const { txSignature } = await req.json() as { txSignature: string };

  if (!txSignature) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Missing txSignature" } },
      { status: 400 },
    );
  }

  const task = await tasksDb.getTaskById(taskId);
  if (!task) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Task not found" } },
      { status: 404 },
    );
  }

  const amount = BigInt(task.amount);
  const feeAmount = (amount * BigInt(FEE_BPS)) / 10_000n;
  const agentAmount = amount - feeAmount;

  await Promise.all([
    settlementsDb.recordSettlement({
      taskId,
      kind: "release",
      recipientWallet: task.assigned_agent!,
      currency: task.currency as "SOL" | "USDC",
      amount: agentAmount,
      txSignature,
    }),
    settlementsDb.recordSettlement({
      taskId,
      kind: "fee",
      recipientWallet: TREASURY_ADDRESS.toBase58(),
      currency: task.currency as "SOL" | "USDC",
      amount: feeAmount,
      txSignature,
    }),
    tasksDb.transitionStatus(taskId, "submitted", "settled", { settled_at: new Date() }),
  ]);

  return NextResponse.json({ ok: true });
});
