"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const THEMES = [
  { value: "light", label: "Light mode", Icon: Sun },
  { value: "dark", label: "Dark mode", Icon: Moon },
  { value: "system", label: "System theme", Icon: Monitor },
] as const;

/**
 * Light, dark or the device's own setting: shadcn/ui's ToggleGroup as a segmented control.
 * Each option is 32 px drawn and 44 px to tap (R6).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ToggleGroup
      type="single"
      // The chosen theme is only known in the browser, so the server's HTML and the first
      // render mark none: they must agree.
      value={mounted ? (theme ?? "") : ""}
      // Tapping the chosen option again would clear the choice; keep it instead.
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
      aria-label="Theme selection"
      spacing={0.5}
      className={cn(
        "rounded-[var(--radius-full)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5",
        className,
      )}
    >
      {THEMES.map(({ value, label, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          size="sm"
          // The chosen option is a raised pill. On black a shadow doesn't show, so its rim does.
          className="rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-transparent hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-card)] data-[state=on]:text-[var(--text-primary)] data-[state=on]:shadow-[var(--shadow-sm)] data-[state=on]:ring-1 data-[state=on]:ring-[var(--border-subtle)] dark:data-[state=on]:bg-[var(--surface-raised)] dark:data-[state=on]:ring-[var(--border-strong)]"
        >
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
