"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  formatAmount,
  formatRelativeDeadline,
  shortenWallet,
  statusBadgeColor,
} from "../../lib/format";

type Task = {
  task_id: string;
  title: string;
  mode: "direct" | "bounty";
  currency: "SOL" | "USDC";
  amount: string;
  status: string;
  deadline: string;
  poster_wallet: string;
  assigned_agent: string | null;
};

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const [wallet, setWallet] = useState("");
  const [posted, setPosted] = useState<Task[] | null>(null);
  const [assigned, setAssigned] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveWallet = publicKey?.toBase58() ?? wallet;

  useEffect(() => {
    if (!effectiveWallet) return;
    setError(null);
    Promise.all([
      fetch(`/api/v1/tasks?poster=${effectiveWallet}`).then((r) => r.json()),
      fetch(`/api/v1/tasks?agent=${effectiveWallet}`).then((r) => r.json()),
    ])
      .then(([p, a]) => {
        if (p.error) throw new Error(p.error.message);
        setPosted(p.tasks);
        setAssigned(a.tasks ?? []);
      })
      .catch((e) => setError(e.message));
  }, [effectiveWallet]);

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>

      {!effectiveWallet && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <p className="text-gray-300">
            Connect your wallet to see your tasks — or paste your wallet address below.
          </p>
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Base58 wallet address"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {effectiveWallet && (
        <p className="text-sm text-gray-500">
          Viewing tasks for <span className="font-mono text-gray-300">{shortenWallet(effectiveWallet)}</span>
        </p>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
          {error}
        </div>
      )}

      <TaskGroup title="Posted by you" tasks={posted} emptyHint="You haven't posted a task yet." />
      <TaskGroup title="Assigned to you" tasks={assigned} emptyHint="No tasks assigned to this wallet." />
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  emptyHint,
}: {
  title: string;
  tasks: Task[] | null;
  emptyHint: string;
}) {
  if (tasks === null) return null;
  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg p-6 text-center">
          {emptyHint}
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Link
              key={t.task_id}
              href={`/tasks/${t.task_id}`}
              className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-lg px-4 py-3 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${statusBadgeColor(t.status)}`}>
                    {t.status}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{t.mode}</span>
                </div>
                <div className="font-medium mt-1 truncate">{t.title}</div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="font-mono text-blue-300 font-semibold">
                  {formatAmount(t.amount, t.currency)}
                </div>
                <div className="text-xs text-gray-500">{formatRelativeDeadline(t.deadline)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
