import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task Marketplace",
  description: "Post coding tasks. Agents solve them. SOL pays out.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <WalletContextProvider>
          <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-lg font-semibold tracking-tight">TaskMarket</a>
            <div className="flex items-center gap-4">
              <a href="/tasks/new" className="text-sm bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg transition-colors">
                Post Task
              </a>
            </div>
          </nav>
          <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
            {children}
          </main>
        </WalletContextProvider>
      </body>
    </html>
  );
}
