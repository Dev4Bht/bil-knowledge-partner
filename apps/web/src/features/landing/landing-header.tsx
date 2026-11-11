"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { buttonClasses } from "@/components/ui/button";
import { STATIC_SITE } from "@/lib/static-site";
import { Wordmark } from "@/components/ui/logo";
import { AppearanceMenu } from "@/components/shell/appearance-menu";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Why you can trust it" },
  { href: "#results", label: "Results" },
  { href: "#limits", label: "Limits" },
];

/** Sign-in state is only known in the browser (see the (app) layout), so this part decides which button to show. */
export function PrimaryAction({ size = "md", className, staticSite = STATIC_SITE }: { size?: "md" | "lg"; className?: string; staticSite?: boolean }) {
  const { state } = useSession();
  if (staticSite) {
    // The public copy of this page has no demo behind it, so the one action is to keep reading.
    return <a href="#how" className={buttonClasses("primary", size, className)}>See how it works</a>;
  }
  const signedIn = state.status === "authenticated";
  return (
    <Link href={signedIn ? "/ask" : "/login"} className={buttonClasses("primary", size, className)}>
      {signedIn ? "Open the app" : "Try the demo"}
    </Link>
  );
}

export function LandingHeader({ staticSite = STATIC_SITE }: { staticSite?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="BIL Knowledge Partner, home" className="text-heading">
          <Wordmark />
        </Link>
        <nav aria-label="On this page" className="ml-6 hidden items-center gap-5 text-[15px] md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-muted hover:text-heading hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AppearanceMenu />
          <PrimaryAction staticSite={staticSite} />
        </div>
      </div>
    </header>
  );
}
