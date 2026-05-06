"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

interface TaskDetail {
  taskId: string;
  title: string;
  description: string;
  testSpec: string;
  rewardSol: number;
  poster: string;
  status: string;
  solver: string | null;
  submissionCount: number;
  timeoutAt: number;
  createdAt: string;
  submissions: Submission[];
}

interface Submission {
  submissionId: string;
  solver: string;
  code: string;
  submittedAt: string;
  verdict: "pending" | "pass" | "fail";
  claudeReason: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "text-green-400",
  submitted: "text-yellow-400",
  verified: "text-blue-400",
  failed: "text-red-400",
  released: "text-gray-400",
  refunded: "text-gray-400",
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { publicKey } = useWallet();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ verdict: string; reason: string } | null>(null);
  const [error, setError] = useState("");

  function fetchTask() {
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((data) => {
        setTask(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !task) return;

    setSubmitting(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.taskId,
          solver: publicKey.toBase58(),
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult({ verdict: data.verdict, reason: data.reason });
      fetchTask(); // refresh status
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (!task) return <p className="text-red-400">Task not found.</p>;

  const canSubmit = task.status === "open" || task.status === "failed";
  const isSettled = task.status === "released" || task.status === "refunded";
  const expiresIn = Math.max(0, task.timeoutAt - Math.floor(Date.now() / 1000));
  const hours = Math.floor(expiresIn / 3600);
  const statusColor = STATUS_COLORS[task.status] || "text-gray-400";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">← Back to board</Link>
      </div>

      <div className="border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-violet-400">{task.rewardSol} SOL</div>
            <div className={`text-sm font-medium capitalize ${statusColor}`}>{task.status}</div>
          </div>
        </div>

        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
            <p className="whitespace-pre-wrap">{task.description}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verification Spec</p>
            <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs whitespace-pre-wrap font-mono">{task.testSpec}</pre>
          </div>
        </div>

        <div className="flex gap-4 mt-4 text-xs text-gray-600">
          <span>Posted by {task.poster.slice(0, 6)}…{task.poster.slice(-4)}</span>
          {task.submissionCount > 0 && <span>{task.submissionCount} attempt{task.submissionCount !== 1 ? "s" : ""}</span>}
          {!isSettled && expiresIn > 0 && <span>Expires in {hours}h</span>}
          {task.solver && <span>Solver: {task.solver.slice(0, 6)}…{task.solver.slice(-4)}</span>}
        </div>
      </div>

      {/* Submit Solution */}
      {canSubmit && (
        <div className="border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Submit Solution</h2>

          {!publicKey ? (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-4 text-sm">Connect your wallet to submit a solution and earn {task.rewardSol} SOL.</p>
              <WalletMultiButton />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Code</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-100 min-h-[200px] resize-y focus:outline-none focus:border-violet-500"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Paste your solution here..."
                  required
                />
              </div>

              {result && (
                <div className={`rounded-lg p-4 border ${result.verdict === "pass" ? "bg-green-950 border-green-800 text-green-300" : "bg-red-950 border-red-800 text-red-300"}`}>
                  <p className="font-semibold mb-1">{result.verdict === "pass" ? "✓ Passed — SOL released to your wallet!" : "✗ Failed"}</p>
                  <p className="text-sm opacity-80">{result.reason}</p>
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {submitting ? "Verifying with Claude…" : "Submit Solution"}
              </button>
            </form>
          )}
        </div>
      )}

      {isSettled && (
        <div className={`border rounded-xl p-5 mb-6 ${task.status === "released" ? "border-green-800 bg-green-950/30" : "border-gray-700"}`}>
          <p className="font-semibold">
            {task.status === "released" ? "✓ Reward released to solver" : "↩ Reward refunded to poster"}
          </p>
        </div>
      )}

      {/* Submission history */}
      {task.submissions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Submission History</h2>
          <div className="space-y-3">
            {task.submissions.map((sub) => (
              <div key={sub.submissionId} className="border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{sub.solver.slice(0, 8)}…{sub.solver.slice(-4)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sub.verdict === "pass" ? "bg-green-900 text-green-300" : sub.verdict === "fail" ? "bg-red-900 text-red-300" : "bg-gray-800 text-gray-400"}`}>
                    {sub.verdict}
                  </span>
                </div>
                {sub.claudeReason && <p className="text-xs text-gray-500">{sub.claudeReason}</p>}
                <pre className="mt-2 text-xs font-mono bg-gray-900 rounded-lg p-2 overflow-x-auto text-gray-400 max-h-32">{sub.code}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
