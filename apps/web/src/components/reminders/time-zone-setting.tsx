"use client";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  groupTimeZones,
  saveAccountSettings,
  supportedTimeZones,
  withTimeZone,
  zoneDescription,
  zoneNames,
} from "@/lib/reminders/account-settings";
import { SETTINGS, deviceTimeZone, sameTimeZone } from "@clg-ess/core";
import { AlertCircle, Smartphone } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

/**
 * The account's time zone (0.5-4): reminders arrive on its clock and quiet hours follow it.
 * Saved on each change. A native select: 400-odd zones is what a phone's own picker is for.
 */
export function TimeZoneSetting({ saved }: { saved: string }) {
  const id = useId();
  const [device, setDevice] = useState<string | undefined>();
  const [saving, setSaving] = useState<string | null>(null);
  // Saved, while Better Auth's session store catches up (it refetches just after a save).
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevice(deviceTimeZone());
  }, []);

  useEffect(() => {
    if (confirmed !== null && sameTimeZone(confirmed, saved)) setConfirmed(null);
  }, [confirmed, saved]);

  const shown = saving ?? confirmed ?? saved;
  const zones = useMemo(supportedTimeZones, []);
  const groups = useMemo(() => groupTimeZones(withTimeZone(zones, shown)), [zones, shown]);

  const save = async (zone: string) => {
    if (saving !== null || sameTimeZone(zone, shown)) return;
    setSaving(zone);
    setError(null);
    const problem = await saveAccountSettings({ timezone: zone });
    setSaving(null);
    if (problem) setError(problem);
    else setConfirmed(zone);
  };

  const otherDeviceZone = device && !sameTimeZone(device, shown) ? device : null;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-primary)]">
        {SETTINGS["reminders.timeZone"].label}
      </label>
      <div className="sm:max-w-sm">
        <NativeSelect
          id={id}
          value={shown}
          onChange={(event) => void save(event.target.value)}
          aria-busy={saving !== null}
          aria-describedby={`${id}-zone`}
        >
          {groups.map((group) => (
            <NativeSelectOptGroup key={group.region} label={group.region}>
              {group.zones.map((zone) => (
                <NativeSelectOption key={zone.value} value={zone.value}>
                  {zone.label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </div>
      <p id={`${id}-zone`} className="text-sm text-[var(--text-secondary)]">
        {zoneDescription(shown)}
        {saving !== null && <span className="text-[var(--text-muted)]"> · Saving…</span>}
      </p>
      {otherDeviceZone && (
        <Button
          variant="secondary"
          className="h-auto w-full text-left sm:w-auto"
          aria-disabled={saving !== null}
          onClick={() => void save(otherDeviceZone)}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>Use this device's time zone ({zoneNames(otherDeviceZone, shown)[0]})</span>
        </Button>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
