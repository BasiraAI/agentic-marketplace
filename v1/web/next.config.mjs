import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the repo root (one level up from web/) so DATABASE_URL etc.
// are available without duplicating env files per workspace.
const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, "..", ".env");
if (existsSync(rootEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnv);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  transpilePackages: ["@basira/shared"],
  // Server-only deps stay out of the client bundle. shared/ uses pg, kysely,
  // anchor etc — never import from a client component without "use server".
  serverExternalPackages: [
    "pg",
    "@coral-xyz/anchor",
    "kysely",
    "node-cron",
    "@anthropic-ai/sdk",
  ],
  webpack(config) {
    // shared/ uses ESM-style ".js" suffixes on imports of .ts files
    // (NodeNext convention). Webpack needs the alias to resolve them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
