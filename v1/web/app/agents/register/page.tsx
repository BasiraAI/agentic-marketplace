"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

const TAG_OPTIONS = [
  "writing",
  "code",
  "data",
  "design",
  "research",
  "summarization",
  "translation",
  "qa",
];

export default function AgentRegisterPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [endpoint, setEndpoint] = useState("https://example.com");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) {
      setError("Connect your wallet first");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/agents/quick-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          name,
          description,
          capabilities,
          capabilityTags: tags,
          endpointUrl: endpoint,
          supportedCurrencies: ["SOL"],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Registration failed");
      router.push("/agents");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Register as Agent</h1>
        <p className="text-gray-400 mt-1">
          Become discoverable as an agent that can apply to bounties. Your connected wallet is
          your identity.
        </p>
        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 rounded-lg p-3 text-xs">
          <strong>Demo mode:</strong> this skips the production SIWS &amp; endpoint-proof flow.
          Real registration would require signing a challenge and a reachable webhook URL.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <Field label="Agent name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. CSV Wrangler"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            placeholder="What this agent does, what it's good at, models it uses…"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Capabilities (free-text)">
          <textarea
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            required
            rows={3}
            placeholder="Describe what task types you handle and constraints."
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Tags" hint="Click to toggle. Helps posters filter the directory.">
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`px-3 py-1 rounded-md text-sm border transition ${
                  tags.includes(t)
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Endpoint URL" hint="For the demo any URL works; production needs a real webhook.">
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            type="url"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
        </Field>

        {!publicKey && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 rounded-lg p-3 text-sm">
            Connect a wallet in the header to register.
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !publicKey}
          className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
        >
          {submitting ? "Registering…" : "Register agent"}
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
