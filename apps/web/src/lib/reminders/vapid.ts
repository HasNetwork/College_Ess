import { requireEnv } from "@clg-ess/db";
import webpush from "web-push";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;

  webpush.setVapidDetails(
    requireEnv("VAPID_SUBJECT"),
    requireEnv("VAPID_PUBLIC_KEY"),
    requireEnv("VAPID_PRIVATE_KEY"),
  );
  vapidConfigured = true;
}

/**
 * Returns the public VAPID key.
 * SAFE TO EXPOSE TO CLIENTS.
 */
export function getVapidPublicKey(): string {
  return requireEnv("VAPID_PUBLIC_KEY");
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    reminderId?: string;
    subjectType?: string;
    subjectId?: string;
    [key: string]: unknown;
  };
}

export interface PushResult {
  success: boolean;
  isGone?: boolean; // 410 or 404 indicates expired/unregistered subscription
  statusCode?: number;
  error?: string;
}

/**
 * Sends a Web Push notification to a single client subscription.
 * Handles 410 Gone / 404 Not Found by indicating isGone: true so caller can purge dead subscriptions.
 */
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushPayload,
): Promise<PushResult> {
  ensureVapidConfigured();

  const pushSub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const response = await webpush.sendNotification(pushSub, JSON.stringify(payload));
    return {
      success: true,
      statusCode: response.statusCode,
    };
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    const statusCode = err?.statusCode;
    // 410 Gone or 404 Not Found indicates the user revoked permission or the browser subscription is defunct
    if (statusCode === 410 || statusCode === 404) {
      return {
        success: false,
        isGone: true,
        statusCode,
        error: err.message,
      };
    }

    return {
      success: false,
      isGone: false,
      statusCode,
      error: err?.message || "Failed to send web push",
    };
  }
}
