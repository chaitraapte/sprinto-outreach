import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprinto Outreach",
  description: "Cold outreach at scale — scrape, qualify, contact, draft, send.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
