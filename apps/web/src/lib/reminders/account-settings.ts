import { authClient } from "@/lib/auth-client";

// Browser side of the account's reminder settings (0.5-4): saving them from a device, and
// naming time zones the way people say them.

const NOT_SAVED_OFFLINE = "You're offline, so this wasn't saved.";
const NOT_SAVED = "This wasn't saved. Try again.";

/**
 * Saves reminder settings to the account. Resolves to null once the server has them, or to
 * what to tell the student. Better Auth refreshes its session store about 10 ms after a
 * save, so the session catches up just after this resolves.
 */
export async function saveAccountSettings(settings: {
  timezone?: string;
  quietHoursEnabled?: boolean;
}): Promise<string | null> {
  try {
    const { data, error } = await authClient.updateUser(settings);
    if (error) return NOT_SAVED;
    // Anything else answered: a campus Wi-Fi login page sends its own page back with a 200.
    return data?.status === true ? null : NOT_SAVED_OFFLINE;
  } catch {
    // The request never reached anything.
    return NOT_SAVED_OFFLINE;
  }
}

function zoneNamePart(
  zone: string,
  style: "long" | "longGeneric" | "shortOffset",
): string | undefined {
  return new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: style })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
}

/** "Eastern Time", "India Standard Time": the name people use for a zone. */
function zoneName(zone: string): string {
  if (zone === "UTC" || zone === "Etc/UTC") return "UTC";
  return zoneNamePart(zone, "longGeneric") ?? zone;
}

/** "New York time": the zone's city, for when two zones share a name. */
function zoneCityName(zone: string): string {
  const city = zone.slice(zone.lastIndexOf("/") + 1).replaceAll("_", " ");
  return zone.includes("/") ? `${city} time` : city;
}

/**
 * Names two different zones so they can be told apart. New York and Detroit are both
 * "Eastern Time", so a pair that would read the same is named by city instead.
 */
export function zoneNames(a: string, b: string): [string, string] {
  const [first, second] = [zoneName(a), zoneName(b)];
  return first === second ? [zoneCityName(a), zoneCityName(b)] : [first, second];
}

/** "India Standard Time (GMT+5:30)": the selected zone, spelled out. */
export function zoneDescription(zone: string): string {
  const offset = zoneNamePart(zone, "shortOffset");
  const name = zoneNamePart(zone, "long") ?? zone;
  return offset && offset !== name ? `${name} (${offset})` : name;
}

/** The zones this browser knows, as IANA names. Empty where the browser can't list them. */
export function supportedTimeZones(): string[] {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
}

/**
 * `zones` with `zone` spelled exactly as given. Runtimes list some zones under another name
 * (Chrome's list has "Asia/Calcutta", a phone may save "Asia/Kolkata", and the list has no
 * "UTC"), and a select shows nothing for a value none of its options carry.
 */
export function withTimeZone(zones: string[], zone: string): string[] {
  if (zones.includes(zone)) return zones;
  const canonical = new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
  const listed = zones.indexOf(canonical);
  if (listed < 0) return [...zones, zone];
  const spelled = [...zones];
  spelled[listed] = zone;
  return spelled;
}

export interface TimeZoneGroup {
  region: string;
  zones: { value: string; label: string }[];
}

/** Zones grouped by region, each labelled by its city: "America" › "New York". */
export function groupTimeZones(zones: string[]): TimeZoneGroup[] {
  const groups = new Map<string, TimeZoneGroup["zones"]>();
  for (const value of zones) {
    const slash = value.indexOf("/");
    const other = slash < 0 || value.startsWith("Etc/");
    const region = other ? "Other" : value.slice(0, slash);
    // "Etc/GMT+5" is five hours behind GMT (IANA's sign is inverted): name it by its offset.
    const label = value.startsWith("Etc/")
      ? (zoneNamePart(value, "shortOffset") ?? value)
      : (slash < 0 ? value : value.slice(slash + 1)).replaceAll("_", " ").replaceAll("/", " / ");
    const group = groups.get(region) ?? [];
    group.push({ value, label });
    groups.set(region, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
    .map(([region, entries]) => ({
      region,
      zones: entries.sort((x, y) => x.label.localeCompare(y.label)),
    }));
}
