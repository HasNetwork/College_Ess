import { isIosSafariNotInstalled } from "@/components/shell/ios-install-prompt";

// Browser side of Web Push (0.5-3 §1). Never exported from ./index.ts, which carries the
// Node-only `web-push`: a client component imports this file directly.

const SUBSCRIBE = "/api/reminders/subscribe";

/** What this device can do about reminders, before anything is asked of the user. */
export type DevicePushSupport = "available" | "unsupported" | "ios-not-installed" | "blocked";

export function devicePushSupport(): DevicePushSupport {
  // Checked first: in a Safari tab an iPhone has no PushManager at all until the app is on
  // the home screen, and "install it" is the answer there, not "unsupported" (PLAN §8.1).
  if (isIosSafariNotInstalled()) return "ios-not-installed";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return "available";
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** The app's VAPID public key, as the bytes `pushManager.subscribe()` takes. */
export async function fetchVapidPublicKey(
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetcher(SUBSCRIBE);
  if (!res.ok) throw new Error(`Could not load the push key (${res.status})`);
  const { vapidPublicKey } = (await res.json()) as { vapidPublicKey: string };
  return base64UrlToBytes(vapidPublicKey);
}

/** The part of a service worker registration these functions use. */
export interface PushRegistration {
  pushManager: Pick<PushManager, "getSubscription" | "subscribe">;
}

/** Saves this device's subscription for the signed-in account; returns the HTTP status. */
async function saveSubscription(
  subscription: PushSubscription,
  fetcher: typeof fetch,
): Promise<number> {
  const res = await fetcher(SUBSCRIBE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...subscription.toJSON(), userAgent: navigator.userAgent }),
  });
  return res.status;
}

/**
 * Turns reminders on for this device, for the signed-in account. Call it straight from the
 * tap: Safari lets a page subscribe only while it handles the user's gesture, so
 * `subscribe()` is the first thing awaited and the key must already be loaded.
 */
export async function enableDevicePush(
  registration: PushRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const options: PushSubscriptionOptionsInit = { userVisibleOnly: true, applicationServerKey };
  let subscription = await registration.pushManager.subscribe(options);
  let status = await saveSubscription(subscription, fetcher);
  if (status === 409) {
    // The browser is still subscribed for an account that used this device before, and the
    // server won't move that account's device to you (0.5-2). A fresh subscription gets a
    // new endpoint; the old one fails its next send (410) and is pruned. Safari may need a
    // second tap here, since the first gesture has been spent.
    await subscription.unsubscribe();
    subscription = await registration.pushManager.subscribe(options);
    status = await saveSubscription(subscription, fetcher);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Could not save this device for reminders (${status})`);
  }
}

/** Turns reminders off for this device: the server forgets it first, then the browser. */
export async function disableDevicePush(
  registration: PushRegistration,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const res = await fetcher(SUBSCRIBE, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!res.ok) throw new Error(`Could not turn reminders off (${res.status})`);
  await subscription.unsubscribe();
}

/**
 * Whether this device gets the signed-in account's reminders. The browser may still hold a
 * subscription made for another account on a shared device: saving it again is harmless
 * for its owner, and a 409 for anyone else.
 */
export async function devicePushIsOn(
  registration: PushRegistration,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  return (await saveSubscription(subscription, fetcher)) === 200;
}
