"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { buttonClasses } from "@/components/ui/button";
import { APP_URL, STATIC_SITE } from "@/lib/static-site";
import { NAV } from "./content";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { AppearanceMenu } from "@/components/shell/appearance-menu";


/** Sign-in state is only known in the browser (see the (app) layout), so this part decides which button to show. */
export function PrimaryAction({ size = "md", className, staticSite = STATIC_SITE, appUrl = APP_URL }: { size?: "md" | "lg"; className?: string; staticSite?: boolean; appUrl?: string }) {
  const { state } = useSession();
  if (staticSite) {
    // The public copy has no session. With a hosted app it points there; without one the only action is to keep reading.
    return appUrl ? (
      <a href={`${appUrl}/login`} className={buttonClasses("primary", size, className)}>Try the demo</a>
    ) : (
      <a href="#run" className={buttonClasses("primary", size, className)}>See how it works</a>
    );
  }
  const signedIn = state.status === "authenticated";
  return (
    <Link href={signedIn ? "/ask" : "/login"} className={buttonClasses("primary", size, className)}>
      {signedIn ? "Open the app" : "Try the demo"}
    </Link>
  );
}

export function LandingHeader({ staticSite = STATIC_SITE, appUrl = APP_URL }: { staticSite?: boolean; appUrl?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line-strong bg-bg">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="BIL Knowledge Partner, home" className="shrink-0 whitespace-nowrap text-heading">
          {/* On very narrow screens only the mark is shown, so the header never overflows. */}
          <span className="min-[440px]:hidden"><LogoMark size={34} /></span>
          <span className="hidden min-[440px]:block"><Wordmark /></span>
        </Link>
        <nav aria-label="On this page" className="ml-6 hidden items-center gap-5 text-[15px] lg:flex">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} className="text-muted hover:text-heading hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AppearanceMenu />
          <PrimaryAction staticSite={staticSite} appUrl={appUrl} />
        </div>
      </div>
    </header>
  );
}
