import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconAlert, IconConflict, IconInfo, IconX } from "./icons";

export type CalloutKind = "info" | "warning" | "conflict" | "error" | "success";

const STYLE: Record<CalloutKind, string> = {
  info: "border-info/40 bg-info-soft text-ink [&_.callout-icon]:text-info",
  warning: "border-warn/45 bg-warn-soft text-ink [&_.callout-icon]:text-warn",
  conflict: "border-warn bg-warn-soft text-ink border-l-[6px] [&_.callout-icon]:text-warn",
  error: "border-bad/45 bg-bad-soft text-ink [&_.callout-icon]:text-bad",
  success: "border-ok/40 bg-ok-soft text-ink [&_.callout-icon]:text-ok",
};

export function Callout({ kind = "info", title, children, actions, className, onDismiss }: {
  kind?: CalloutKind;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const Icon = kind === "conflict" ? IconConflict : kind === "info" || kind === "success" ? IconInfo : IconAlert;
  return (
    <div
      role={kind === "error" ? "alert" : "note"}
      data-kind={kind}
      className={cn("relative flex gap-3 rounded-[10px] border p-3.5 text-[15px]", STYLE[kind], className)}
    >
      <Icon size={20} className="callout-icon mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-heading">{title}</p>}
        {children && <div className={cn("text-[15px] leading-relaxed", title && "mt-0.5")}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-m-1 h-8 w-8 shrink-0 rounded-md text-muted hover:bg-black/5">
          <IconX size={16} className="mx-auto" />
        </button>
      )}
    </div>
  );
}
