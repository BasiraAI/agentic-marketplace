import type {
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  ParsedInstruction,
  PublicKey,
} from "@solana/web3.js";

/**
 * Anchor logs `Program log: Instruction: <CamelName>` once per top-level call
 * into the program. The order in `logMessages` matches the order in the
 * transaction's instruction array (top-level calls only).
 */
const INSTRUCTION_LOG_RE = /^Program log: Instruction: (\w+)$/;

export type InstructionName =
  | "RegisterAgent"
  | "CreateTaskSol"
  | "CreateTaskUsdc"
  | "CancelTaskSol"
  | "CancelTaskUsdc"
  | "AssignAgent"
  | "RejectAssignmentSol"
  | "RejectAssignmentUsdc"
  | "SubmitDeliverable"
  | "ApproveSol"
  | "ApproveUsdc"
  | "ClaimAfterTimeoutSol"
  | "ClaimAfterTimeoutUsdc"
  | "OpenDispute"
  | "ResolveDisputeSol"
  | "ResolveDisputeUsdc"
  | "ExpireTaskSol"
  | "ExpireTaskUsdc";

export interface ParsedProgramInstruction {
  name: InstructionName;
  /** Account public keys passed to this instruction in IDL order. */
  accounts: PublicKey[];
}

export interface ParsedProgramTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  instructions: ParsedProgramInstruction[];
}

function isPartiallyDecoded(
  ix: PartiallyDecodedInstruction | ParsedInstruction,
): ix is PartiallyDecodedInstruction {
  return "accounts" in ix && Array.isArray((ix as PartiallyDecodedInstruction).accounts);
}

/**
 * Extract Anchor instruction names + account lists from a confirmed transaction.
 * Filters to instructions that target our program ID.
 */
export function parseTransaction(
  tx: ParsedTransactionWithMeta,
  programId: PublicKey,
  signature: string,
): ParsedProgramTransaction | null {
  const instructions: ParsedProgramInstruction[] = [];

  if (!tx.meta || !tx.transaction) return null;
  const logs = tx.meta.logMessages ?? [];
  const names: string[] = [];
  for (const line of logs) {
    const m = INSTRUCTION_LOG_RE.exec(line);
    if (m) names.push(m[1]!);
  }

  const message = tx.transaction.message;
  const programIdStr = programId.toBase58();
  let nameIdx = 0;

  for (const ix of message.instructions) {
    if (!("programId" in ix)) continue;
    if (ix.programId.toBase58() !== programIdStr) continue;
    const name = names[nameIdx++];
    if (!name) continue;
    if (!isPartiallyDecoded(ix)) continue;
    instructions.push({
      name: name as InstructionName,
      accounts: ix.accounts,
    });
  }

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    instructions,
  };
}
