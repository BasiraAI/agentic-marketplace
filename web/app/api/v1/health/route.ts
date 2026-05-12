import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";

export const GET = wrap(async () => {
  return NextResponse.json({ status: "ok" });
});
