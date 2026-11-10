"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn, isAdmin } from "@/lib/format";
import { useSession } from "@/lib/session";
import { IconAsk, IconChevronRight, IconDocs, IconShield } from "@/components/ui/icons";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { CommandPalette, CommandPaletteTrigger } from "./command-palette";
import { CrumbProvider, useCrumb } from "./crumb";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type NavItem = { href: string; label: string; icon: ReactNode; match: (path: string) => boolean };

function navItems(admin: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/ask", label: "Ask", icon: <IconAsk />, match: (p) => p.startsWith("/ask") },
    { href: "/documents", label: "Documents", icon: <IconDocs />, match: (p) => p.startsWith("/documents") },
  ];
  if (admin) items.push({ href: "/admin/audit", label: "Audit", icon: <IconShield />, match: (p) => p.startsWith("/admin") });
  return items;
}

function Breadcrumb() {
  const pathname = usePathname();
  const label = useCrumb();
  const trail: { href?: string; text: string }[] = [];
  if (pathname.startsWith("/documents")) {
    trail.push({ href: "/documents", text: "Documents" });
    if (pathname !== "/documents") trail.push({ text: label ?? "Document" });
  } else if (pathname.startsWith("/ask")) trail.push({ text: "Ask" });
  else if (pathname.startsWith("/admin/audit")) trail.push({ text: "Audit log" });
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[14px] text-muted lg:flex">
      {trail.map((crumb, index) => (
        <span key={crumb.text} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && <IconChevronRight size={14} />}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-ink hover:underline">
              {crumb.text}
            </Link>
          ) : (
            <span aria-current="page" className="max-w-56 truncate font-semibold text-heading">
              {crumb.text}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const items = navItems(isAdmin(user));
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CrumbProvider>
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-gold px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      {/* Side rail: icons with labels from 768 px, wider from 1024 px. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col bg-rail text-rail-ink md:flex lg:w-60">
        <div className="flex h-16 items-center justify-center border-b border-white/10 lg:justify-start lg:px-5">
          <span className="lg:hidden">
            <LogoMark size={34} />
          </span>
          <Wordmark className="hidden text-white lg:flex" />
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex flex-col items-center gap-1 rounded-[10px] px-2 py-2.5 text-[12px] font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-3.5 lg:text-[15px]",
                  active ? "bg-white/12 text-white" : "text-rail-muted hover:bg-white/8 hover:text-white",
                )}
              >
                {active && <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-1 rounded-r bg-gold" />}
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="pattern-band h-10 opacity-40" aria-hidden="true" />
        <p className="px-4 pb-4 pt-2 text-center text-[11px] leading-snug text-rail-muted lg:text-left">
          <span className="hidden lg:inline">Hackathon 2026 prototype. Demo data is fictional.</span>
          <span className="lg:hidden">Demo</span>
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col md:pl-[84px] lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/92 px-3 backdrop-blur sm:gap-3 sm:px-5 md:px-6">
          <span className="md:hidden">
            <LogoMark size={32} />
          </span>
          <Breadcrumb />
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2 lg:flex-none lg:flex-initial">
            <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 outline-none sm:px-6 md:px-8 md:pb-12 md:pt-7">
          {children}
        </main>
      </div>

      {/* Phone: bottom tab bar with 44 px+ targets. */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-rail pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold",
                active ? "text-white" : "text-rail-muted",
              )}
            >
              {active && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-gold" />}
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </CrumbProvider>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh md:pl-[84px] lg:pl-60" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="fixed inset-y-0 left-0 hidden w-[84px] bg-rail md:block lg:w-60" aria-hidden="true" />
      <div className="h-16 border-b border-line" aria-hidden="true" />
      <div className="space-y-4 p-6" aria-hidden="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

/** Redirects anonymous visitors to /login and keeps the page they wanted in `next`. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (state.status === "anonymous") {
      // After an explicit sign out there is nothing to come back to, so no `next`.
      const next = state.reason !== "signed_out" && pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname + window.location.search)}` : "";
      router.replace(`/login${next}`);
    }
  }, [state, pathname, router]);
  if (state.status !== "authenticated") return <ShellSkeleton />;
  return <AppShell>{children}</AppShell>;
}
