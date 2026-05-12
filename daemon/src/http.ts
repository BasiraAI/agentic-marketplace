import { createServer, type Server } from "node:http";
import { daemonStateDb } from "@basira/shared";
import { getLogger } from "./log.js";
import { getCronStatus } from "./cron/index.js";
import { registerStopper } from "./lifecycle.js";

const startedAt = Date.now();

export async function startHealthServer(port: number): Promise<Server> {
  const log = getLogger();
  const server = createServer(async (req, res) => {
    if (req.url !== "/health" || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    let lastSeenSlot: string;
    try {
      lastSeenSlot = (await daemonStateDb.getLastSeenSlot()).toString();
    } catch (err) {
      lastSeenSlot = "unknown";
      log.warn({ err }, "/health: failed to read last_seen_slot");
    }
    const body = JSON.stringify({
      status: "ok",
      uptime_ms: Date.now() - startedAt,
      lastSeenSlot,
      lastCronRunAt: getCronStatus(),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
  });

  await new Promise<void>((r, j) => {
    server.once("error", j);
    server.listen(port, () => r());
  });
  log.info({ port }, "health server listening");

  registerStopper(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          log.info("health server closed");
          resolve();
        });
      }),
  );
  return server;
}
