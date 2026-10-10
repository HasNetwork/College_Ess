import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { type TestUser, api, createCollege, createUser, testDb } from "./harness";

// Reminders run on each student's own clock (0.5-4 §2). Until 0.5-4 everything was UTC:
// quiet hours held 22:00-07:00 UTC, which is 03:30-12:30 in Kolkata, so a 9am class
// reminder never arrived and a 2am one did. Every student here saves their settings
// through Better Auth's real update-user route, the way the Settings page does, and every
// tick is a real request to the route with the server's clock pinned. Its own file: a
// pinned clock at minute 0 would also run the reaper.

const TICK = "/api/internal/tick";

/** POSTs the tick as the Worker does, with the server's clock pinned to `at`. */
function tickAt(at: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(at));
  return api.post(TICK, undefined, { headers: { "x-tick-secret": requireEnv("TICK_SECRET") } });
}

/** A student with one device, whose settings were saved through the real route. */
async function student(collegeId: string, settings: Record<string, unknown>) {
  const user = await createUser(collegeId);
  const saved = await api.post("/api/auth/update-user", settings, {
    as: user,
    headers: { origin: requireEnv("BETTER_AUTH_URL") },
  });
  expect(saved.status).toBe(200);
  const endpoint = `https://push.test/${uuidv7()}`;
  await testDb()
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: "k", auth: "a" });
  return { ...user, endpoint };
}

type Student = TestUser & { endpoint: string };

/** A reminder on its own todo, due at `due`. */
async function reminder(
  user: Student,
  due: string,
  options: { forced?: boolean; triggerKind?: "absolute" | "recurring"; triggerValue?: string } = {},
) {
  const itemId = uuidv7();
  await testDb().insert(schema.items).values({
    id: itemId,
    collegeId: user.collegeId,
    userId: user.id,
    kind: "todo",
    title: "Reminder subject",
  });
  const id = uuidv7();
  await testDb()
    .insert(schema.reminders)
    .values({
      id,
      userId: user.id,
      subjectType: "item",
      subjectId: itemId,
      triggerKind: options.triggerKind ?? "absolute",
      triggerValue: options.triggerValue ?? due,
      channel: "push",
      forced: options.forced ?? false,
      enabled: true,
      nextFireAt: new Date(due),
    });
  return id;
}

async function reminderRow(id: string) {
  const [row] = await testDb().select().from(schema.reminders).where(eq(schema.reminders.id, id));
  return row;
}

/** Stubs the push edge and records which device each push went to. */
function recordPushes(): string[] {
  const endpoints: string[] = [];
  vi.spyOn(webpush, "sendNotification").mockImplementation(async (subscription) => {
    endpoints.push(subscription.endpoint);
    return { statusCode: 201, body: "", headers: {} };
  });
  return endpoints;
}

describe("the tick, on each student's clock", () => {
  let collegeId: string;

  beforeAll(async () => {
    collegeId = (await createCollege("clock")).id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers a 9am reminder in Kolkata at 9am, not holding it for quiet hours", async () => {
    const kolkata = await student(collegeId, { timezone: "Asia/Kolkata" });
    await reminder(kolkata, "2026-09-28T03:30:00Z"); // 09:00 IST
    const pushes = recordPushes();

    const res = await tickAt("2026-09-28T03:31:00Z");

    expect(res.status).toBe(200);
    expect(pushes).toContain(kolkata.endpoint);
  });

  it("holds an ordinary reminder in the student's own night, unless they turned quiet hours off", async () => {
    const sleeper = await student(collegeId, { timezone: "Asia/Kolkata" });
    const nightOwl = await student(collegeId, {
      timezone: "Asia/Kolkata",
      quietHoursEnabled: false,
    });
    const held = await reminder(sleeper, "2026-09-28T18:00:00Z"); // 23:30 IST
    await reminder(nightOwl, "2026-09-28T18:00:00Z");
    const pushes = recordPushes();

    await tickAt("2026-09-28T18:01:00Z");

    expect(pushes).toContain(nightOwl.endpoint);
    expect(pushes).not.toContain(sleeper.endpoint);
    // Held, not dropped: still due, so the first tick after 07:00 IST sends it.
    expect((await reminderRow(held))?.enabled).toBe(true);
    const morning = recordPushes();
    await tickAt("2026-09-29T01:31:00Z"); // 07:01 IST
    expect(morning).toContain(sleeper.endpoint);
  });

  it("still delivers a mandatory exam reminder during quiet hours", async () => {
    const examTaker = await student(collegeId, { timezone: "Asia/Kolkata" });
    await reminder(examTaker, "2026-09-30T18:00:00Z", { forced: true }); // 23:30 IST
    const pushes = recordPushes();

    await tickAt("2026-09-30T18:01:00Z");

    expect(pushes).toContain(examTaker.endpoint);
  });

  // Runs before the New York test, whose daily reminder would otherwise be due at this
  // tick too and add its own gap to the count.
  it("after an outage, sends once, keeps the 9:05 anchor and logs the gap", async () => {
    const kolkata = await student(collegeId, { timezone: "Asia/Kolkata" });
    // Due 1 Oct 09:05 IST; no tick runs until 4 Oct 15:05 IST.
    const id = await reminder(kolkata, "2026-10-01T03:35:00Z", {
      triggerKind: "recurring",
      triggerValue: "daily@09:05",
    });
    const pushes = recordPushes();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await tickAt("2026-10-04T09:35:00Z");

    expect(pushes.filter((endpoint) => endpoint === kolkata.endpoint)).toHaveLength(1);
    expect((await reminderRow(id))?.nextFireAt?.toISOString()).toBe("2026-10-05T03:35:00.000Z");
    expect(res.body.missedOccurrencesCount).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Reminder ${id} missed 3`));
  });

  it("keeps a daily 9:05 reminder at 9:05 in New York across the spring-forward night", async () => {
    const newYork = await student(collegeId, { timezone: "America/New_York" });
    // 09:05 EST on 7 March 2026 is 14:05Z; on 8 March, 09:05 EDT is 13:05Z.
    const id = await reminder(newYork, "2026-03-07T14:05:00Z", {
      triggerKind: "recurring",
      triggerValue: "daily@09:05",
    });
    recordPushes();

    await tickAt("2026-03-07T14:05:30Z");

    expect((await reminderRow(id))?.nextFireAt?.toISOString()).toBe("2026-03-08T13:05:00.000Z");
  });
});
