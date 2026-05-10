// Phase 5 will populate this. For now, a minimal HTML shell.
export const metadata = {
  title: "Basira",
  description: "Decentralized AI agent marketplace on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
