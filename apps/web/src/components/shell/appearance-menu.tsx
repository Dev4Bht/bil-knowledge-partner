"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { DEFAULT_ACCENT, PRESETS, normalizeHex, setAccent, useAccent } from "@/lib/accent";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";
import { useMediaQuery } from "@/lib/use-media-query";
import { IconButton } from "@/components/ui/button";
import { IconCheck, IconMonitor, IconMoon, IconPipette, IconSun } from "@/components/ui/icons";
import { cn } from "@/lib/format";

const MODES: { id: ThemePreference; label: string; Icon: typeof IconSun }[] = [
  { id: "light", label: "Light", Icon: IconSun },
  { id: "dark", label: "Dark", Icon: IconMoon },
  { id: "system", label: "System", Icon: IconMonitor },
];
const FALLBACK_CUSTOM = "#2f6fe0";

/** Arrow keys move through a radio group, as people expect from radios. */
function arrowNavigation(event: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const index = radios.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = radios[(index + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

export function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const theme = useThemePreference();
  const accent = useAccent();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  const [editingCustom, setEditingCustom] = useState(false);
  const [hexText, setHexText] = useState(accent.id === "custom" ? accent.hex : FALLBACK_CUSTOM);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentName = accent.id === "default" ? "Default" : (PRESETS.find((p) => p.id === accent.id)?.name ?? "Custom");
  const normalized = normalizeHex(hexText);
  const showError = editingCustom && hexText.trim() !== "" && normalized === null;

  const chooseHex = (value: string) => {
    setHexText(value);
    const hex = normalizeHex(value);
    if (hex) setAccent({ id: "custom", hex });
  };

  return (
    <div ref={root} className="relative">
      <IconButton
        ref={trigger}
        label="Appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {dark ? <IconMoon size={20} /> : <IconSun size={20} />}
      </IconButton>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Appearance"
          className="anim-fade absolute right-0 top-[calc(100%+8px)] z-40 w-[min(92vw,22rem)] rounded-[14px] border border-line bg-surface p-4 shadow-pop"
        >
          <h2 className="text-[16px] font-semibold text-heading">Appearance</h2>

          <div role="radiogroup" aria-label="Colour mode" onKeyDown={arrowNavigation} className="mt-3 grid grid-cols-3 gap-2">
            {MODES.map(({ id, label, Icon }) => {
              const selected = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setThemePreference(id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[10px] border px-2 py-2.5 text-[14px] font-medium transition-colors",
                    selected ? "border-primary bg-info-soft text-heading" : "border-line text-ink hover:bg-surface-3",
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <h3 className="text-[15px] font-semibold text-heading">Theme colour</h3>
            <span data-current-colour className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
              {currentName}
            </span>
          </div>

          <div role="radiogroup" aria-label="Theme colour" onKeyDown={arrowNavigation} className="mt-3">
            <button
              type="button"
              role="radio"
              aria-checked={accent.id === "default"}
              tabIndex={accent.id === "default" ? 0 : -1}
              onClick={() => {
                setEditingCustom(false);
                setAccent(DEFAULT_ACCENT);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-[15px] transition-colors",
                accent.id === "default" ? "border-primary bg-info-soft" : "border-line hover:bg-surface-3",
              )}
            >
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full" style={{ background: `linear-gradient(145deg, ${DEFAULT_ACCENT.hex}, #2f4170)` }}>
                {accent.id === "default" && <IconCheck size={18} className="text-white" />}
              </span>
              <span className="text-heading">Default <span className="text-muted">(BIL navy)</span></span>
            </button>

            <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
              {PRESETS.map((preset) => {
                const selected = accent.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => {
                      setEditingCustom(false);
                      setAccent({ id: preset.id, hex: preset.hex });
                    }}
                    className="group flex flex-col items-center gap-1 rounded-[10px] p-1 text-[12px] text-muted"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("grid size-12 place-items-center rounded-full transition-transform group-hover:scale-105", selected && "ring-2 ring-heading ring-offset-2 ring-offset-surface")}
                      style={{ background: `linear-gradient(145deg, ${preset.hex}, ${preset.hex}cc)` }}
                    >
                      {selected && <IconCheck size={20} className="text-white drop-shadow" />}
                    </span>
                    <span className={selected ? "font-medium text-heading" : ""}>{preset.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={accent.id === "custom"}
                tabIndex={accent.id === "custom" ? 0 : -1}
                onClick={() => {
                  setEditingCustom(true);
                  chooseHex(accent.id === "custom" ? accent.hex : hexText || FALLBACK_CUSTOM);
                }}
                className="group flex flex-col items-center gap-1 rounded-[10px] p-1 text-[12px] text-muted"
              >
                <span
                  aria-hidden="true"
                  className={cn("grid size-12 place-items-center rounded-full text-white transition-transform group-hover:scale-105", accent.id === "custom" && "ring-2 ring-heading ring-offset-2 ring-offset-surface")}
                  style={{ background: accent.id === "custom" ? accent.hex : "linear-gradient(145deg, #7c5cf0, #b058e0)" }}
                >
                  {accent.id === "custom" ? <IconCheck size={20} className="drop-shadow" /> : <IconPipette size={20} />}
                </span>
                <span className={accent.id === "custom" ? "font-medium text-heading" : ""}>Custom</span>
              </button>
            </div>
          </div>

          {(editingCustom || accent.id === "custom") && (
            <div className="mt-4 rounded-[10px] border border-line bg-surface-2 p-3">
              <label htmlFor={`${errorId}-hex`} className="text-[13px] font-medium text-heading">
                Hex colour
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick a colour"
                  value={normalized ?? FALLBACK_CUSTOM}
                  onChange={(event) => chooseHex(event.target.value)}
                  className="size-10 shrink-0 cursor-pointer rounded-[8px] border border-line bg-surface p-0.5"
                />
                <input
                  id={`${errorId}-hex`}
                  type="text"
                  inputMode="text"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={7}
                  value={hexText}
                  onChange={(event) => chooseHex(event.target.value)}
                  aria-invalid={showError}
                  aria-describedby={showError ? errorId : undefined}
                  className="h-10 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 font-mono text-[14px] text-ink"
                />
              </div>
              {showError && (
                <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-bad">
                  Use a colour like #2f6fe0.
                </p>
              )}
              <p className="mt-2 text-[12px] text-muted">Text and buttons adjust automatically so they stay easy to read.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
