"use client";

import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";
import { IconButton } from "@/components/ui/button";
import { IconMonitor, IconMoon, IconSun } from "@/components/ui/icons";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const LABEL: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeToggle() {
  const preference = useThemePreference();
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  const Icon = preference === "dark" ? IconMoon : preference === "light" ? IconSun : IconMonitor;
  return (
    <IconButton label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[next]}`} onClick={() => setThemePreference(next)}>
      <Icon size={20} />
    </IconButton>
  );
}
