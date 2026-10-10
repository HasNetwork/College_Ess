import { resolve } from "node:path";
import { schema } from "@clg-ess/db";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import {
  calculateNextFireAt,
  isWithinQuietHours,
  processReminderTick,
} from "../src/lib/reminders/scheduler";
import { getVapidPublicKey, type sendPushNotification } from "../src/lib/reminders/vapid";

describe("Phase 0-8 Reminder Engine & Push Tests", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testUser: schema.User;
  let college: schema.College;
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic db instance
  let testDb: any;

  beforeAll(async () => {
    const client = new PGlite();
    db = drizzle(client, { schema });
    testDb = db;
    const migrationsFolder = resolve(__dirname, "../../../packages/db/drizzle");
    await migrate(db, { migrationsFolder });

    // Seed college & test user
    const [c] = await db
      .insert(schema.colleges)
      .values({
        name: "Test Institute",
        slug: "test-inst",
        domain: "test.edu",
      })
      .returning();
    if (!c) throw new Error("Failed to seed college");
    college = c;

    const [u] = await db
      .insert(schema.user)
      .values({
        name: "Student Tester",
        email: "tester@test.edu",
        collegeId: college.id,
      })
      .returning();
    if (!u) throw new Error("Failed to seed user");
    testUser = u;
  }, 30000);

  // The "two overlapping ticks" test that lived here awaited its ticks sequentially and
  // passed with the claim logic deleted (R17). Its concurrent replacement goes through the
  // real route: tests/tick-route.test.ts.

  describe("Subject Deletion Guard", () => {
    it("does not fire when the subject item is soft-deleted", async () => {
      const now = new Date("2026-09-21T12:00:00Z");

      // Insert soft-deleted subject item
      const itemId = uuidv7();
      await db.insert(schema.items).values({
        id: itemId,
        collegeId: college.id,
        userId: testUser.id,
        title: "Deleted Class",
        kind: "event",
        deletedAt: new Date("2026-09-21T11:00:00Z"),
      });

      // Insert due reminder
      const reminderId = uuidv7();
      await db.insert(schema.reminders).values({
        id: reminderId,
        userId: testUser.id,
        subjectType: "item",
        subjectId: itemId,
        triggerKind: "absolute",
        triggerValue: now.toISOString(),
        channel: "push",
        forced: false,
        enabled: true,
        nextFireAt: now,
      });

      let pushFired = false;
      const mockPushSender: typeof sendPushNotification = async () => {
        pushFired = true;
        return { success: true };
      };

      const tickResult = await processReminderTick({
        db: testDb,
        now,
        pushSender: mockPushSender,
      });

      expect(tickResult.suppressedDeletedSubjectCount).toBe(1);
      expect(tickResult.deliveredCount).toBe(0);
      expect(pushFired).toBe(false);

      // Verify reminder was disabled
      const [r] = await db
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.id, reminderId));
      expect(r?.enabled).toBe(false);
    });
  });

  describe("Quiet Hours & Exam Forcing (PLAN 0-8 §4)", () => {
    it("suppresses normal reminders during quiet hours", () => {
      // 11 PM UTC (in quiet hours: 22:00 to 07:00)
      const lateNight = new Date("2026-09-21T23:00:00Z");
      const config = { enabled: true, startHour: 22, endHour: 7, timezone: "UTC" };

      expect(isWithinQuietHours(lateNight, config)).toBe(true);

      // 2 PM UTC (outside quiet hours)
      const afternoon = new Date("2026-09-21T14:00:00Z");
      expect(isWithinQuietHours(afternoon, config)).toBe(false);
    });

    it("forced exam reminders bypass quiet hours and deliver", async () => {
      // 11 PM UTC (Quiet hours active)
      const lateNight = new Date("2026-09-21T23:30:00Z");

      const examItemId = uuidv7();
      await db.insert(schema.items).values({
        id: examItemId,
        collegeId: college.id,
        userId: testUser.id,
        title: "Final Exam",
        kind: "exam",
      });

      // 1. Normal reminder (forced = false)
      const normalId = uuidv7();
      await db.insert(schema.reminders).values({
        id: normalId,
        userId: testUser.id,
        subjectType: "item",
        subjectId: examItemId,
        triggerKind: "absolute",
        triggerValue: lateNight.toISOString(),
        channel: "push",
        forced: false,
        enabled: true,
        nextFireAt: lateNight,
      });

      // 2. Exam reminder (forced = true)
      const examReminderId = uuidv7();
      await db.insert(schema.reminders).values({
        id: examReminderId,
        userId: testUser.id,
        subjectType: "item",
        subjectId: examItemId,
        triggerKind: "absolute",
        triggerValue: lateNight.toISOString(),
        channel: "push",
        forced: true, // MANDATORY EXAM
        enabled: true,
        nextFireAt: lateNight,
      });

      // A device to deliver to. This test used to borrow the subscription left behind by an
      // earlier test, so it silently depended on test order.
      await db.insert(schema.pushSubscriptions).values({
        userId: testUser.id,
        endpoint: "https://push.service.example/exam-device",
        p256dh: "exam_p256dh_key",
        auth: "exam_auth_secret",
      });

      const deliveredPayloads: string[] = [];
      const mockPushSender: typeof sendPushNotification = async (_sub, payload) => {
        deliveredPayloads.push(payload.title);
        return { success: true };
      };

      const tick = await processReminderTick({
        db: testDb,
        now: lateNight,
        pushSender: mockPushSender,
      });

      expect(tick.suppressedQuietHoursCount).toBe(1); // Normal reminder suppressed
      expect(tick.deliveredCount).toBe(1); // Forced exam reminder delivered!
      expect(deliveredPayloads[0]).toContain("Mandatory Exam");
    });
  });

  describe("Pruning Dead Subscriptions (410 Gone)", () => {
    it("deletes push subscription on 410 Gone response", async () => {
      const now = new Date("2026-09-21T15:00:00Z");

      const itemId = uuidv7();
      await db.insert(schema.items).values({
        id: itemId,
        collegeId: college.id,
        userId: testUser.id,
        title: "Habit Check",
        kind: "todo",
      });

      await db.insert(schema.reminders).values({
        id: uuidv7(),
        userId: testUser.id,
        subjectType: "item",
        subjectId: itemId,
        triggerKind: "absolute",
        triggerValue: now.toISOString(),
        channel: "push",
        forced: false,
        enabled: true,
        nextFireAt: now,
      });

      const deadEndpoint = "https://push.service.example/dead-device";
      await db.insert(schema.pushSubscriptions).values({
        userId: testUser.id,
        endpoint: deadEndpoint,
        p256dh: "dead_key",
        auth: "dead_auth",
      });

      // Mock push sender returning 410 Gone
      const mockPushSender: typeof sendPushNotification = async (sub) => {
        if (sub.endpoint === deadEndpoint) {
          return { success: false, isGone: true, statusCode: 410 };
        }
        return { success: true };
      };

      const tick = await processReminderTick({
        db: testDb,
        now,
        pushSender: mockPushSender,
      });

      expect(tick.purgedSubscriptionsCount).toBe(1);

      // Verify dead subscription was purged from DB
      const [purgedCheck] = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.endpoint, deadEndpoint));
      expect(purgedCheck).toBeUndefined();
    });
  });

  // "9:00" means 9:00 on the student's own clock (0.5-4 §2). Until 0.5-4 the time was built
  // with a literal `Z`, so a 9:00 reminder fired at 14:30 in Kolkata and 05:00 in New York.
  // India has no DST, which is why the DST cases use zones that do (R9).
  describe("Timezone, DST & Bounded Catch-Up", () => {
    const daily = (value: string, firedFor: string, now: string, zone: string) =>
      calculateNextFireAt(new Date(firedFor), "recurring", value, new Date(now), zone);

    it("advances an interval reminder past now without bursting the missed ones", () => {
      // Hourly, three hours late: one send now, the next on the original hourly grid.
      const next = daily("3600000", "2026-09-21T09:00:00Z", "2026-09-21T12:10:00Z", "UTC");
      expect(next.at?.toISOString()).toBe("2026-09-21T13:00:00.000Z");
      expect(next.missed).toBe(3);
    });

    it("keeps 9:00 on the local clock in Kolkata, not 9:00 UTC", () => {
      const next = daily(
        "daily@09:00",
        "2026-09-21T03:30:00Z",
        "2026-09-21T03:30:20Z",
        "Asia/Kolkata",
      );
      expect(next.at?.toISOString()).toBe("2026-09-22T03:30:00.000Z"); // 09:00 IST
      expect(next.missed).toBe(0);
    });

    it("stays 9:00 local when New York springs forward", () => {
      // 2026-03-08: 09:00 EST is 14:00Z the day before, 09:00 EDT is 13:00Z.
      const next = daily(
        "daily@09:00",
        "2026-03-07T14:00:00Z",
        "2026-03-07T14:00:30Z",
        "America/New_York",
      );
      expect(next.at?.toISOString()).toBe("2026-03-08T13:00:00.000Z");
    });

    it("stays 9:00 local when New York falls back", () => {
      // 2026-11-01: 09:00 EDT is 13:00Z the day before, 09:00 EST is 14:00Z.
      const next = daily(
        "daily@09:00",
        "2026-10-31T13:00:00Z",
        "2026-10-31T13:00:30Z",
        "America/New_York",
      );
      expect(next.at?.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    });

    it("stays 9:00 local when London springs forward", () => {
      const next = daily(
        "daily@09:00",
        "2026-03-28T09:00:00Z",
        "2026-03-28T09:00:30Z",
        "Europe/London",
      );
      expect(next.at?.toISOString()).toBe("2026-03-29T08:00:00.000Z"); // 09:00 BST
    });

    it("moves a time the clocks skip to just after the jump, and returns the next day", () => {
      // 02:30 does not exist in New York on 2026-03-08: it fires at 03:30 EDT, then
      // 02:30 EDT the day after. It neither sticks nor skips a day.
      const skipped = daily(
        "daily@02:30",
        "2026-03-07T07:30:00Z",
        "2026-03-07T07:30:30Z",
        "America/New_York",
      );
      expect(skipped.at?.toISOString()).toBe("2026-03-08T07:30:00.000Z"); // 03:30 EDT
      const after = daily(
        "daily@02:30",
        "2026-03-08T07:30:00Z",
        "2026-03-08T07:30:30Z",
        "America/New_York",
      );
      expect(after.at?.toISOString()).toBe("2026-03-09T06:30:00.000Z"); // 02:30 EDT
    });

    it("fires a time that happens twice once, at its first occurrence", () => {
      // 01:30 happens twice in New York on 2026-11-01 (EDT, then EST): the first is 05:30Z.
      const next = daily(
        "daily@01:30",
        "2026-10-31T05:30:00Z",
        "2026-10-31T05:30:30Z",
        "America/New_York",
      );
      expect(next.at?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    });

    it("crosses a month boundary on the local calendar, not the UTC one", () => {
      // 04:00 IST on 1 February is still 31 January in UTC.
      const next = daily(
        "daily@04:00",
        "2026-01-30T22:30:00Z",
        "2026-01-30T22:30:30Z",
        "Asia/Kolkata",
      );
      expect(next.at?.toISOString()).toBe("2026-01-31T22:30:00.000Z");
    });

    it("crosses a year boundary on the local calendar", () => {
      // 23:30 on New Year's Eve in Los Angeles is already 1 January in UTC.
      const next = daily(
        "daily@23:30",
        "2027-01-01T07:30:00Z",
        "2027-01-01T07:30:30Z",
        "America/Los_Angeles",
      );
      expect(next.at?.toISOString()).toBe("2027-01-02T07:30:00.000Z");
    });

    it("after an outage, keeps the 9:00 anchor and counts the occurrences it skipped", () => {
      // Due 21 Sep 09:00 IST; the next tick runs 24 Sep 15:00 IST. Before 0.5-4 the next
      // time became "now + 24h", so the reminder moved to 15:00 for good.
      const next = daily(
        "daily@09:00",
        "2026-09-21T03:30:00Z",
        "2026-09-24T09:30:00Z",
        "Asia/Kolkata",
      );
      expect(next.at?.toISOString()).toBe("2026-09-25T03:30:00.000Z");
      expect(next.missed).toBe(3); // the 22nd, 23rd and 24th
    });

    it("counts nothing missed when quiet hours held a reminder until morning", () => {
      // 23:00 IST, held until 07:00: tonight's 23:00 is next, and nothing was skipped.
      const next = daily(
        "daily@23:00",
        "2026-09-21T17:30:00Z",
        "2026-09-22T01:30:00Z",
        "Asia/Kolkata",
      );
      expect(next.at?.toISOString()).toBe("2026-09-22T17:30:00.000Z");
      expect(next.missed).toBe(0);
    });

    it("reads quiet hours on the student's clock, including midnight", () => {
      const config = { enabled: true, startHour: 22, endHour: 7, timezone: "Asia/Kolkata" };
      expect(isWithinQuietHours(new Date("2026-09-21T03:30:00Z"), config)).toBe(false); // 09:00 IST
      expect(isWithinQuietHours(new Date("2026-09-21T18:00:00Z"), config)).toBe(true); // 23:30 IST
      expect(isWithinQuietHours(new Date("2026-09-21T18:30:00Z"), config)).toBe(true); // 00:00 IST
      // A window starting at midnight: an hour rendered as "24" would fall outside it.
      const early = { enabled: true, startHour: 0, endHour: 6, timezone: "Asia/Kolkata" };
      expect(isWithinQuietHours(new Date("2026-09-21T18:30:00Z"), early)).toBe(true);
    });
  });

  describe("Security: VAPID Key Isolation (R8)", () => {
    it("provides safe public VAPID key without exposing private key", () => {
      const pubKey = getVapidPublicKey();
      expect(pubKey).toBeDefined();
      expect(pubKey.length).toBeGreaterThan(20);

      // Verify that process.env.VAPID_PRIVATE_KEY is not equal to public key
      expect(process.env.VAPID_PRIVATE_KEY).not.toBe(pubKey);
    });
  });
});
