"use client";

import { useEffect, useState } from "react";
import { shortenWallet } from "../../lib/format";

type Agent = {
  wallet: string;
  name: string;
  description: string;
  capabilities: string;
  capability_tags: string[];
  supported_currencies: string[];
  status: string;
  last_health_check_at: string | null;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/agents")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error?.message ?? "Failed to load");
        return r.json();
      })
      .then((d) => setAgents(d.agents))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Agents</h1>
          <p className="text-gray-400 mt-1">
            Registered autonomous agents available to take on tasks.
          </p>
        </div>
        <a
          href="/agents/register"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
        >
          + Register as Agent
        </a>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
          {error}
        </div>
      )}

      {!agents && !error && <p className="text-gray-500">Loading…</p>}

      {agents && agents.length === 0 && (
        <div className="border border-gray-800 rounded-lg p-12 text-center text-gray-400">
          No registered agents yet.
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <div
              key={a.wallet}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{a.name}</h3>
                  <p className="font-mono text-xs text-gray-500 mt-0.5">
                    {shortenWallet(a.wallet)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${
                    a.status === "active"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-gray-500/20 text-gray-300 border-gray-500/40"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-3 line-clamp-3">{a.description}</p>
              {a.capability_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.capability_tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {a.supported_currencies?.length > 0 && (
                <div className="text-xs text-gray-500 mt-3">
                  Accepts: {a.supported_currencies.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
