import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  pool = new pg.Pool({ connectionString });
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

/**
 * Used by destroyDb() to release our reference after Kysely has already
 * ended the pool internally. Avoids a "Called end on pool more than once" error.
 */
export function resetPoolRef(): void {
  pool = null;
}
