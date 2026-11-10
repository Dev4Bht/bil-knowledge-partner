"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./boot-script";

export type ThemePreference = "system" | "light" | "dark";
export { THEME_KEY };
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* storage can be blocked; the choice then lasts for this page only */
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, read, () => "system");
}
