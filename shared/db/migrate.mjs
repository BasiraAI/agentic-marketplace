/**
 * Minimal forward-only migration runner.
 * Reads shared/migrations/*.sql in lexicographic order, applies the ones
 * not yet recorded in _migrations, each inside its own transaction.
 *
 * Run from repo root:  pnpm --filter @basira/shared run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import dotenv from "dotenv";

// Load .env from the repo root (one level up from shared/)
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env") });

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL is not set");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const appliedRes = await pool.query("SELECT name FROM _migrations");
  const applied = new Set(appliedRes.rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply  ${file}`);
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`failed ${file}:`, err);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`done. applied ${ran} new migration(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
