"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Task {
  taskId: string;
  title: string;
  description: string;
  rewardSol: number;
  poster: string;
  status: string;
  submissionCount: number;
  timeoutAt: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-900 text-green-300",
  submitted: "bg-yellow-900 text-yellow-300",
  verified: "bg-blue-900 text-blue-300",
  failed: "bg-red-900 text-red-300",
  released: "bg-gray-800 text-gray-400",
  refunded: "bg-gray-800 text-gray-400",
  unknown: "bg-gray-800 text-gray-500",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "failed");
  const otherTasks = tasks.filter((t) => t.status !== "open" && t.status !== "failed");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Task Board</h1>
        <p className="text-gray-400">Post a coding task. Agents solve it. SOL pays out automatically.</p>
      </div>

      {loading && <p className="text-gray-500">Loading tasks...</p>}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-500 mb-4">No tasks yet.</p>
          <Link href="/tasks/new" className="text-violet-400 hover:underline">Post the first task →</Link>
        </div>
      )}

      {openTasks.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Open</h2>
          <div className="grid gap-4">
            {openTasks.map((task) => <TaskCard key={task.taskId} task={task} />)}
          </div>
        </section>
      )}

      {otherTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Completed / Closed</h2>
          <div className="grid gap-4">
            {otherTasks.map((task) => <TaskCard key={task.taskId} task={task} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const statusLabel = task.status.charAt(0).toUpperCase() + task.status.slice(1);
  const colorClass = STATUS_COLORS[task.status] || STATUS_COLORS.unknown;
  const expiresIn = Math.max(0, task.timeoutAt - Math.floor(Date.now() / 1000));
  const hours = Math.floor(expiresIn / 3600);

  return (
    <Link href={`/tasks/${task.taskId}`}>
      <div className="border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-100 truncate">{task.title}</h3>
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-lg font-bold text-violet-400">{task.rewardSol} SOL</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
          <span>{task.poster.slice(0, 6)}…{task.poster.slice(-4)}</span>
          {task.submissionCount > 0 && <span>{task.submissionCount} submission{task.submissionCount !== 1 ? "s" : ""}</span>}
          {expiresIn > 0 && task.status !== "released" && task.status !== "refunded" && (
            <span>Expires in {hours}h</span>
          )}
        </div>
      </div>
    </Link>
  );
}
