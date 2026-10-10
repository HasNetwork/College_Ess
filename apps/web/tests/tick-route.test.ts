import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { type TestUser, api, createCollege, createUser, testDb } from "./harness";

const TICK = "/api/internal/tick";
const withSecret = (secret: string) => ({ headers: { "x-tick-secret": secret } });

/**
 * Seeds `count` forced (exam) reminders, all due now, for one user with one device. Half
 * recur: a one-shot is disabled when claimed, which alone stops a second send, so only a
 * recurring reminder (still enabled after firing) shows whether the claim really holds.
 */
async function seedDueExamReminders(user: TestUser, count: number) {
  const examId = uuidv7();
  await testDb().insert(schema.items).values({
    id: examId,
    collegeId: user.collegeId,
    userId: user.id,
    kind: "exam",
    title: "Exam",
  });
  const due = new Date(Date.now() - 60_000);
  await testDb()
    .insert(schema.reminders)
    .values(
      Array.from({ length: count }, (_, i) => ({
        id: uuidv7(),
        userId: user.id,
        subjectType: "item",
        subjectId: examId,
        ...(i % 2 === 0
          ? { triggerKind: "absolute" as const, triggerValue: due.toISOString() }
          : { triggerKind: "recurring" as const, triggerValue: String(24 * 60 * 60 * 1000) }),
        channel: "push" as const,
        // Forced reminders bypass quiet hours. A harness user's are on, in UTC (the
        // default zone), so a normal reminder would make this test time-of-day dependent.
        forced: true,
        enabled: true,
        nextFireAt: due,
      })),
    );
  await testDb()
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint: `https://push.test/${uuidv7()}`, p256dh: "k", auth: "a" });
}

describe("POST /api/internal/tick", () => {
  let student: TestUser;

  beforeAll(async () => {
    student = await createUser((await createCollege("tick")).id);
  });

  it("rejects a caller without the shared secret, or with the wrong one", async () => {
    expect((await api.post(TICK)).status).toBe(401);
    expect((await api.post(TICK, undefined, withSecret("not-the-secret"))).status).toBe(401);
  });

  it("accepts the secret through either header the scheduler worker sends", async () => {
    const secret = requireEnv("TICK_SECRET");
    const viaHeader = await api.post(TICK, undefined, withSecret(secret));
    const viaBearer = await api.post(TICK, undefined, {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.body.success).toBe(true);
    expect(viaBearer.status).toBe(200);
  });

  it("fails closed when TICK_SECRET is unset, instead of skipping the check (R18)", async () => {
    // The old route wrapped the check in `if (tickSecret)`, so no secret meant no check.
    vi.stubEnv("TICK_SECRET", undefined);
    expect((await api.post(TICK)).status).toBe(500);
    expect((await api.post(TICK, undefined, withSecret(""))).status).toBe(500);
  });

  // Pinned as `it.fails` from 0.5-1 until 0.5-4 (§1): the claim was a bare SELECT, so both
  // ticks fired every due reminder (19 pushes for 10), duplicate mandatory exam alerts.
  it("two concurrent ticks send each due reminder exactly once", async () => {
    const reminders = 10;
    await seedDueExamReminders(student, reminders);
    // A real push is a network round trip. With an instant stub, tick one finishes its
    // whole due set before tick two is even accepted, and the overlap (the production
    // failure: a large due set runs past the next cron minute) never occurs.
    const sends = vi.spyOn(webpush, "sendNotification").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { statusCode: 201, body: "", headers: {} };
    });

    const secret = requireEnv("TICK_SECRET");
    const ticks = await Promise.all([
      api.post(TICK, undefined, withSecret(secret)),
      api.post(TICK, undefined, withSecret(secret)),
    ]);

    expect(ticks.map((tick) => tick.status)).toEqual([200, 200]);
    expect(sends).toHaveBeenCalledTimes(reminders);
    // The ticks really overlapped: each read reminders the other claimed first. Without
    // this, two ticks that happened to run one after the other would also pass.
    const lost = ticks.map((tick) => tick.body.claimedElsewhereCount as number);
    expect(lost.reduce((a, b) => a + b)).toBeGreaterThan(0);
  });
});
