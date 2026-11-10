import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIL Knowledge Partner",
  description: "Sourced answers and draft replies from BIL's approved documents. Hackathon 2026 prototype.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
