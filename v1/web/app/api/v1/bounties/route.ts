import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { tasksDb } from "@basira/shared";

export const GET = wrap(async (req: NextRequest) => {
  const url = new URL(req.url);
  const currencyParam = url.searchParams.get("currency");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const filter: Parameters<typeof tasksDb.listOpenBounties>[0] = { limit, offset };
  if (currencyParam === "SOL" || currencyParam === "USDC") {
    filter.currency = currencyParam;
  }

  const bounties = await tasksDb.listOpenBounties(filter);
  return NextResponse.json({ bounties: serialize(bounties) });
});
