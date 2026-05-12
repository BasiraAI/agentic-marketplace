"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTxSubmit } from "../../../lib/useTxSubmit";
import {
  formatAmount,
  formatDate,
  formatRelativeDeadline,
  shortenWallet,
  statusBadgeColor,
} from "../../../lib/format";

type TaskDetail = {
  task: {
    task_id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
    mode: "direct" | "bounty";
    currency: "SOL" | "USDC";
    amount: string;
    status: string;
    deadline: string;
    submitted_at: string | null;
    settled_at: string | null;
    poster_wallet: string;
    assigned_agent: string | null;
    created_at: string;
  };
  applications: Array<{
    id: string;
    agent_wallet: string;
    message: string;
    status: string;
    created_at: string;
  }>;
  deliverable: {
    content_text: string | null;
    file_urls: string[] | null;
    submitted_at: string | null;
  } | null;
  verdict: {
    verdict: "pass" | "fail" | "unavailable";
    confidence: string | null;
    reasoning: string | null;
    failed_criteria: string[] | null;
  } | null;
  dispute: {
    reason: string | null;
    agent_response: string | null;
    ruling: string | null;
    opened_at: string | null;
  } | null;
};

export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const { publicKey } = useWallet();
  const [data, setData] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const { submitFromBase64 } = useTxSubmit();

  const wallet = publicKey?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/tasks/${taskId}`, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json()).error?.message ?? "Failed to load");
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/bounties" className="text-blue-400 hover:text-blue-300 text-sm">
          ← Back to bounties
        </Link>
        <div className="mt-4 bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-4">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Loading…</p>;

  const { task, applications, deliverable, verdict, dispute } = data;

  const isPoster = wallet === task.poster_wallet;
  const isAssignedAgent = wallet !== null && wallet === task.assigned_agent;

  async function withAction(fn: () => Promise<void>) {
    setActionError(null);
    setActionStatus(null);
    setActionBusy(true);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function postAndSign(path: string, headers: Record<string, string>, body?: object) {
    setActionStatus("Building transaction…");
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(path, init);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
    if (json.unsignedTx) {
      setActionStatus("Sign in your wallet…");
      await submitFromBase64(json.unsignedTx);
      setActionStatus("Confirmed ✓");
    } else {
      setActionStatus("Done ✓");
    }
    await refresh();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/bounties" className="text-blue-400 hover:text-blue-300 text-sm">
        ← Back to bounties
      </Link>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded border ${statusBadgeColor(task.status)}`}>
                {task.status}
              </span>
              <span className="text-xs text-gray-500 capitalize">{task.mode} mode</span>
              {isPoster && <span className="text-xs text-blue-300">you posted this</span>}
              {isAssignedAgent && <span className="text-xs text-emerald-300">assigned to you</span>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight mt-2">{task.title}</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-blue-300">
              {formatAmount(task.amount, task.currency)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatRelativeDeadline(task.deadline)}
            </div>
          </div>
        </div>

        <p className="text-gray-300 whitespace-pre-wrap mt-4">{task.description}</p>

        <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
          <Meta label="Poster" value={shortenWallet(task.poster_wallet)} />
          <Meta label="Assigned agent" value={shortenWallet(task.assigned_agent)} />
          <Meta label="Created" value={formatDate(task.created_at)} />
          <Meta label="Deadline" value={formatDate(task.deadline)} />
        </div>
      </div>

      <Section title="Acceptance criteria">
        <ol className="space-y-2 list-decimal list-inside text-gray-300 text-sm">
          {task.acceptance_criteria.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </Section>

      {/* Action panel renders depending on task state + viewer */}
      <ActionPanel
        wallet={wallet}
        isPoster={isPoster}
        isAssignedAgent={isAssignedAgent}
        task={task}
        applications={applications}
        verdict={verdict}
        busy={actionBusy}
        status={actionStatus}
        error={actionError}
        onApply={(msg) =>
          withAction(() =>
            postAndSign(
              `/api/v1/bounties/${task.task_id}/apply`,
              { "X-Agent-Wallet": wallet! },
              { message: msg },
            ),
          )
        }
        onAccept={(applicationId) =>
          withAction(() =>
            postAndSign(
              `/api/v1/bounties/${task.task_id}/accept`,
              { "X-Poster-Wallet": wallet! },
              { applicationId },
            ),
          )
        }
        onSubmit={(contentText) =>
          withAction(() =>
            postAndSign(
              `/api/v1/tasks/${task.task_id}/submit`,
              { "X-Agent-Wallet": wallet! },
              { contentText },
            ),
          )
        }
        onApprove={() =>
          withAction(() =>
            postAndSign(`/api/v1/tasks/${task.task_id}/approve`, {
              "X-Poster-Wallet": wallet!,
            }),
          )
        }
        onDispute={(reason) =>
          withAction(() =>
            postAndSign(
              `/api/v1/tasks/${task.task_id}/dispute`,
              { "X-Poster-Wallet": wallet! },
              { reason },
            ),
          )
        }
        onRunJudge={() =>
          withAction(async () => {
            setActionStatus("Calling Gemini…");
            const res = await fetch(`/api/v1/tasks/${task.task_id}/run-judge`, {
              method: "POST",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? "Judge failed");
            setActionStatus("Verdict in ✓");
            await refresh();
          })
        }
      />

      {task.mode === "bounty" && applications.length > 0 && (
        <Section title={`Applications (${applications.length})`}>
          <div className="space-y-3">
            {applications.map((a) => (
              <div key={a.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{shortenWallet(a.agent_wallet)}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusBadgeColor(a.status)}`}>
                      {a.status}
                    </span>
                    {isPoster && task.status === "created" && a.status === "pending" && (
                      <button
                        onClick={() =>
                          withAction(() =>
                            postAndSign(
                              `/api/v1/bounties/${task.task_id}/accept`,
                              { "X-Poster-Wallet": wallet! },
                              { applicationId: a.id },
                            ),
                          )
                        }
                        disabled={actionBusy}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded transition"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-300 mt-2">{a.message}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {deliverable && (
        <Section title="Deliverable">
          {deliverable.content_text && (
            <pre className="bg-gray-950 border border-gray-800 rounded-md p-3 text-sm whitespace-pre-wrap text-gray-300">
              {deliverable.content_text}
            </pre>
          )}
          {deliverable.file_urls && deliverable.file_urls.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {deliverable.file_urls.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {deliverable.submitted_at && (
            <p className="text-xs text-gray-500 mt-2">
              Submitted {formatDate(deliverable.submitted_at)}
            </p>
          )}
        </Section>
      )}

      {verdict && (
        <Section title="AI judge verdict">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-3 py-1 rounded text-sm font-semibold uppercase ${
                verdict.verdict === "pass"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : verdict.verdict === "fail"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-gray-500/20 text-gray-300"
              }`}
            >
              {verdict.verdict}
            </span>
            {verdict.confidence && (
              <span className="text-xs text-gray-500">
                confidence {(Number(verdict.confidence) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {verdict.reasoning && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{verdict.reasoning}</p>
          )}
        </Section>
      )}

      {dispute && (
        <Section title="Dispute">
          <p className="text-sm text-gray-300">
            <span className="text-gray-500">Poster:</span> {dispute.reason}
          </p>
          {dispute.agent_response && (
            <p className="text-sm text-gray-300 mt-2">
              <span className="text-gray-500">Agent response:</span> {dispute.agent_response}
            </p>
          )}
          {dispute.ruling && (
            <p className="text-sm mt-2">
              <span className="text-gray-500">Ruling:</span>{" "}
              <span className="font-semibold capitalize">{dispute.ruling}</span>
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function ActionPanel({
  wallet,
  isPoster,
  isAssignedAgent,
  task,
  applications,
  verdict,
  busy,
  status,
  error,
  onApply,
  onSubmit,
  onApprove,
  onDispute,
  onRunJudge,
}: {
  wallet: string | null;
  isPoster: boolean;
  isAssignedAgent: boolean;
  task: TaskDetail["task"];
  applications: TaskDetail["applications"];
  verdict: TaskDetail["verdict"];
  busy: boolean;
  status: string | null;
  error: string | null;
  onApply: (message: string) => void;
  onAccept: (applicationId: string) => void;
  onSubmit: (content: string) => void;
  onApprove: () => void;
  onDispute: (reason: string) => void;
  onRunJudge: () => void;
}) {
  const [applyMsg, setApplyMsg] = useState("");
  const [deliverableText, setDeliverableText] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  if (!wallet) {
    return (
      <Section title="Actions">
        <p className="text-sm text-gray-400">
          Connect your wallet (header) to apply, submit a deliverable, approve, or dispute.
        </p>
      </Section>
    );
  }

  const alreadyApplied = applications.some((a) => a.agent_wallet === wallet);
  const canApply =
    task.mode === "bounty" &&
    task.status === "created" &&
    !isPoster &&
    !alreadyApplied;
  const canSubmit = isAssignedAgent && task.status === "assigned";
  const canApprove = isPoster && task.status === "submitted";
  const canDispute = isPoster && task.status === "submitted";
  const canRunJudge =
    task.status === "submitted" && !verdict && (isPoster || isAssignedAgent);

  const showAny = canApply || canSubmit || canApprove || canDispute || canRunJudge;

  return (
    <Section title="Actions">
      {!showAny && (
        <p className="text-sm text-gray-500">
          Nothing to do here right now — task is in <code>{task.status}</code> state.
          {alreadyApplied && " You've already applied."}
        </p>
      )}

      {canApply && (
        <div className="space-y-2">
          <textarea
            value={applyMsg}
            onChange={(e) => setApplyMsg(e.target.value)}
            rows={3}
            placeholder="Why you're a good fit and what your approach will be…"
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => onApply(applyMsg)}
            disabled={busy || applyMsg.trim().length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition"
          >
            Apply to bounty
          </button>
          <p className="text-xs text-gray-500">
            Requires your wallet to be a registered agent. (
            <Link href="/agents/register" className="text-blue-400 hover:underline">
              Register here
            </Link>
            )
          </p>
        </div>
      )}

      {canSubmit && (
        <div className="space-y-2">
          <textarea
            value={deliverableText}
            onChange={(e) => setDeliverableText(e.target.value)}
            rows={6}
            placeholder="Inline deliverable content. For files use external URLs (R2/S3/GitHub)."
            className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => onSubmit(deliverableText)}
            disabled={busy || deliverableText.trim().length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition"
          >
            Submit deliverable
          </button>
          <p className="text-xs text-gray-500">
            Signs an on-chain <code>submit_deliverable</code> tx and starts the 24h verification
            window. The judge runs automatically.
          </p>
        </div>
      )}

      {canApprove && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onApprove}
            disabled={busy}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition"
          >
            Approve & release funds
          </button>
          <div className="flex-1 flex gap-2">
            <input
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Reason for dispute"
              className="flex-1 bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
            {canDispute && (
              <button
                onClick={() => onDispute(disputeReason)}
                disabled={busy || disputeReason.trim().length === 0}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition"
              >
                Dispute
              </button>
            )}
          </div>
        </div>
      )}

      {canRunJudge && (
        <div className="mt-3">
          <button
            onClick={onRunJudge}
            disabled={busy}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition"
          >
            Run AI judge now
          </button>
          <p className="text-xs text-gray-500 mt-1">
            The daemon will also run the judge automatically after seeing the on-chain submit
            event. This button is a manual trigger for demos.
          </p>
        </div>
      )}

      {status && (
        <div className="mt-3 bg-blue-500/10 border border-blue-500/40 text-blue-300 rounded-md p-3 text-sm flex items-center gap-2">
          {busy && (
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          {status}
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/40 text-red-300 rounded-md p-3 text-sm">
          {error}
        </div>
      )}
    </Section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-mono text-gray-300">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}
