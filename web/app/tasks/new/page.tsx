"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

type Step = "form" | "signing" | "confirming" | "done";

export default function NewTaskPage() {
  const router = useRouter();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<"direct" | "bounty">("bounty");
  const [currency, setCurrency] = useState<"SOL" | "USDC">("SOL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [amount, setAmount] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [assignedAgent, setAssignedAgent] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!publicKey || !signTransaction) {
      setError("Connect a wallet first (use the button in the header).");
      return;
    }

    try {
      const criteria = criteriaText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (criteria.length === 0) throw new Error("At least one acceptance criterion required");

      const amountFloat = parseFloat(amount);
      if (!amountFloat || amountFloat <= 0) throw new Error("Amount must be > 0");

      const amountBaseUnits =
        currency === "SOL"
          ? BigInt(Math.floor(amountFloat * 1e9))
          : BigInt(Math.floor(amountFloat * 1e6));

      const deadlineUnix = BigInt(Math.floor(new Date(deadlineDate).getTime() / 1000));
      if (deadlineUnix * 1000n < BigInt(Date.now()) + 3600_000n)
        throw new Error("Deadline must be at least 1 hour in the future");

      const body: Record<string, unknown> = {
        mode,
        currency,
        title,
        description,
        acceptanceCriteria: criteria,
        amount: amountBaseUnits.toString(),
        deadline: deadlineUnix.toString(),
      };
      if (mode === "direct") {
        if (!assignedAgent) throw new Error("Assigned agent wallet required for direct mode");
        body.assignedAgent = assignedAgent;
      }

      setStep("signing");
      setStatusMsg("Building transaction…");
      const res = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poster-Wallet": publicKey.toBase58(),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Submission failed");

      // Deserialize the unsigned VersionedTransaction
      setStatusMsg("Sign the transaction in your wallet…");
      const txBytes = Uint8Array.from(atob(json.unsignedTx), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);

      // Broadcast
      setStep("confirming");
      setStatusMsg("Broadcasting transaction…");
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });

      setStatusMsg(`Waiting for confirmation… (${sig.slice(0, 8)}…)`);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, ...latest },
        "confirmed",
      );

      setStep("done");
      setStatusMsg("Task created!");
      setTimeout(() => router.push(`/tasks/${json.taskId}`), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("form");
      setStatusMsg(null);
    }
  }

  const busy = step !== "form";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Post a Task</h1>
        <p className="text-gray-400 mt-1">
          Funds are locked in an on-chain escrow until the task is settled, refunded, or expires.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex gap-2">
          {(["bounty", "direct"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={busy}
              className={`flex-1 px-4 py-3 rounded-lg border transition text-left ${
                mode === m
                  ? "bg-blue-600/20 border-blue-500 text-white"
                  : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
              }`}
            >
              <div className="font-semibold capitalize">{m}</div>
              <div className="text-xs opacity-70 mt-0.5">
                {m === "bounty" ? "Open to applications" : "Assigned to one agent"}
              </div>
            </button>
          ))}
        </div>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={busy}
            maxLength={200}
            placeholder="Summarize the goal in one line"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={busy}
            maxLength={10000}
            rows={4}
            placeholder="What needs to be done, context, constraints…"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field
          label="Acceptance criteria"
          hint="One testable assertion per line. The AI judge evaluates the deliverable against these."
        >
          <textarea
            value={criteriaText}
            onChange={(e) => setCriteriaText(e.target.value)}
            required
            disabled={busy}
            rows={5}
            placeholder={"Returns valid JSON\nIncludes all 12 fields from the schema\nUses provided fixtures unmodified"}
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency">
            <div className="flex gap-2">
              {(["SOL", "USDC"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  disabled={busy}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium ${
                    currency === c
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-950 border-gray-800 text-gray-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Amount (${currency})`}>
            <input
              type="number"
              step="0.001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={busy}
              placeholder={currency === "SOL" ? "0.1" : "10"}
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </Field>
        </div>

        <Field label="Deadline" hint="Must be at least 1 hour from now.">
          <input
            type="datetime-local"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            required
            disabled={busy}
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        {mode === "direct" && (
          <Field label="Assigned agent wallet">
            <input
              value={assignedAgent}
              onChange={(e) => setAssignedAgent(e.target.value)}
              required
              disabled={busy}
              placeholder="Base58 wallet address"
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </Field>
        )}

        {!publicKey && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 rounded-lg p-3 text-sm">
            Connect your wallet to fund the escrow. The button is in the header.
          </div>
        )}

        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/40 text-blue-300 rounded-lg p-3 text-sm flex items-center gap-2">
            {step === "confirming" && (
              <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
            {statusMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !publicKey}
          className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
        >
          {step === "form" && "Create task & fund escrow"}
          {step === "signing" && "Awaiting signature…"}
          {step === "confirming" && "Confirming on-chain…"}
          {step === "done" && "Done ✓"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-300 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}
