"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useRouter } from "next/navigation";
import idl from "@/lib/idl.json";
import type { TaskMarketplace } from "@/lib/idl-types";

const PROGRAM_ID = new PublicKey("9Re1qpCeqaVAU984Au3YSCnGLQvkYc1UzVHqmeSNVi4A");

function taskIdToLeBytes(taskId: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = taskId;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function getTaskPda(taskId: bigint) {
  return PublicKey.findProgramAddressSync([Buffer.from("task"), taskIdToLeBytes(taskId)], PROGRAM_ID);
}

function getEscrowPda(taskId: bigint) {
  return PublicKey.findProgramAddressSync([Buffer.from("escrow"), taskIdToLeBytes(taskId)], PROGRAM_ID);
}

const REGISTRY_PDA = PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID)[0];

export default function NewTaskPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    testSpec: "",
    rewardSol: "0.1",
    timeoutDays: "1",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      // Use a read-only provider (no wallet needed) just to fetch accounts and build the tx
      const provider = new anchor.AnchorProvider(connection, {
        publicKey,
        signTransaction: async (tx: unknown) => tx as never,
        signAllTransactions: async (txs: unknown[]) => txs as never,
      } as anchor.Wallet, { commitment: "confirmed" });
      const program = new anchor.Program<TaskMarketplace>(idl as TaskMarketplace, provider);

      // Read current task_count from on-chain registry to get next task_id
      const registry = await program.account.registry.fetch(REGISTRY_PDA);
      const taskId = registry.taskCount as anchor.BN;
      const taskIdBigInt = BigInt(taskId.toString());

      const rewardLamports = new anchor.BN(
        Math.round(parseFloat(form.rewardSol) * LAMPORTS_PER_SOL)
      );
      const timeoutSeconds = new anchor.BN(parseInt(form.timeoutDays) * 86400);

      const [taskPda] = getTaskPda(taskIdBigInt);
      const [escrowPda] = getEscrowPda(taskIdBigInt);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ix = await (program.methods.postTask(taskId, rewardLamports, timeoutSeconds) as any)
        .accountsPartial({
          poster: publicKey,
          registry: REGISTRY_PDA,
          task: taskPda,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
      tx.add(ix);

      const sig = await sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: "finalized" });

      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "finalized");

      // Save metadata off-chain
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskId.toString(),
          title: form.title,
          description: form.description,
          testSpec: form.testSpec,
          rewardSol: parseFloat(form.rewardSol),
          poster: publicKey.toBase58(),
        }),
      });

      setStatus("done");
      router.push(`/tasks/${taskId.toString()}`);
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Post a Task</h1>
        <p className="text-gray-400 mb-6">Connect your wallet to post a task and lock the reward.</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Post a Task</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Title" hint="Short name for the task">
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Write a function that reverses a string"
            required
          />
        </Field>

        <Field label="Description" hint="What should the code do?">
          <textarea
            className="input min-h-[80px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Write a JavaScript function named reverseString(s) that takes a string and returns it reversed."
            required
          />
        </Field>

        <Field label="Verification Spec" hint="How Claude will decide if the solution passes. Be specific.">
          <textarea
            className="input min-h-[100px]"
            value={form.testSpec}
            onChange={(e) => setForm({ ...form, testSpec: e.target.value })}
            placeholder={`The function must be named reverseString, accept one string argument, and return the reversed string.\nExample: reverseString('hello') === 'olleh'\nExample: reverseString('') === ''`}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reward (SOL)">
            <input
              className="input"
              type="number"
              min="0.001"
              step="0.001"
              value={form.rewardSol}
              onChange={(e) => setForm({ ...form, rewardSol: e.target.value })}
              required
            />
          </Field>
          <Field label="Timeout (days)">
            <input
              className="input"
              type="number"
              min="1"
              max="30"
              value={form.timeoutDays}
              onChange={(e) => setForm({ ...form, timeoutDays: e.target.value })}
              required
            />
          </Field>
        </div>

        {status === "error" && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {status === "submitting" ? "Posting…" : `Post Task & Lock ${form.rewardSol} SOL`}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          background: rgb(17 24 39);
          border: 1px solid rgb(55 65 81);
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          color: rgb(243 244 246);
          font-size: 0.875rem;
          resize: vertical;
        }
        .input:focus {
          outline: none;
          border-color: rgb(139 92 246);
        }
        .input::placeholder {
          color: rgb(107 114 128);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
