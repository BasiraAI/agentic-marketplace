import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env["DATABASE_URL"] ??= "postgresql://basira:basira@localhost:5432/basira";
  process.env["SOLANA_RPC_URL"] ??= "https://api.devnet.solana.com";
  process.env["NODE_ENV"] = "test";
});

describe("requireSiws", () => {
  it("rejects requests with no session cookie", async () => {
    const { requireSiws } = await import("../src/lib/auth");
    const req = new NextRequest("http://localhost/api/v1/x");
    await expect(requireSiws(req)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("rejects requests with an unknown cookie token", async () => {
    const { requireSiws } = await import("../src/lib/auth");
    const req = new NextRequest("http://localhost/api/v1/x", {
      headers: { cookie: "basira_session=does-not-exist" },
    });
    await expect(requireSiws(req)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });
});

describe("requireApiKey", () => {
  it("rejects requests with no Authorization header", async () => {
    const { requireApiKey } = await import("../src/lib/auth");
    const req = new NextRequest("http://localhost/api/v1/x");
    await expect(requireApiKey(req)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("rejects requests with an invalid bearer token", async () => {
    const { requireApiKey } = await import("../src/lib/auth");
    const req = new NextRequest("http://localhost/api/v1/x", {
      headers: { authorization: "Bearer not-a-real-key" },
    });
    await expect(requireApiKey(req)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });
});

describe("serialize", () => {
  it("converts bigint to string", async () => {
    const { serialize } = await import("../src/lib/serialize");
    expect(serialize({ amount: 10_000_000n })).toEqual({ amount: "10000000" });
  });
  it("converts Date to ISO string", async () => {
    const { serialize } = await import("../src/lib/serialize");
    const d = new Date("2026-05-10T12:00:00Z");
    expect(serialize({ at: d })).toEqual({ at: "2026-05-10T12:00:00.000Z" });
  });
  it("recurses into nested objects and arrays", async () => {
    const { serialize } = await import("../src/lib/serialize");
    expect(
      serialize({ items: [{ amount: 1n }, { amount: 2n }] }),
    ).toEqual({ items: [{ amount: "1" }, { amount: "2" }] });
  });
});
