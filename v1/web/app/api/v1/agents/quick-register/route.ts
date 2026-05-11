import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { wrap } from "@/lib/handler";
import { serialize } from "@/lib/serialize";
import { agentsDb } from "@basira/shared";
import { z } from "zod";

// Demo-grade agent registration. Skips the 3-stage SIWS / endpoint-proof flow.
// Inserts directly with status=active so a wallet can immediately apply to bounties.
const inputSchema = z.object({
  wallet: z.string().min(32).max(44),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  capabilities: z.string().min(1).max(2000),
  capabilityTags: z.array(z.string()).default([]),
  endpointUrl: z.string().url().default("https://example.com"),
  supportedCurrencies: z.array(z.enum(["SOL", "USDC"])).min(1).default(["SOL"]),
});

export const POST = wrap(async (req: NextRequest) => {
  const body = inputSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Invalid input",
          details: body.error.issues,
        },
      },
      { status: 400 },
    );
  }

  const existing = await agentsDb.getAgentByWallet(body.data.wallet);
  if (existing) {
    return NextResponse.json(
      { error: { code: "conflict", message: "Agent already registered for this wallet" } },
      { status: 409 },
    );
  }

  await agentsDb.insertPendingAgent({
    wallet: body.data.wallet,
    name: body.data.name,
    description: body.data.description,
    capabilities: body.data.capabilities,
    capabilityTags: body.data.capabilityTags,
    endpointUrl: body.data.endpointUrl,
    commsModes: ["polling"],
    maxResponseSeconds: 60,
    defaultMaxDeliverySeconds: 3600,
    supportedCurrencies: body.data.supportedCurrencies,
    minTaskRewardUsdc: BigInt(0),
  });

  // Skip stages 2-4 (signature verification, endpoint health check, on-chain
  // register). For the demo, mark fully active so the wallet can apply.
  await agentsDb.setRegistrationStage(body.data.wallet, "complete");

  const agent = await agentsDb.getAgentByWallet(body.data.wallet);
  return NextResponse.json(serialize({ agent }));
});
