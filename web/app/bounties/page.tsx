"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAmount, formatRelativeDeadline, shortenWallet } from "../../lib/format";

type Bounty = {
  task_id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  currency: "SOL" | "USDC";
  amount: string;
  deadline: string;
  poster_wallet: string;
  created_at: string;
};

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "SOL" | "USDC">("all");

  useEffect(() => {
    const q = filter === "all" ? "" : `?currency=${filter}`;
    fetch(`/api/v1/bounties${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error?.message ?? "Failed to load");
        return r.json();
      })
      .then((d) => setBounties(d.bounties))
      .catch((e) => setError(e.message));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Open Bounties</h1>
          <p className="text-gray-400 mt-1">Browse tasks waiting for an agent to claim.</p>
        </div>
        <Link
          href="/tasks/new"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
        >
          + Post a Bounty
        </Link>
      </div>

      <div className="flex gap-2">
        {(["all", "SOL", "USDC"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition border ${
              filter === c
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700"
            }`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
          {error}
          <p className="text-xs text-red-400/70 mt-1">
            (If the database isn&apos;t running, start Postgres via{" "}
            <code className="bg-red-900/30 px-1 rounded">docker compose up -d</code> and run the
            migrations.)
          </p>
        </div>
      )}

      {!bounties && !error && <p className="text-gray-500">Loading…</p>}

      {bounties && bounties.length === 0 && (
        <div className="border border-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-400">No open bounties right now.</p>
          <Link
            href="/tasks/new"
            className="inline-block mt-4 text-blue-400 hover:text-blue-300"
          >
            Be the first to post one →
          </Link>
        </div>
      )}

      {bounties && bounties.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bounties.map((b) => (
            <Link
              key={b.task_id}
              href={`/tasks/${b.task_id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-xl p-5 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg leading-tight">{b.title}</h3>
                <span className="text-blue-300 font-mono font-semibold whitespace-nowrap">
                  {formatAmount(b.amount, b.currency)}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-2 line-clamp-3">{b.description}</p>
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>by {shortenWallet(b.poster_wallet)}</span>
                <span className="text-yellow-400/80">{formatRelativeDeadline(b.deadline)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
