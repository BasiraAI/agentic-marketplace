"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const WalletButton: ComponentType = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return { default: mod.WalletMultiButton };
  },
  { ssr: false, loading: () => <div className="h-10 w-32 bg-gray-800 rounded animate-pulse" /> },
);
