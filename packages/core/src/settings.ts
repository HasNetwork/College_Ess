import { z } from "zod";

/**
 * Quiet hours, in each student's own time zone. Fixed, switched on or off per student
 * (0.5-4 §0, the user's decision); the scheduler and the settings guide both read it here.
 */
export const QUIET_HOURS = { startHour: 22, endHour: 7 } as const;

const hour12 = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;

/** True when this runtime knows `zone` as a time zone: "Asia/Kolkata", "America/New_York", "UTC". */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A student's time zone as stored: a known IANA zone, kept as sent. The scheduler formats
 * times in it, so an unknown zone must never reach the database. Not normalised: runtimes
 * disagree on the spelling (Node's ICU turns "Asia/Kolkata" into "Asia/Calcutta"), so
 * compare two zones with `sameTimeZone`, never with `===`.
 */
export const TimeZoneSchema = z.string().max(64).refine(isTimeZone, {
  message: "Not a known time zone",
});

/**
 * The zone this device's clock is set to, or `undefined` when the runtime reports none it
 * knows. Sending an unusable zone would fail a whole sign-up; leaving it out keeps the default.
 */
export function deviceTimeZone(): string | undefined {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isTimeZone(zone) ? zone : undefined;
}

/** Whether two zone names are the same zone in this runtime ("Asia/Calcutta", "Asia/Kolkata"). */
export function sameTimeZone(a: string, b: string): boolean {
  const canonical = (zone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  return isTimeZone(a) && isTimeZone(b) && canonical(a) === canonical(b);
}

/** The quiet-hours switch as stored: a boolean, never a string Postgres would coerce. */
export const QuietHoursEnabledSchema = z.boolean();

export interface SettingDefinition<T = unknown> {
  key: string;
  type: "boolean" | "string" | "number" | "select";
  default: T;
  group: string;
  label: string;
  description: string; // Required by the type! A setting cannot compile undocumented.
  audience: "user" | "co_admin" | "admin";
  editable: boolean; // false covers forced settings (e.g. exam reminders)
  options?: readonly string[];
}

export function defineSettings<T extends Record<string, SettingDefinition>>(definitions: T): T {
  for (const [key, def] of Object.entries(definitions)) {
    if (!def.description || def.description.trim() === "") {
      throw new Error(`Setting '${key}' must have a non-empty description`);
    }
  }
  return definitions;
}

/**
 * Single source of truth for application settings per PLAN 0-9 §4.
 * Drives: UI controls, runtime validation, stored types, and generated /guide/settings docs.
 */
export const SETTINGS = defineSettings({
  "admin.userMode": {
    key: "admin.userMode",
    type: "boolean",
    default: false,
    group: "Admin & Roles",
    label: "View as Student",
    description:
      "Temporarily browse College Ess as an ordinary student by suppressing all elevated administrative grants for this session.",
    audience: "admin",
    editable: true,
  },
  // Stored on the user row (`quiet_hours_enabled`), set through Better Auth's update-user.
  "reminders.quietHours.enabled": {
    key: "reminders.quietHours.enabled",
    type: "boolean",
    default: true,
    group: "Reminders",
    label: "Quiet hours",
    description: `Hold ordinary reminders between ${hour12(QUIET_HOURS.startHour)} and ${hour12(QUIET_HOURS.endHour)} in your time zone, and deliver them at ${hour12(QUIET_HOURS.endHour)}. Mandatory exam reminders ignore this setting.`,
    audience: "user",
    editable: true,
  },
  // Stored on the user row (`timezone`), set from the device at sign-up.
  "reminders.timeZone": {
    key: "reminders.timeZone",
    type: "string",
    default: "UTC",
    group: "Reminders",
    label: "Time zone",
    description:
      "Reminders arrive at their set time in this time zone, and quiet hours follow it. It's taken from your phone when you sign up. If you open College Ess on a device set to a different zone, it asks whether to switch.",
    audience: "user",
    editable: true,
  },
  "reminders.exams.forced": {
    key: "reminders.exams.forced",
    type: "boolean",
    default: true,
    group: "Reminders",
    label: "Exam reminders",
    description:
      "Academic policy requires all students to receive reminders for scheduled exams and assessments. This setting is mandatory and cannot be disabled.",
    audience: "user",
    editable: false,
  },
  "theme.mode": {
    key: "theme.mode",
    type: "select",
    default: "system",
    group: "Appearance",
    label: "Theme appearance",
    description:
      "Select your preferred visual appearance. 'System' automatically matches your device's light or dark mode setting.",
    audience: "user",
    editable: true,
    options: ["system", "light", "dark"],
  },
  "sync.offlineMode": {
    key: "sync.offlineMode",
    type: "boolean",
    default: true,
    group: "Offline & Storage",
    label: "Offline caching",
    description:
      "Persists your daily routine, wardrobe inventory, and campus guides locally in the browser so you can access them without internet connectivity.",
    audience: "user",
    editable: false,
  },
});

// Backward compatibility alias
export const SETTINGS_REGISTRY = SETTINGS;
export type SettingKey = keyof typeof SETTINGS;
