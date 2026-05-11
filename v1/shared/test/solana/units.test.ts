import { describe, it, expect } from "vitest";
import {
  solToLamports,
  lamportsToSol,
  usdcToBaseUnits,
  baseUnitsToUsdc,
} from "../../src/solana/units.js";

describe("unit conversions", () => {
  it("1 SOL = 1_000_000_000 lamports", () => {
    expect(solToLamports(1)).toBe(1_000_000_000n);
  });

  it("1_000_000_000 lamports = 1 SOL", () => {
    expect(lamportsToSol(1_000_000_000n)).toBeCloseTo(1.0);
  });

  it("1 USDC = 1_000_000 base units", () => {
    expect(usdcToBaseUnits(1)).toBe(1_000_000n);
  });

  it("1_000_000 base units = 1 USDC", () => {
    expect(baseUnitsToUsdc(1_000_000n)).toBeCloseTo(1.0);
  });

  it("fractional SOL conversion is accurate", () => {
    expect(solToLamports(0.1)).toBe(100_000_000n);
    expect(lamportsToSol(100_000_000n)).toBeCloseTo(0.1);
  });

  it("fractional USDC conversion is accurate", () => {
    expect(usdcToBaseUnits(0.5)).toBe(500_000n);
    expect(baseUnitsToUsdc(500_000n)).toBeCloseTo(0.5);
  });
});
