import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconSpinner } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-semibold",
    "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
    size === "sm" && "min-h-9 px-3 text-[14px]",
    size === "md" && "min-h-11 px-4 text-[15px] md:min-h-10",
    size === "lg" && "min-h-12 px-6 text-[16px]",
    variant === "primary" && "bg-primary text-primary-ink shadow-[var(--shadow-sm)] hover:bg-primary-hover",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-3",
    variant === "quiet" && "text-ink hover:bg-surface-3",
    variant === "danger" && "border border-bad bg-surface text-bad hover:bg-bad-soft",
    extra,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <IconSpinner size={16} /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(function IconButton(
  { label, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-[6px] text-ink transition-colors hover:bg-surface-3 md:size-10",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
