import { getEnv } from "./env.js";
import { getLogger } from "./log.js";
import { startDaemon, stopDaemon } from "./lifecycle.js";

async function main(): Promise<void> {
  getEnv();
  const log = getLogger();

  let shuttingDown = false;
  const handle = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "received signal");
    stopDaemon()
      .then(() => process.exit(0))
      .catch((err) => {
        log.error({ err }, "shutdown error");
        process.exit(1);
      });
  };
  process.on("SIGTERM", handle);
  process.on("SIGINT", handle);

  process.on("unhandledRejection", (reason) => {
    log.fatal({ reason }, "unhandled rejection");
    process.exit(1);
  });

  await startDaemon();
}

main().catch((err) => {
  // Logger may not be initialized if env failed; fall back to process.stderr.
  process.stderr.write(`daemon failed to start: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
