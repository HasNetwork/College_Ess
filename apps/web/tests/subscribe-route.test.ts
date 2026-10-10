import { requireEnv, schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { type TestUser, api, createUser, seedTwoColleges, testDb } from "./harness";

// A push subscription is one browser on one device. Whoever owns the row receives that
// device's notifications, so knowing someone's endpoint must never move it to you.

const subscription = (endpoint: string, key = "p256dh-key") => ({
  endpoint,
  keys: { p256dh: key, auth: "auth-secret" },
  userAgent: "test",
});

async function subscriptionRow(endpoint: string) {
  const [row] = await testDb()
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint));
  return row;
}

describe("/api/reminders/subscribe", () => {
  let victim: TestUser;
  let attacker: TestUser;

  beforeAll(async () => {
    const { studentA, collegeA } = await seedTwoColleges();
    victim = studentA;
    attacker = await createUser(collegeA.id, "Attacker");
  });

  it("will not re-parent another account's device", async () => {
    const endpoint = `https://push.test/${uuidv7()}`;
    expect(
      (await api.post("/api/reminders/subscribe", subscription(endpoint), { as: victim })).status,
    ).toBe(200);

    // Before 0.5-2 the upsert looked the endpoint up and reassigned user_id: the victim's
    // reminders stopped, and the device answered to the attacker's keys instead.
    const hijack = await api.post(
      "/api/reminders/subscribe",
      subscription(endpoint, "attacker-key"),
      { as: attacker },
    );

    expect(hijack.status).toBe(409);
    const row = await subscriptionRow(endpoint);
    expect(row?.userId).toBe(victim.id);
    expect(row?.p256dh).toBe("p256dh-key");
  });

  it("still lets the owner refresh their own subscription", async () => {
    const endpoint = `https://push.test/${uuidv7()}`;
    await api.post("/api/reminders/subscribe", subscription(endpoint), { as: victim });

    const refreshed = await api.post(
      "/api/reminders/subscribe",
      subscription(endpoint, "rotated-key"),
      { as: victim },
    );

    expect(refreshed.status).toBe(200);
    expect((await subscriptionRow(endpoint))?.p256dh).toBe("rotated-key");
  });

  it("gives a signed-out caller the VAPID public key and nothing else", async () => {
    // Public by design (anonymous-callers.test.ts): a browser needs this key to subscribe.
    const res = await api.get("/api/reminders/subscribe");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ vapidPublicKey: requireEnv("VAPID_PUBLIC_KEY") });
    expect(JSON.stringify(res.body)).not.toContain(requireEnv("VAPID_PRIVATE_KEY"));
  });

  it("will not let another account unsubscribe someone else's device", async () => {
    const endpoint = `https://push.test/${uuidv7()}`;
    await api.post("/api/reminders/subscribe", subscription(endpoint), { as: victim });

    await api.delete("/api/reminders/subscribe", { as: attacker, body: { endpoint } });

    expect((await subscriptionRow(endpoint))?.userId).toBe(victim.id);
  });
});
