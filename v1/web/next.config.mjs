/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Phase 5 will add wallet adapters; for now, keep server-only deps off the
  // client bundle. shared/ has Node-only modules (pg, fs); never import from
  // client components without a "use server" boundary.
  serverExternalPackages: [
    "pg",
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "kysely",
    "node-cron",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
