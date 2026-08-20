import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Letters",
  description: "Privacy-first email hosting for indie creators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
