import type { HTMLAttributes } from "react";
import { cn } from "@/lib/format";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[12px] border border-line bg-surface shadow-[var(--shadow-card)]", className)}
      {...rest}
    />
  );
}
