import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  taskIdFromUuid,
  uuidFromTaskId,
  agentPda,
  taskPda,
  vaultPda,
} from "../../src/solana/pdas.js";
import { BASIRA_PROGRAM_ID } from "../../src/solana/program-id.js";

const PROGRAM_ID = new PublicKey(BASIRA_PROGRAM_ID);

describe("taskIdFromUuid / uuidFromTaskId", () => {
  it("round-trips a UUID without hyphens", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const bytes = taskIdFromUuid(uuid);
    expect(bytes).toHaveLength(16);
    expect(uuidFromTaskId(bytes)).toBe(uuid);
  });

  it("produces 16 bytes", () => {
    expect(taskIdFromUuid("00000000-0000-0000-0000-000000000000")).toHaveLength(16);
  });
});

describe("PDA derivation", () => {
  const wallet = new PublicKey("DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV");
  const taskIdBytes = taskIdFromUuid("550e8400-e29b-41d4-a716-446655440000");

  it("agentPda is deterministic", () => {
    const [pda1] = agentPda(wallet);
    const [pda2] = agentPda(wallet);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it("taskPda is deterministic", () => {
    const [pda1] = taskPda(taskIdBytes);
    const [pda2] = taskPda(taskIdBytes);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it("vaultPda is deterministic", () => {
    const [pda1] = vaultPda(taskIdBytes);
    const [pda2] = vaultPda(taskIdBytes);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it("taskPda and vaultPda for same taskId are different", () => {
    const [taskAddr] = taskPda(taskIdBytes);
    const [vaultAddr] = vaultPda(taskIdBytes);
    expect(taskAddr.toBase58()).not.toBe(vaultAddr.toBase58());
  });

  it("agentPda differs per wallet", () => {
    const wallet2 = new PublicKey("Bddo2ek21cs8SmArWa7c3GTu8VQnAiKzs7fc1T3AF2hc");
    const [pda1] = agentPda(wallet);
    const [pda2] = agentPda(wallet2);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it("PDAs are off-curve (valid PDA)", () => {
    const [agentAddr] = agentPda(wallet);
    expect(PublicKey.isOnCurve(agentAddr.toBytes())).toBe(false);
  });

  it("agentPda matches on-chain derivation (known fixture)", () => {
    // Computed independently using: PublicKey.findProgramAddressSync([Buffer.from("agent"), wallet.toBuffer()], PROGRAM_ID)
    const [pda] = agentPda(wallet);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), wallet.toBuffer()],
      PROGRAM_ID,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });
});

describe("signature verification", () => {
  it("verifyEd25519Signature accepts valid signature", async () => {
    const { verifyEd25519Signature } = await import("../../src/solana/sig.js");
    const nacl = (await import("tweetnacl")).default;
    const kp = nacl.sign.keyPair();
    const msg = new TextEncoder().encode("hello basira");
    const sig = nacl.sign.detached(msg, kp.secretKey);
    expect(verifyEd25519Signature(msg, sig, kp.publicKey)).toBe(true);
  });

  it("verifyEd25519Signature rejects wrong message", async () => {
    const { verifyEd25519Signature } = await import("../../src/solana/sig.js");
    const nacl = (await import("tweetnacl")).default;
    const kp = nacl.sign.keyPair();
    const msg = new TextEncoder().encode("hello basira");
    const wrongMsg = new TextEncoder().encode("tampered");
    const sig = nacl.sign.detached(msg, kp.secretKey);
    expect(verifyEd25519Signature(wrongMsg, sig, kp.publicKey)).toBe(false);
  });
});

describe("buildSiwsMessage", () => {
  it("includes domain, wallet, nonce, and timestamps", async () => {
    const { buildSiwsMessage } = await import("../../src/solana/sig.js");
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-01T00:10:00.000Z");
    const msg = buildSiwsMessage({
      domain: "basira.xyz",
      wallet: "DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV",
      nonce: "abc123",
      issuedAt,
      expiresAt,
    });
    expect(msg).toContain("basira.xyz");
    expect(msg).toContain("DaAcmKvC3PLL4avmjLnfF2uNuYKaFjNYmmhRKYiXbqWV");
    expect(msg).toContain("Nonce: abc123");
    expect(msg).toContain("2026-01-01T00:00:00.000Z");
    expect(msg).toContain("2026-01-01T00:10:00.000Z");
  });
});
