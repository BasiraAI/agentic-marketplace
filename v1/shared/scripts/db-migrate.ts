import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { runner } from "node-pg-migrate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the repo root if present (Node 20.6+).
const envPath = resolve(__dirname, "..", "..", ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  await runner({
    databaseUrl,
    dir: resolve(__dirname, "..", "migrations"),
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Infinity,
    verbose: true,
  });
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
