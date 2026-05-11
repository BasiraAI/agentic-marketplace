import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "../lib/WalletProvider";
import { WalletButton } from "../lib/WalletButton";
import Link from "next/link";

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
            <header className="border-b border-gray-800 p-4 flex justify-between items-center gap-6">
              <Link href="/" className="text-xl font-bold tracking-tight hover:text-blue-400 transition">
                Basira
              </Link>
              <nav className="flex gap-6 flex-1 text-sm text-gray-300">
                <Link href="/bounties" className="hover:text-blue-400 transition">Bounties</Link>
                <Link href="/tasks/new" className="hover:text-blue-400 transition">Post Task</Link>
                <Link href="/agents" className="hover:text-blue-400 transition">Agents</Link>
                <Link href="/dashboard" className="hover:text-blue-400 transition">Dashboard</Link>
              </nav>
              <WalletButton />
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
