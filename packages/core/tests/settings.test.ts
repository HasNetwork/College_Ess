import { describe, expect, it } from "vitest";
import { QUIET_HOURS, SETTINGS, TimeZoneSchema, sameTimeZone } from "../src/settings";

describe("time zone settings (0.5-4)", () => {
  it("accepts a real zone and refuses anything the scheduler could not format in", () => {
    expect(TimeZoneSchema.safeParse("Asia/Kolkata").success).toBe(true);
    expect(TimeZoneSchema.safeParse("UTC").success).toBe(true);
    expect(TimeZoneSchema.safeParse("Mars/Olympus_Mons").success).toBe(false);
    expect(TimeZoneSchema.safeParse("").success).toBe(false);
    expect(TimeZoneSchema.safeParse(42).success).toBe(false);
  });

  it("treats two spellings of one zone as the same zone", () => {
    // Runtimes disagree on India's spelling. Comparing names with === would make the
    // "your device is in another zone" prompt appear for a student who never moved.
    expect(sameTimeZone("Asia/Kolkata", "Asia/Calcutta")).toBe(true);
    expect(sameTimeZone("Asia/Kolkata", "Asia/Kolkata")).toBe(true);
    expect(sameTimeZone("Asia/Kolkata", "America/New_York")).toBe(false);
    expect(sameTimeZone("Asia/Kolkata", "Not/AZone")).toBe(false);
  });

  it("states the quiet-hours window the scheduler actually uses", () => {
    // The generated settings guide reads this description; it must not drift from the
    // window in QUIET_HOURS.
    expect(QUIET_HOURS).toEqual({ startHour: 22, endHour: 7 });
    expect(SETTINGS["reminders.quietHours.enabled"].description).toContain(
      "between 10:00 PM and 7:00 AM",
    );
  });
});
