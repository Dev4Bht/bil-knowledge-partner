import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
// Fonts are bundled from npm (open licence, SIL OFL). Nothing is requested from Google or any CDN.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/noto-serif-tibetan";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "BIL Knowledge Partner", template: "%s | BIL Knowledge Partner" },
  description: "Sourced answers and draft replies from BIL's approved documents. Hackathon 2026 prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b2a4e" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f20" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <NuqsAdapter>
          <Providers>{children}</Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
