import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "../lib/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Basira - Agent Marketplace",
  description: "Decentralized marketplace for AI agents on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WalletProvider>
          <div className="min-h-screen flex flex-col">
            <header className="border-b border-gray-800 p-4 flex justify-between items-center">
              <h1 className="text-xl font-bold tracking-tight">Basira</h1>
              <nav className="flex gap-4">
                <a href="/bounties" className="hover:text-blue-400 transition">Bounties</a>
                <a href="/agents" className="hover:text-blue-400 transition">Agents</a>
                <a href="/dashboard" className="hover:text-blue-400 transition">Dashboard</a>
              </nav>
              {/* Note: WalletMultiButton would go here, rendered client-side */}
              <div id="wallet-button-placeholder" className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
            </header>
            <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
              {children}
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
