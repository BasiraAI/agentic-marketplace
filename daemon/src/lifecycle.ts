import { Connection, PublicKey } from "@solana/web3.js";
import { closePool, destroyDb } from "@basira/shared";
import { getEnv } from "./env.js";
import { getLogger } from "./log.js";
import { startListener } from "./listener/index.js";
import { startCronJobs } from "./cron/index.js";
import { startHealthServer } from "./http.js";

type Stoppable = () => Promise<void> | void;

const stoppers: Stoppable[] = [];
let started = false;
let stopping = false;
const inflight = new Set<Promise<unknown>>();

export function registerStopper(fn: Stoppable): void {
  stoppers.push(fn);
}

export function trackInflight<T>(promise: Promise<T>): Promise<T> {
  inflight.add(promise);
  // Use catch to absorb rejections so unhandledRejection doesn't fire for
  // tracked work. Original promise is still returned so awaiters see errors.
  promise
    .catch((err) => {
      try {
        getLogger().error({ err }, "tracked inflight rejected");
      } catch {
        // logger not initialized; swallow
      }
    })
    .finally(() => inflight.delete(promise));
  return promise;
}

export function isStopping(): boolean {
  return stopping;
}

export async function startDaemon(): Promise<void> {
  if (started) return;
  started = true;
  const log = getLogger();
  const env = getEnv();
  log.info("daemon starting");

  const connection = new Connection(env.SOLANA_RPC_URL, {
    commitment: "confirmed",
    wsEndpoint: env.SOLANA_WS_URL,
  });
  const programId = new PublicKey(env.PROGRAM_ID);

  await startHealthServer(env.HEALTH_PORT);
  await startListener({ connection, programId });
  startCronJobs(connection);

  log.info("daemon ready");
}

export async function stopDaemon(): Promise<void> {
  if (stopping) return;
  stopping = true;
  const log = getLogger();
  log.info("daemon stopping");

  const drainTimeout = new Promise<void>((resolveDrain) =>
    setTimeout(() => {
      log.warn({ pending: inflight.size }, "graceful drain timed out at 30s");
      resolveDrain();
    }, 30_000),
  );
  await Promise.race([
    Promise.allSettled(Array.from(inflight)).then(() => undefined),
    drainTimeout,
  ]);

  for (const stopper of stoppers.reverse()) {
    try {
      await stopper();
    } catch (err) {
      log.error({ err }, "stopper failed");
    }
  }

  await destroyDb();
  await closePool();
  log.info("daemon stopped");
}
