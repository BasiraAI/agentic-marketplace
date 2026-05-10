import { Kysely, PostgresDialect } from "kysely";
import { getPool, resetPoolRef } from "./pool.js";
import type { Database } from "./types.js";

let instance: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (instance) return instance;
  instance = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: getPool() }),
  });
  return instance;
}

// Tearing down Kysely also ends the underlying pg.Pool, so we clear our
// pool reference too — calling closePool() afterwards would double-end.
export async function destroyDb(): Promise<void> {
  if (!instance) return;
  await instance.destroy();
  instance = null;
  resetPoolRef();
}
