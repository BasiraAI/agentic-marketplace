import cron from "node-cron";
import { Connection } from "@solana/web3.js";
import { getLogger } from "../log.js";
import { trackInflight, registerStopper } from "../lifecycle.js";
import { runAutoReleaseSweep } from "./auto-release.js";
import { runAutoDisputeSweep } from "./auto-dispute.js";
import { runExpireSweep } from "./expire.js";
import { runGhostDisputeSweep } from "./ghost-disputes.js";
import { runWebhookRetrySweep } from "./retry-webhooks.js";
import { runHealthCheckSweep } from "./health-check.js";

export type CronName =
  | "auto-release"
  | "auto-dispute"
  | "expire"
  | "ghost-disputes"
  | "retry-webhooks"
  | "health-check";

const lastRun: Record<CronName, Date | null> = {
  "auto-release": null,
  "auto-dispute": null,
  expire: null,
  "ghost-disputes": null,
  "retry-webhooks": null,
  "health-check": null,
};

export function getCronStatus(): Record<CronName, string | null> {
  return Object.fromEntries(
    Object.entries(lastRun).map(([k, v]) => [k, v ? v.toISOString() : null]),
  ) as Record<CronName, string | null>;
}

interface CronDef {
  name: CronName;
  schedule: string;
  run: (connection: Connection) => Promise<unknown>;
}

const SCHEDULES: CronDef[] = [
  { name: "auto-release", schedule: "*/5 * * * *", run: runAutoReleaseSweep },
  { name: "auto-dispute", schedule: "*/5 * * * *", run: runAutoDisputeSweep },
  { name: "expire", schedule: "*/5 * * * *", run: runExpireSweep },
  { name: "ghost-disputes", schedule: "*/5 * * * *", run: runGhostDisputeSweep },
  { name: "retry-webhooks", schedule: "* * * * *", run: () => runWebhookRetrySweep() },
  { name: "health-check", schedule: "0 * * * *", run: () => runHealthCheckSweep() },
];

export function startCronJobs(connection: Connection): void {
  const log = getLogger();
  const tasks: cron.ScheduledTask[] = [];
  for (const def of SCHEDULES) {
    const task = cron.schedule(def.schedule, () => {
      const promise = (async () => {
        try {
          await def.run(connection);
          lastRun[def.name] = new Date();
        } catch (err) {
          log.error({ err, cron: def.name }, "cron iteration threw");
        }
      })();
      trackInflight(promise);
    });
    tasks.push(task);
    log.info({ cron: def.name, schedule: def.schedule }, "cron scheduled");
  }
  registerStopper(() => {
    for (const t of tasks) t.stop();
    log.info("crons stopped");
  });
}
