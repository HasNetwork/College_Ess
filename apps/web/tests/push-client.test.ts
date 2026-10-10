import { schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type PushRegistration,
  devicePushIsOn,
  disableDevicePush,
  enableDevicePush,
  fetchVapidPublicKey,
} from "../src/lib/reminders/push-client";
import { type TestUser, api, createUser, harnessFetch, seedTwoColleges, testDb } from "./harness";

// The browser half of push (0.5-3 §1), against the real /api/reminders/subscribe. Only the
// browser's push manager is simulated; a real push service is a device check (R10.1).

/** A browser's push state: one subscription at most, as a real registration holds. */
function fakeBrowser(existingEndpoint?: string) {
  const calls = { subscribe: 0, unsubscribe: 0 };
  const subscription = (endpoint: string) =>
    ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-key", auth: "auth-secret" } }),
      unsubscribe: async () => {
        calls.unsubscribe++;
        current = null;
        return true;
      },
    }) as unknown as PushSubscription;
  let current: PushSubscription | null = existingEndpoint ? subscription(existingEndpoint) : null;
  const registration: PushRegistration = {
    pushManager: {
      getSubscription: async () => current,
      // As in a browser: subscribing again returns the subscription it already has.
      subscribe: async () => {
        calls.subscribe++;
        current ??= subscription(`https://push.test/${uuidv7()}`);
        return current;
      },
    },
  };
  return { registration, calls, endpoint: () => current?.endpoint };
}

async function subscriptionRow(endpoint: string | undefined) {
  if (!endpoint) return undefined;
  const [row] = await testDb()
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint));
  return row;
}

describe("reminders on this device", () => {
  let student: TestUser;
  let classmate: TestUser;
  let key: Uint8Array<ArrayBuffer>;

  beforeAll(async () => {
    const { studentA, collegeA } = await seedTwoColleges();
    student = studentA;
    classmate = await createUser(collegeA.id, "Classmate");
    key = await fetchVapidPublicKey(harnessFetch(null));
  });

  it("loads the key a push service accepts, without being signed in", () => {
    // An uncompressed P-256 public key: 65 bytes, starting 0x04. Anything else and
    // subscribe() fails on every device.
    expect(key).toHaveLength(65);
    expect(key[0]).toBe(0x04);
  });

  it("turns reminders on, for the account that is signed in", async () => {
    const browser = fakeBrowser();

    await enableDevicePush(browser.registration, key, harnessFetch(student));

    expect((await subscriptionRow(browser.endpoint()))?.userId).toBe(student.id);
  });

  it("takes over a device another account left subscribed, without touching that account's row", async () => {
    // A shared phone: the browser still holds the last student's subscription. The server
    // refuses to move it (409), so the browser must start a fresh one.
    const leftBehind = `https://push.test/${uuidv7()}`;
    await api.post(
      "/api/reminders/subscribe",
      { endpoint: leftBehind, keys: { p256dh: "k", auth: "a" } },
      { as: student },
    );
    const browser = fakeBrowser(leftBehind);

    await enableDevicePush(browser.registration, key, harnessFetch(classmate));

    expect(browser.calls.unsubscribe).toBe(1);
    expect(browser.endpoint()).not.toBe(leftBehind);
    expect((await subscriptionRow(browser.endpoint()))?.userId).toBe(classmate.id);
    expect((await subscriptionRow(leftBehind))?.userId).toBe(student.id);
  });

  it("fails, rather than looking on, when the device could not be saved", async () => {
    // An expired session: the browser subscribed, the server saved nothing. Reporting
    // success here shows a switch that is on while no reminder can ever arrive.
    const browser = fakeBrowser();

    await expect(enableDevicePush(browser.registration, key, harnessFetch(null))).rejects.toThrow(
      "401",
    );
  });

  it("turns reminders off: the account forgets this device, and so does the browser", async () => {
    const browser = fakeBrowser();
    await enableDevicePush(browser.registration, key, harnessFetch(student));
    const endpoint = browser.endpoint();

    await disableDevicePush(browser.registration, harnessFetch(student));

    expect(await subscriptionRow(endpoint)).toBeUndefined();
    expect(browser.endpoint()).toBeUndefined();
  });

  it("shows reminders as off when the browser's subscription belongs to another account", async () => {
    // Otherwise the next student sees "on" while every reminder goes to the last one.
    const browser = fakeBrowser();
    await enableDevicePush(browser.registration, key, harnessFetch(student));

    expect(await devicePushIsOn(browser.registration, harnessFetch(classmate))).toBe(false);
    expect(await devicePushIsOn(browser.registration, harnessFetch(student))).toBe(true);
  });
});
