import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function EmptyState({ icon, title, children, action, className, pattern = true }: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  pattern?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[10px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center", className)}>
      {pattern && <div aria-hidden="true" className="pattern-band absolute inset-x-0 top-0 h-3 opacity-60" />}
      {icon && (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold-ink">
          {icon}
        </div>
      )}
      <h2 className="font-display text-[20px] font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
