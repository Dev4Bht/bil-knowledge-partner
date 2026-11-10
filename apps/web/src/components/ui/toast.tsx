"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string };
type ToastApi = { toast: (t: { tone?: ToastTone; title: string; description?: string }) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback<ToastApi["toast"]>(
    ({ tone = "info", title, description }) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={cn(
              "anim-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[10px] border bg-surface p-3.5 shadow-[var(--shadow-pop)]",
              item.tone === "success" && "border-ok/50",
              item.tone === "error" && "border-bad/60",
              item.tone === "info" && "border-line-strong",
            )}
          >
            <span className={cn("mt-0.5 shrink-0", item.tone === "success" && "text-ok", item.tone === "error" && "text-bad", item.tone === "info" && "text-info")}>
              {item.tone === "success" ? <IconCheck size={20} /> : item.tone === "error" ? <IconAlert size={20} /> : <IconInfo size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-heading">{item.title}</p>
              {item.description && <p className="mt-0.5 text-[14px] text-muted">{item.description}</p>}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)} className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-3">
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi["toast"] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
