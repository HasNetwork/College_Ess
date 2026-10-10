"use client";

import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-surface";
import { authClient } from "@/lib/auth-client";
import { saveAccountSettings, zoneNames } from "@/lib/reminders/account-settings";
import { SETTINGS, deviceTimeZone, sameTimeZone } from "@clg-ess/core";
import { AlertCircle, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

// A Keep is remembered on this device only, per account and per device zone: another account
// here is still asked, and so is this one once the device is in a third zone.
const keepKey = (userId: string, deviceZone: string) => `clg_ess_tz_keep:${userId}:${deviceZone}`;

function keptZone(userId: string, deviceZone: string): string | null {
  try {
    return localStorage.getItem(keepKey(userId, deviceZone));
  } catch {
    return null;
  }
}

function rememberKeep(userId: string, deviceZone: string, zone: string): void {
  try {
    localStorage.setItem(keepKey(userId, deviceZone), zone);
  } catch {
    // Storage is off (a private window): it stops asking on this page only.
  }
}

/**
 * Asks before reminders follow this device's clock, when it differs from the account's zone
 * (0.5-4 §0, decision 2). Switch saves the device's zone to the account; Keep is remembered
 * here. Mounted once, by AppShell.
 */
export function TimeZonePrompt() {
  const session = authClient.useSession();
  const [device, setDevice] = useState<string | undefined>();
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevice(deviceTimeZone());
  }, []);

  const user = session.data?.user;
  if (session.isPending || !user || !device || answered) return null;
  const saved = user.timezone ?? SETTINGS["reminders.timeZone"].default;
  if (sameTimeZone(device, saved)) return null;
  const kept = keptZone(user.id, device);
  if (kept !== null && sameTimeZone(kept, saved)) return null;

  const [deviceName, savedName] = zoneNames(device, saved);

  const handleSwitch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await saveAccountSettings({ timezone: device });
    setBusy(false);
    if (problem) setError(problem);
    else setAnswered(true);
  };

  const handleKeep = () => {
    if (busy) return;
    rememberKeep(user.id, device, saved);
    setAnswered(true);
  };

  return (
    <GlassSurface
      chromeRole="toast"
      className="pointer-events-auto rounded-[var(--radius-lg)] p-4 transition-[opacity,translate] duration-300 starting:translate-y-2 starting:opacity-0"
    >
      <div className="flex items-start gap-3">
        <Globe aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-[var(--text-primary)]">
            Your device is on {deviceName}. Reminders use {savedName}.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              aria-busy={busy}
              aria-disabled={busy}
              onClick={() => void handleSwitch()}
            >
              {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Switch to {deviceName}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              aria-disabled={busy}
              onClick={handleKeep}
            >
              Keep {savedName}
            </Button>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-[var(--destructive)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    </GlassSurface>
  );
}
