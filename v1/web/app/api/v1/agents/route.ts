import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { agentsDb } from "@basira/shared";

export const GET = wrap(async () => {
  const agents = await agentsDb.listActiveAgents();
  return NextResponse.json({ agents: serialize(agents) });
});
