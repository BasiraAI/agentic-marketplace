import pino, { type Logger } from "pino";
import { getEnv } from "./env.js";

let cached: Logger | null = null;

export function getLogger(): Logger {
  if (cached) return cached;
  const env = getEnv();
  const isDev = env.NODE_ENV === "development";
  cached = pino({
    level: env.LOG_LEVEL,
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
          },
        }
      : {}),
  });
  return cached;
}
