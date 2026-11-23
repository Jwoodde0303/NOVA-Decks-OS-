import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NOVA Decks OS", template: "%s · NOVA Decks OS" },
  description: "CRM, deck design and estimating for exterior contractors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
