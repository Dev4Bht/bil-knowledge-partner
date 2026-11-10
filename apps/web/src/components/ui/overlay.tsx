"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/format";
import { IconX } from "./icons";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focus trap, Escape to close, scroll lock, and focus return to the opener. */
export function useModal(ref: React.RefObject<HTMLElement | null>, onClose: () => void, initialFocus?: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target = initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    target?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[hidden]") && el.getAttribute("aria-hidden") !== "true");
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref, initialFocus]);
}

export function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocusRef, dismissible = true }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  dismissible?: boolean;
}) {
  if (!open) return null;
  return (
    <DialogInner onClose={onClose} title={title} description={description} footer={footer} size={size} initialFocusRef={initialFocusRef} dismissible={dismissible}>
      {children}
    </DialogInner>
  );
}

function DialogInner({ onClose, title, description, children, footer, size, initialFocusRef, dismissible }: Omit<Parameters<typeof Dialog>[0], "open"> & { size: "sm" | "md" | "lg" }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModal(ref, () => dismissible && onClose(), initialFocusRef);
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "anim-sheet flex max-h-[92dvh] w-full flex-col rounded-t-[16px] border border-line bg-surface shadow-[var(--shadow-modal)] sm:rounded-[16px]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[20px] font-semibold leading-snug">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-[14px] text-muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-3">
              <IconX size={18} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:rounded-b-[16px]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, subtitle, children, actions }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  if (!open) return null;
  return (
    <DrawerInner onClose={onClose} title={title} subtitle={subtitle} actions={actions}>
      {children}
    </DrawerInner>
  );
}

function DrawerInner({ onClose, title, subtitle, children, actions }: Omit<Parameters<typeof Drawer>[0], "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(ref, onClose);
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex justify-end bg-[var(--scrim)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="anim-slide flex h-full w-full max-w-[720px] flex-col border-l border-line bg-surface shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[19px] font-semibold leading-snug">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-[14px] text-muted">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <button type="button" onClick={onClose} aria-label="Close preview" className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-3">
              <IconX size={18} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
