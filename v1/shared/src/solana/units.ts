const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 10 ** SOL_DECIMALS));
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 10 ** SOL_DECIMALS;
}

export function usdcToBaseUnits(usdc: number): bigint {
  return BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));
}

export function baseUnitsToUsdc(baseUnits: bigint): number {
  return Number(baseUnits) / 10 ** USDC_DECIMALS;
}
