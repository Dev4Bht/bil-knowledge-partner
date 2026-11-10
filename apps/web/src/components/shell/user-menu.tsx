"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initials, roleOf } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconChevronDown, IconLogout } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

export function UserMenu() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const role = roleOf(user);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      toast({ tone: "info", title: "You have signed out" });
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu for ${user.display_name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-[10px] px-1.5 py-1 hover:bg-surface-3 md:min-h-10"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white ring-2 ring-gold/70">
          {initials(user.display_name)}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-36 truncate text-[14px] font-semibold text-heading">{user.display_name}</span>
          <span className="block text-[12px] capitalize text-muted">{role}</span>
        </span>
        <IconChevronDown size={16} className="hidden text-muted md:block" />
      </button>
      {open && (
        <div className="anim-rise absolute right-0 top-full z-40 mt-2 w-72 rounded-[10px] border border-line bg-surface p-3 shadow-[var(--shadow-pop)]">
          <p className="truncate text-[15px] font-semibold text-heading">{user.display_name}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
          <div className="mt-2">
            <Badge tone="info">Role: {role}</Badge>
          </div>
          <p className="mt-3 text-[12px] leading-snug text-muted">
            What you can see and do is decided by the server for this role. Hidden buttons are a convenience, not security.
          </p>
          <Button variant="secondary" className="mt-3 w-full" onClick={handleSignOut} loading={busy} icon={<IconLogout size={18} />}>
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
