"use client";

import { useEffect, type ReactNode } from "react";
import { syncAccent } from "@/lib/accent";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => syncAccent(), []); // keep the page in step with the saved theme colour
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
