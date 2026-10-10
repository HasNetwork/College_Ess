"use client";

import { isIosSafariNotInstalled } from "@/components/shell/ios-install-prompt";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Bell, BellOff, Lock } from "lucide-react";
import { useEffect, useState } from "react";

export interface ReminderToggleProps {
  id?: string;
  label?: string;
  enabled?: boolean;
  forced?: boolean;
  disabled?: boolean;
  onChange?: (enabled: boolean) => void;
  className?: string;
}

export function ReminderToggle({
  id = "reminder-toggle",
  label = "Enable Reminders",
  enabled = true,
  forced = false,
  disabled = false,
  onChange,
  className = "",
}: ReminderToggleProps) {
  const [isIosUninstalled, setIsIosUninstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsIosUninstalled(isIosSafariNotInstalled());
  }, []);

  if (!mounted) {
    return (
      <div className={`flex items-center gap-3 animate-pulse ${className}`.trim()}>
        <div className="h-6 w-11 rounded-full bg-[var(--surface-sunken)]" />
        <div className="h-4 w-32 rounded bg-[var(--surface-sunken)]" />
      </div>
    );
  }

  // Case 1: iOS Safari not installed as PWA (PLAN 0-8 §3)
  // NEVER show an enabled-looking toggle that cannot deliver!
  if (isIosUninstalled) {
    return (
      <div
        className={`p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-2 text-sm ${className}`.trim()}
      >
        <div className="flex items-center gap-2 text-[var(--warning)] font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Reminders Require PWA Installation</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          On Apple iOS, Web Push notifications cannot be delivered in browser tabs. To enable
          reminders, tap <strong>Share</strong> in Safari and select{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      </div>
    );
  }

  // Case 2: Forced reminder (Exams) (PLAN 0-8 §4)
  // Exams are forced (forced = true). Show as fixed with clear explanation.
  if (forced) {
    return (
      <div
        className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-sm ${className}`.trim()}
      >
        <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--primary)]/10 text-[var(--primary)] shrink-0 mt-0.5">
          <Lock className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">{label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-bold uppercase tracking-wider">
              Mandatory
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Exam reminders are mandatory per campus policy to prevent missed assessments. They will
            deliver even during quiet hours.
          </p>
        </div>
      </div>
    );
  }

  // Case 3: Standard opt-in reminder toggle
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`.trim()}>
      <div className="flex items-center gap-2.5">
        {enabled ? (
          <Bell className="h-4 w-4 text-[var(--primary)]" />
        ) : (
          <BellOff className="h-4 w-4 text-[var(--text-muted)]" />
        )}
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--text-primary)] cursor-pointer select-none"
        >
          {label}
        </label>
      </div>

      {/* The shared switch: 44 px to tap, on the tokens (0.5-5). */}
      <Switch
        id={id}
        checked={enabled}
        disabled={disabled}
        onCheckedChange={(on) => onChange?.(on)}
      />
    </div>
  );
}
