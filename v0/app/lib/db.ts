import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), ".db.json");

interface TaskMeta {
  taskId: string;
  title: string;
  description: string;
  testSpec: string;
  rewardSol: number;
  poster: string;
  createdAt: string;
}

interface SubmissionMeta {
  submissionId: string;
  taskId: string;
  solver: string;
  code: string;
  submittedAt: string;
  verdict: "pending" | "pass" | "fail";
  claudeReason: string;
}

interface DB {
  tasks: TaskMeta[];
  submissions: SubmissionMeta[];
}

function readDb(): DB {
  if (!fs.existsSync(DB_PATH)) {
    return { tasks: [], submissions: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(db: DB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function saveTask(task: TaskMeta) {
  const db = readDb();
  db.tasks = db.tasks.filter((t) => t.taskId !== task.taskId);
  db.tasks.push(task);
  writeDb(db);
}

export function getTask(taskId: string): TaskMeta | undefined {
  return readDb().tasks.find((t) => t.taskId === taskId);
}

export function getAllTasks(): TaskMeta[] {
  return readDb().tasks;
}

export function saveSubmission(sub: SubmissionMeta) {
  const db = readDb();
  db.submissions = db.submissions.filter((s) => s.submissionId !== sub.submissionId);
  db.submissions.push(sub);
  writeDb(db);
}

export function getSubmission(submissionId: string): SubmissionMeta | undefined {
  return readDb().submissions.find((s) => s.submissionId === submissionId);
}

export function getSubmissionsForTask(taskId: string): SubmissionMeta[] {
  return readDb().submissions.filter((s) => s.taskId === taskId);
}

export function updateSubmissionVerdict(
  submissionId: string,
  verdict: "pass" | "fail",
  claudeReason: string
) {
  const db = readDb();
  const sub = db.submissions.find((s) => s.submissionId === submissionId);
  if (sub) {
    sub.verdict = verdict;
    sub.claudeReason = claudeReason;
    writeDb(db);
  }
}

export type { TaskMeta, SubmissionMeta };
