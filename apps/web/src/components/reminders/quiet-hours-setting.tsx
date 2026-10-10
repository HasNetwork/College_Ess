"use client";

import { Switch } from "@/components/ui/switch";
import { saveAccountSettings } from "@/lib/reminders/account-settings";
import { QUIET_HOURS, SETTINGS } from "@clg-ess/core";
import { AlertCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";

/** "10:00 PM", or "22:00" where the device keeps a 24-hour clock. */
function clockHour(hour: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 1, hour));
}

/** The account's quiet hours (0.5-4), saved on each toggle so every device follows them. */
export function QuietHoursSetting({ saved }: { saved: boolean }) {
  const id = useId();
  const [saving, setSaving] = useState<boolean | null>(null);
  // Saved, while Better Auth's session store catches up (it refetches just after a save).
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (confirmed === saved) setConfirmed(null);
  }, [confirmed, saved]);

  const shown = saving ?? confirmed ?? saved;

  const handleChange = async (next: boolean) => {
    if (saving !== null) return;
    setSaving(next);
    setError(null);
    const problem = await saveAccountSettings({ quietHoursEnabled: next });
    setSaving(null);
    if (problem) setError(problem);
    else setConfirmed(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
            {SETTINGS["reminders.quietHours.enabled"].label}
          </label>
          {saving !== null && <span className="text-xs text-[var(--text-muted)]">Saving…</span>}
        </div>
        <Switch
          id={id}
          checked={shown}
          onCheckedChange={(next) => void handleChange(next)}
          aria-busy={saving !== null}
          aria-disabled={saving !== null}
          aria-describedby={`${id}-window`}
        />
      </div>
      <p id={`${id}-window`} className="text-sm text-[var(--text-secondary)]">
        Ordinary reminders wait from {clockHour(QUIET_HOURS.startHour)} to{" "}
        {clockHour(QUIET_HOURS.endHour)} in your time zone. Exam reminders still come through.
      </p>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
