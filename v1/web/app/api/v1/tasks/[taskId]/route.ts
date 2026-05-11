import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import {
  tasksDb,
  bountyApplicationsDb,
  deliverablesDb,
  judgeVerdictsDb,
  disputesDb,
} from "@basira/shared";

export const GET = wrap(async (
  _req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) => {
  const { taskId } = await ctx.params;

  const task = await tasksDb.getTaskById(taskId);
  if (!task) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Task not found" } },
      { status: 404 },
    );
  }

  const [applications, deliverable, verdict, dispute] = await Promise.all([
    bountyApplicationsDb.listApplicationsForTask(taskId).catch(() => []),
    deliverablesDb.getLatestForTask(taskId).catch(() => null),
    judgeVerdictsDb.getLatestVerdictForTask(taskId).catch(() => null),
    disputesDb.getOpenDisputeForTask(taskId).catch(() => null),
  ]);

  return NextResponse.json(
    serialize({ task, applications, deliverable, verdict, dispute }),
  );
});
